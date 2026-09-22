"""
Test Suite: Authoritative Product Publication Pipeline & Idempotency Architecture
Verifies that:
1. Product publication is strictly single-pipeline via POST /api/v1/products.
2. Idempotency keys (via X-Idempotency-Key or payload) prevent duplicate records on retry.
3. Pricing floor guardrail (HTTP 422) prevents underpriced exploitative listings.
4. Authentication & ownership enforcement prevents unauthorized or spoofed publications.
5. Rollback on database failure ensures zero orphaned data.
"""
import uuid
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.models.artisan import Artisan
from app.models.product import Product
from app.models.craft_cluster import CraftCluster


@pytest.fixture(autouse=True)
def initialize_test_db():
    init_db()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def artisan_auth_header(artisan_id: str):
    payload = {"app_metadata": {"role": "artisan"}, "email": f"{artisan_id}@hunardhara.gov.in"}
    return {"Authorization": f"Bearer {create_access_token(artisan_id, extra_claims=payload)}"}


@pytest.fixture
def test_artisan(db):
    artisan_id = f"artisan-test-{uuid.uuid4().hex[:8]}"
    cluster_id = "cluster-bastar-dhokra"

    cluster = db.query(CraftCluster).filter(CraftCluster.id == cluster_id).first()
    if not cluster:
        cluster = CraftCluster(
            id=cluster_id,
            name="Bastar Dhokra Craft Cluster",
            craft_name="Bastar Dhokra",
            state="Chhattisgarh",
            district="Bastar",
            latitude=19.0748,
            longitude=82.0298,
            statutory_hourly_wage=50.0,
            statutory_daily_wage=400.0,
            gi_tag_status="Registered (GI-82)",
            gi_tag_number="GI-82",
        )
        db.add(cluster)
        db.commit()

    artisan = Artisan(
        id=artisan_id,
        full_name="Mangal Ram Bastar",
        cluster_id=cluster_id,
        primary_craft="Bastar Dhokra",
        state="Chhattisgarh",
        district="Bastar",
        social_category="ST",
        phone_number=f"+9198{uuid.uuid4().int % 100000000:08d}",
        masked_aadhaar="XXXXXXXX1234",
        aadhaar_hash=f"hash-{artisan_id}",
        monthly_capacity_units=40,
        daily_capacity_units=1.33,
        latitude=19.0748,
        longitude=82.0298,
        is_active=True,
    )
    db.add(artisan)
    db.commit()
    return artisan


@pytest.fixture
def second_artisan(db):
    artisan_id = f"artisan-sec-{uuid.uuid4().hex[:8]}"
    cluster_id = "cluster-bastar-dhokra"

    artisan = Artisan(
        id=artisan_id,
        full_name="Second Artisan Bastar",
        cluster_id=cluster_id,
        primary_craft="Bastar Dhokra",
        state="Chhattisgarh",
        district="Bastar",
        social_category="ST",
        phone_number=f"+9198{uuid.uuid4().int % 100000000:08d}",
        masked_aadhaar="XXXXXXXX5678",
        aadhaar_hash=f"hash-{artisan_id}",
        monthly_capacity_units=30,
        daily_capacity_units=1.0,
        latitude=19.0748,
        longitude=82.0298,
        is_active=True,
    )
    db.add(artisan)
    db.commit()
    return artisan


