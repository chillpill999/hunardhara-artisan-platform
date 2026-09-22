import uuid
import secrets
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.core.config import settings
from app.models.artisan import Artisan
from app.models.product import Product
from app.models.craft_cluster import CraftCluster
from app.models.b2b_rfq import B2BRFQ, B2BMatchRecord


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


def make_token(user_id: str, role: str = "customer", email: str = "user@crafts.in"):
    return create_access_token(
        subject=user_id,
        extra_claims={
            "app_metadata": {"role": role},
            "email": email,
        },
    )


@pytest.fixture
def buyer_token():
    return make_token("buyer-uuid-101", "customer", "procurement@stateemporium.gov.in")


@pytest.fixture
def other_buyer_token():
    return make_token("buyer-uuid-202", "customer", "other@corp.com")


@pytest.fixture
def test_setup_data(db):
    """Sets up clusters, active artisans with active products, and inactive artisans/products."""
    cluster_id = f"cl-auth-{uuid.uuid4().hex[:6]}"
    cluster = CraftCluster(
        id=cluster_id,
        name=f"Authoritative Cluster {cluster_id}",
        craft_name="Bastar Dhokra",
        state="Chhattisgarh",
        district="Bastar",
        latitude=19.0748,
        longitude=82.0298,
        statutory_hourly_wage=60.0,
        statutory_daily_wage=450.0,
        gi_tag_status="Registered",
    )
    db.merge(cluster)

    # 1. Active artisan with active wholesale product
    artisan_active_id = f"art-active-{uuid.uuid4().hex[:6]}"
    artisan_active = Artisan(
        id=artisan_active_id,
        full_name="Certified Dhokra Master",
        phone_number=f"+91{secrets.token_hex(4)}01",
        masked_aadhaar="XXXXXXXX1111",
        aadhaar_hash=f"hash-{secrets.token_hex(8)}",
        social_category="ST",
        cluster_id=cluster_id,
        state="Chhattisgarh",
        district="Bastar",
        latitude=19.0748,
        longitude=82.0298,
        primary_craft="Bastar Dhokra",
        monthly_capacity_units=60,
        experience_years=20,
        is_active=True,
    )
    db.merge(artisan_active)

    product_active_id = f"prod-auth-{uuid.uuid4().hex[:6]}"
    product_active = Product(
        id=product_active_id,
        title="Authoritative Brass Bull",
        craft_type="Bastar Dhokra",
        artisan_id=artisan_active_id,
        cluster_id=cluster_id,
        technique="Lost Wax Casting",
        floor_price=900.0,
        recommended_retail_price=1800.0,
        wholesale_b2b_price=1350.0,
        listing_price=1800.0,
        stock_quantity=30,
        is_active=True,
    )
    db.merge(product_active)

    # 2. Active artisan with NO products at all (must be excluded in production mode)
    artisan_no_prods_id = f"art-noprods-{uuid.uuid4().hex[:6]}"
    artisan_no_prods = Artisan(
        id=artisan_no_prods_id,
        full_name="Artisan Without Products",
        phone_number=f"+91{secrets.token_hex(4)}02",
        masked_aadhaar="XXXXXXXX2222",
        aadhaar_hash=f"hash-{secrets.token_hex(8)}",
        social_category="OBC",
        cluster_id=cluster_id,
        state="Chhattisgarh",
        district="Bastar",
        latitude=19.0748,
        longitude=82.0298,
        primary_craft="Bastar Dhokra",
        monthly_capacity_units=40,
        experience_years=10,
        is_active=True,
    )
    db.merge(artisan_no_prods)

    # 3. Active artisan with only INACTIVE products
    artisan_inactive_prod_id = f"art-inactprod-{uuid.uuid4().hex[:6]}"
    artisan_inactive_prod = Artisan(
        id=artisan_inactive_prod_id,
        full_name="Artisan With Inactive Products",
        phone_number=f"+91{secrets.token_hex(4)}03",
        masked_aadhaar="XXXXXXXX3333",
        aadhaar_hash=f"hash-{secrets.token_hex(8)}",
        social_category="SC",
        cluster_id=cluster_id,
        state="Chhattisgarh",
        district="Bastar",
        latitude=19.0748,
        longitude=82.0298,
        primary_craft="Bastar Dhokra",
        monthly_capacity_units=40,
        experience_years=8,
        is_active=True,
    )
    db.merge(artisan_inactive_prod)

    product_inactive_id = f"prod-inact-{uuid.uuid4().hex[:6]}"
    product_inactive = Product(
        id=product_inactive_id,
        title="Inactive Draft Bell",
        craft_type="Bastar Dhokra",
        artisan_id=artisan_inactive_prod_id,
        cluster_id=cluster_id,
        technique="Lost Wax",
        floor_price=500.0,
        recommended_retail_price=1000.0,
        wholesale_b2b_price=750.0,
        listing_price=1000.0,
        stock_quantity=0,
        is_active=False,
    )
    db.merge(product_inactive)

    db.commit()

    return {
        "cluster_id": cluster_id,
        "artisan_active_id": artisan_active_id,
        "product_active_id": product_active_id,
        "artisan_no_prods_id": artisan_no_prods_id,
        "artisan_inactive_prod_id": artisan_inactive_prod_id,
    }