class TestProductPublishIdempotency:
    """Test suite for single authoritative publish pipeline with idempotency."""

    def test_authoritative_publish_success(self, client, test_artisan, db):
        """TC-PUB-01: Verifies publishing a product creates exactly one record in PostgreSQL."""
        headers = artisan_auth_header(test_artisan.id)
        idempotency_key = f"pub-key-{uuid.uuid4().hex}"

        product_payload = {
            "title": "Bastar Handcrafted Brass Nandi Figurine",
            "craft_type": "Bastar Dhokra",
            "technique": "Lost-wax bell metal casting (Cire perdue)",
            "cost_materials": 400.0,
            "labor_hours": 16.0,
            "listing_price": 2400.0,  # Floor: (400 + 16*50) * 1.10 = 1320 -> 2400 is fair
            "stock_quantity": 4,
            "cluster_id": test_artisan.cluster_id,
            "artisan_id": test_artisan.id,
            "description_hindi": "पारंपरिक बस्तर ढोकरा नंदी बैल",
            "description_english": "Traditional Bastar Dhokra brass Nandi figurine.",
            "idempotency_key": idempotency_key,
        }

        res = client.post("/api/v1/products", json=product_payload, headers=headers)
        assert res.status_code == 201
        data = res.json()

        # Check canonical response fields
        assert data["id"].startswith("prod-")
        assert data["title"] == "Bastar Handcrafted Brass Nandi Figurine"
        assert data["listing_price"] == 2400.0
        assert data["artisan_id"] == test_artisan.id
        assert data["qr_passport_id"].startswith("qr-passport-")
        assert data["idempotency_key"] == idempotency_key

        # Verify database record
        saved_product = db.query(Product).filter(Product.id == data["id"]).first()
        assert saved_product is not None
        assert saved_product.idempotency_key == idempotency_key
        assert saved_product.listing_price == 2400.0

    def test_idempotent_publish_replay_no_duplicates(self, client, test_artisan, db):
        """TC-PUB-02: Repeated clicks / retries with the same idempotency key return the same product without duplicating."""
        headers = artisan_auth_header(test_artisan.id)
        idempotency_key = f"pub-key-replay-{uuid.uuid4().hex}"

        product_payload = {
            "title": "Bastar Dhokra Tribal Candle Stand",
            "craft_type": "Bastar Dhokra",
            "technique": "Lost-wax bell metal casting",
            "cost_materials": 350.0,
            "labor_hours": 12.0,
            "listing_price": 1950.0,
            "stock_quantity": 3,
            "cluster_id": test_artisan.cluster_id,
            "artisan_id": test_artisan.id,
            "idempotency_key": idempotency_key,
        }

        # First request
        res1 = client.post("/api/v1/products", json=product_payload, headers=headers)
        assert res1.status_code == 201
        data1 = res1.json()
        initial_id = data1["id"]

        # Second request (simulating double click or network retry)
        res2 = client.post("/api/v1/products", json=product_payload, headers=headers)
        assert res2.status_code == 201
        data2 = res2.json()

        # Both calls must return identical product ID
        assert data2["id"] == initial_id
        assert data2["idempotency_key"] == idempotency_key

        # Database must have exactly ONE row with this idempotency key
        matching_products = db.query(Product).filter(Product.idempotency_key == idempotency_key).all()
        assert len(matching_products) == 1
        assert matching_products[0].id == initial_id

    def test_idempotency_header_support(self, client, test_artisan, db):
        """TC-PUB-03: Supports X-Idempotency-Key HTTP request header."""
        idempotency_key = f"hdr-key-{uuid.uuid4().hex}"
        headers = {
            **artisan_auth_header(test_artisan.id),
            "X-Idempotency-Key": idempotency_key,
        }

        product_payload = {
            "title": "Bastar Dhokra Handcrafted Bell",
            "craft_type": "Bastar Dhokra",
            "technique": "Lost-wax casting",
            "cost_materials": 250.0,
            "labor_hours": 8.0,
            "listing_price": 1200.0,
            "stock_quantity": 5,
            "cluster_id": test_artisan.cluster_id,
            "artisan_id": test_artisan.id,
        }

        res1 = client.post("/api/v1/products", json=product_payload, headers=headers)
        assert res1.status_code == 201
        data1 = res1.json()

        # Retry with header
        res2 = client.post("/api/v1/products", json=product_payload, headers=headers)
        assert res2.status_code == 201
        data2 = res2.json()

        assert data1["id"] == data2["id"]
        assert db.query(Product).filter(Product.idempotency_key == idempotency_key).count() == 1

    def test_price_floor_violation_rejected_no_row_created(self, client, test_artisan, db):
        """TC-PUB-04: Server-side HTTP 422 rejects underpriced listing and creates NO database record."""
        headers = artisan_auth_header(test_artisan.id)
        idempotency_key = f"pub-fail-floor-{uuid.uuid4().hex}"

        exploitative_payload = {
            "title": "Exploitative Underpriced Bastar Figurine",
            "craft_type": "Bastar Dhokra",
            "technique": "Lost-wax casting",
            "cost_materials": 500.0,
            "labor_hours": 24.0,  # 24 * 50 = 1200, Materials = 500 -> Cost floor = (1700) * 1.10 = 1870
            "listing_price": 400.0,  # 400 < 1870 -> Forbidden!
            "stock_quantity": 2,
            "cluster_id": test_artisan.cluster_id,
            "artisan_id": test_artisan.id,
            "idempotency_key": idempotency_key,
        }

        res = client.post("/api/v1/products", json=exploitative_payload, headers=headers)
        assert res.status_code == 422
        assert "PRICE_BELOW_STATUTORY_FLOOR" in res.text

        # Ensure database is clean
        saved = db.query(Product).filter(Product.idempotency_key == idempotency_key).first()
        assert saved is None

    def test_unauthenticated_publish_rejected(self, client, test_artisan, db):
        """TC-PUB-05: Anonymous publish attempt is rejected with HTTP 401."""
        idempotency_key = f"pub-anon-{uuid.uuid4().hex}"
        product_payload = {
            "title": "Unauthenticated Product",
            "craft_type": "Bastar Dhokra",
            "technique": "Casting",
            "cost_materials": 300.0,
            "labor_hours": 8.0,
            "listing_price": 1500.0,
            "cluster_id": test_artisan.cluster_id,
            "artisan_id": test_artisan.id,
            "idempotency_key": idempotency_key,
        }

        res = client.post("/api/v1/products", json=product_payload)
        assert res.status_code == 401
        assert db.query(Product).filter(Product.idempotency_key == idempotency_key).first() is None

    def test_artisan_cannot_spoof_another_artisan_id(self, client, test_artisan, second_artisan, db):
        """TC-PUB-06: Regular artisan cannot forge artisan_id of someone else; server binds to current_user.id."""
        headers = artisan_auth_header(test_artisan.id)
        idempotency_key = f"pub-spoof-{uuid.uuid4().hex}"

        product_payload = {
            "title": "Spoofed Ownership Bastar Bull",
            "craft_type": "Bastar Dhokra",
            "technique": "Lost-wax casting",
            "cost_materials": 300.0,
            "labor_hours": 10.0,
            "listing_price": 1800.0,
            "cluster_id": test_artisan.cluster_id,
            "artisan_id": second_artisan.id,  # Spoofed!
            "idempotency_key": idempotency_key,
        }

        res = client.post("/api/v1/products", json=product_payload, headers=headers)
        assert res.status_code == 201
        data = res.json()

        # The server must override the artisan_id to the authenticated user's ID
        assert data["artisan_id"] == test_artisan.id
        assert data["artisan_id"] != second_artisan.id

        saved = db.query(Product).filter(Product.id == data["id"]).first()
        assert saved.artisan_id == test_artisan.id

    def test_cross_artisan_idempotency_key_rejection(self, client, test_artisan, second_artisan, db):
        """TC-PUB-07: Using another artisan's idempotency key is rejected with HTTP 403."""
        shared_key = f"shared-key-{uuid.uuid4().hex}"

        # First artisan creates product
        payload1 = {
            "title": "First Artisan Product",
            "craft_type": "Bastar Dhokra",
            "technique": "Lost-wax casting",
            "cost_materials": 300.0,
            "labor_hours": 10.0,
            "listing_price": 1800.0,
            "cluster_id": test_artisan.cluster_id,
            "artisan_id": test_artisan.id,
            "idempotency_key": shared_key,
        }
        res1 = client.post("/api/v1/products", json=payload1, headers=artisan_auth_header(test_artisan.id))
        assert res1.status_code == 201

        # Second artisan tries to publish with the SAME key
        payload2 = {
            "title": "Second Artisan Product Hijack",
            "craft_type": "Bastar Dhokra",
            "technique": "Lost-wax casting",
            "cost_materials": 300.0,
            "labor_hours": 10.0,
            "listing_price": 1800.0,
            "cluster_id": second_artisan.cluster_id,
            "artisan_id": second_artisan.id,
            "idempotency_key": shared_key,
        }
        res2 = client.post("/api/v1/products", json=payload2, headers=artisan_auth_header(second_artisan.id))
        assert res2.status_code == 403
        assert "FORBIDDEN_IDEMPOTENCY_KEY" in res2.text

    def test_database_rollback_on_commit_failure(self, client, test_artisan, db):
        """TC-PUB-08: Simulating database commit error triggers rollback and returns HTTP 500 cleanly."""
        headers = artisan_auth_header(test_artisan.id)
        idempotency_key = f"pub-rollback-{uuid.uuid4().hex}"

        payload = {
            "title": "Rollback Test Product",
            "craft_type": "Bastar Dhokra",
            "technique": "Lost-wax casting",
            "cost_materials": 300.0,
            "labor_hours": 10.0,
            "listing_price": 1800.0,
            "cluster_id": test_artisan.cluster_id,
            "artisan_id": test_artisan.id,
            "idempotency_key": idempotency_key,
        }

        with patch("sqlalchemy.orm.Session.commit", side_effect=Exception("Simulated disk I/O failure")):
            res = client.post("/api/v1/products", json=payload, headers=headers)
            assert res.status_code == 500
            assert "PRODUCT_CREATE_FAILED" in res.text

        # Verify no orphan product remains in the database
        assert db.query(Product).filter(Product.idempotency_key == idempotency_key).first() is None