class TestAuthoritativeB2BMatching:
    """Test suite ensuring production grounding, authoritative persistence, idempotency, and access controls."""

    def test_anonymous_match_rejected_with_401(self, client):
        """Unauthenticated calls to /b2b/match must return 401 Unauthorized."""
        res = client.post(
            "/api/v1/b2b/match",
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 100,
                "unit_budget": 1500.0,
                "deadline_days": 30,
            },
        )
        assert res.status_code == 401

    def test_invalid_inputs_rejected_with_422(self, client, buyer_token):
        """Zero quantity, non-positive budget, zero deadline, or empty craft must return 422."""
        headers = {"Authorization": f"Bearer {buyer_token}"}

        # Quantity 0
        r1 = client.post(
            "/api/v1/b2b/match",
            headers=headers,
            json={"craft_type": "Bastar Dhokra", "quantity": 0, "unit_budget": 1500.0, "deadline_days": 30},
        )
        assert r1.status_code == 422

        # Negative unit budget
        r2 = client.post(
            "/api/v1/b2b/match",
            headers=headers,
            json={"craft_type": "Bastar Dhokra", "quantity": 10, "unit_budget": -50.0, "deadline_days": 30},
        )
        assert r2.status_code == 422

        # Deadline 0
        r3 = client.post(
            "/api/v1/b2b/match",
            headers=headers,
            json={"craft_type": "Bastar Dhokra", "quantity": 10, "unit_budget": 1500.0, "deadline_days": 0},
        )
        assert r3.status_code == 422

        # Empty craft type
        r4 = client.post(
            "/api/v1/b2b/match",
            headers=headers,
            json={"craft_type": "   ", "quantity": 10, "unit_budget": 1500.0, "deadline_days": 30},
        )
        assert r4.status_code == 422

    def test_match_persists_authoritative_rfq_and_records(self, client, buyer_token, db, test_setup_data):
        """A successful /b2b/match call must persist B2BRFQ and B2BMatchRecord in PostgreSQL and return real rfq_id."""
        headers = {"Authorization": f"Bearer {buyer_token}"}
        res = client.post(
            "/api/v1/b2b/match",
            headers=headers,
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 50,
                "unit_budget": 1500.0,
                "deadline_days": 45,
                "delivery_state": "Delhi",
            },
        )
        assert res.status_code == 200
        data = res.json()
        rfq_id = data.get("rfq_id")
        assert rfq_id is not None
        assert rfq_id.startswith("rfq-")

        # Verify in DB
        persisted_rfq = db.query(B2BRFQ).filter(B2BRFQ.id == rfq_id).first()
        assert persisted_rfq is not None
        assert persisted_rfq.buyer_id == "buyer-uuid-101"
        assert persisted_rfq.buyer_email == "procurement@stateemporium.gov.in"
        assert persisted_rfq.required_quantity == 50
        assert persisted_rfq.unit_budget == 1500.0

        # Verify persisted match records
        persisted_matches = db.query(B2BMatchRecord).filter(B2BMatchRecord.rfq_id == rfq_id).all()
        if data["total_matches_found"] > 0:
            assert len(persisted_matches) > 0
            for pm in persisted_matches:
                assert pm.rfq_id == rfq_id
                assert pm.quoted_unit_price > 0

    def test_idempotency_returns_consistent_rfq(self, client, buyer_token, db):
        """Repeating /b2b/match with the same idempotency_key must return the existing RFQ without duplicate creation."""
        headers = {"Authorization": f"Bearer {buyer_token}"}
        key = f"idem-key-{uuid.uuid4().hex[:8]}"

        payload = {
            "craft_type": "Bastar Dhokra",
            "quantity": 25,
            "unit_budget": 1600.0,
            "deadline_days": 30,
            "idempotency_key": key,
        }

        r1 = client.post("/api/v1/b2b/match", headers=headers, json=payload)
        assert r1.status_code == 200
        rfq_id_1 = r1.json()["rfq_id"]

        r2 = client.post("/api/v1/b2b/match", headers=headers, json=payload)
        assert r2.status_code == 200
        rfq_id_2 = r2.json()["rfq_id"]

        assert rfq_id_1 == rfq_id_2

        # Verify only one B2BRFQ exists in DB for this idempotency key
        count = db.query(B2BRFQ).filter(B2BRFQ.idempotency_key == key).count()
        assert count == 1

    def test_matching_excludes_artisans_without_active_products_in_production(
        self, client, buyer_token, test_setup_data, monkeypatch
    ):
        """In production mode, candidate gathering strictly excludes artisans with zero active products."""
        monkeypatch.setattr(settings, "OFFLINE_MODE", False)

        headers = {"Authorization": f"Bearer {buyer_token}"}
        res = client.post(
            "/api/v1/b2b/match",
            headers=headers,
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 30,
                "unit_budget": 1600.0,
                "deadline_days": 30,
            },
        )
        assert res.status_code == 200
        data = res.json()

        matched_artisan_ids = {m["artisan_id"] for m in data["matches"]}
        assert test_setup_data["artisan_active_id"] in matched_artisan_ids
        assert test_setup_data["artisan_no_prods_id"] not in matched_artisan_ids
        assert test_setup_data["artisan_inactive_prod_id"] not in matched_artisan_ids

    def test_matching_links_real_product_id_and_wholesale_price(
        self, client, buyer_token, test_setup_data, monkeypatch
    ):
        """The match record must link product_id and wholesale price from the artisan's active product."""
        monkeypatch.setattr(settings, "OFFLINE_MODE", False)

        headers = {"Authorization": f"Bearer {buyer_token}"}
        res = client.post(
            "/api/v1/b2b/match",
            headers=headers,
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 30,
                "unit_budget": 1600.0,
                "deadline_days": 30,
            },
        )
        assert res.status_code == 200
        data = res.json()

        target_match = next((m for m in data["matches"] if m["artisan_id"] == test_setup_data["artisan_active_id"]), None)
        assert target_match is not None
        assert target_match["product_id"] == test_setup_data["product_active_id"]
        assert target_match["offered_wholesale_price"] == 1350.0

    def test_requested_artisan_strictly_enforced_without_substitution(
        self, client, buyer_token, test_setup_data
    ):
        """Requesting an invalid artisan returns 404. Requesting an inactive artisan without products returns 0 matches."""
        headers = {"Authorization": f"Bearer {buyer_token}"}

        # Non-existent artisan -> 404
        r_fake = client.post(
            "/api/v1/b2b/match",
            headers=headers,
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 10,
                "unit_budget": 1500.0,
                "deadline_days": 30,
                "requested_artisan_id": "nonexistent-artisan-xyz",
            },
        )
        assert r_fake.status_code == 404

        # Existing artisan who has no active products -> returns 0 matches (NEVER substitutes another artisan)
        r_noprods = client.post(
            "/api/v1/b2b/match",
            headers=headers,
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 10,
                "unit_budget": 1500.0,
                "deadline_days": 30,
                "requested_artisan_id": test_setup_data["artisan_inactive_prod_id"],
            },
        )
        assert r_noprods.status_code == 200
        data = r_noprods.json()
        assert data["total_matches_found"] == 0
        assert len(data["matches"]) == 0

    def test_list_my_rfqs_returns_only_authenticated_buyer_rfqs(
        self, client, buyer_token, other_buyer_token
    ):
        """GET /b2b/rfq/my returns only the RFQs created by the authenticated buyer."""
        h_buyer = {"Authorization": f"Bearer {buyer_token}"}
        h_other = {"Authorization": f"Bearer {other_buyer_token}"}

        # Create RFQ for buyer 1
        r1 = client.post(
            "/api/v1/b2b/match",
            headers=h_buyer,
            json={"craft_type": "Bastar Dhokra", "quantity": 10, "unit_budget": 1500.0, "deadline_days": 30},
        )
        rfq1_id = r1.json()["rfq_id"]

        # Buyer 1 fetches my RFQs
        my_res = client.get("/api/v1/b2b/rfq/my", headers=h_buyer)
        assert my_res.status_code == 200
        my_rfq_ids = {r["id"] for r in my_res.json()}
        assert rfq1_id in my_rfq_ids

        # Buyer 2 fetches my RFQs: must NOT see buyer 1's RFQ
        other_res = client.get("/api/v1/b2b/rfq/my", headers=h_other)
        assert other_res.status_code == 200
        other_rfq_ids = {r["id"] for r in other_res.json()}
        assert rfq1_id not in other_rfq_ids

    def test_unauthorized_rfq_update_and_delete_returns_403(
        self, client, buyer_token, other_buyer_token
    ):
        """Modifying or deleting another buyer's RFQ must return 403 Forbidden."""
        h_buyer = {"Authorization": f"Bearer {buyer_token}"}
        h_other = {"Authorization": f"Bearer {other_buyer_token}"}

        r1 = client.post(
            "/api/v1/b2b/match",
            headers=h_buyer,
            json={"craft_type": "Bastar Dhokra", "quantity": 10, "unit_budget": 1500.0, "deadline_days": 30},
        )
        rfq_id = r1.json()["rfq_id"]

        # Buyer 2 attempts update -> 403
        r_update = client.put(
            f"/api/v1/b2b/rfq/{rfq_id}",
            headers=h_other,
            json={"unit_budget": 2000.0},
        )
        assert r_update.status_code == 403

        # Buyer 2 attempts delete -> 403
        r_delete = client.delete(
            f"/api/v1/b2b/rfq/{rfq_id}",
            headers=h_other,
        )
        assert r_delete.status_code == 403

        # Buyer 1 (owner) can delete
        r_owner_delete = client.delete(
            f"/api/v1/b2b/rfq/{rfq_id}",
            headers=h_buyer,
        )
        assert r_owner_delete.status_code == 200
