"""
Integration tests for the Flutter Mobile App API Contract ("Speak. Snap. Sell.").
Validates that the FastAPI backend satisfies all API contracts and schemas expected
by the mobile client across Dashboard, Camera Studio, Voice Catalog, and Review screens.
"""
import io
import os
import uuid
import pytest
from PIL import Image
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.models.artisan import Artisan
from app.models.product import Product
from app.models.order import Order
from app.models.craft_cluster import CraftCluster


AUDIO_FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "audio"


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
def test_mobile_artisan(db):
    artisan_id = f"artisan-mob-{uuid.uuid4().hex[:8]}"
    cluster_id = "cluster-bastar-dhokra"

    # Ensure cluster exists
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
        full_name="Budhram Podiyami",
        cluster_id=cluster_id,
        primary_craft="Bastar Dhokra",
        state="Chhattisgarh",
        district="Bastar",
        social_category="ST",
        phone_number=f"+9198{uuid.uuid4().int % 100000000:08d}",
        masked_aadhaar="XXXXXXXX7890",
        aadhaar_hash=f"hash-{artisan_id}",
        monthly_capacity_units=35,
        daily_capacity_units=1.17,
        latitude=19.0748,
        longitude=82.0298,
    )
    db.add(artisan)
    db.commit()
    db.refresh(artisan)
    return artisan


def _create_sample_jpeg_bytes() -> bytes:
    img = Image.new("RGB", (256, 256), color=(180, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Test 1: Mobile Artisan Profile Contract (GET /artisans/me)
# ---------------------------------------------------------------------------
def test_mobile_artisan_profile_contract(client, test_mobile_artisan):
    headers = artisan_auth_header(test_mobile_artisan.id)
    response = client.get("/api/v1/artisans/me", headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["id"] == test_mobile_artisan.id
    assert data["full_name"] == "Budhram Podiyami"
    assert data["primary_craft"] == "Bastar Dhokra"
    assert data["state"] == "Chhattisgarh"
    assert data["monthly_capacity_units"] == 35


# ---------------------------------------------------------------------------
# Test 2: Mobile Artisan Products Listing Contract (GET /products/artisan/my)
# ---------------------------------------------------------------------------
def test_mobile_artisan_products_contract(client, db, test_mobile_artisan):
    headers = artisan_auth_header(test_mobile_artisan.id)

    # Seed product for this artisan
    p1 = Product(
        id=f"prod-{uuid.uuid4().hex[:8]}",
        artisan_id=test_mobile_artisan.id,
        cluster_id=test_mobile_artisan.cluster_id,
        title="Bastar Brass Horse",
        craft_type="Bastar Dhokra",
        technique="Lost-Wax Casting",
        cost_materials=450.0,
        labor_hours=32.0,
        hourly_wage_rate=50.0,
        listing_price=2800.0,
        floor_price=1600.0,
        recommended_retail_price=3200.0,
        wholesale_b2b_price=2100.0,
        stock_quantity=4,
    )
    db.add(p1)
    db.commit()

    response = client.get("/api/v1/products/artisan/my", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    found = next((item for item in data if item["id"] == p1.id), None)
    assert found is not None
    assert found["title"] == "Bastar Brass Horse"
    assert found["listing_price"] == 2800.0
    assert found["stock_quantity"] == 4


# ---------------------------------------------------------------------------
# Test 3: Mobile Artisan Orders & Revenue Contract (GET /orders/artisan)
# ---------------------------------------------------------------------------
def test_mobile_artisan_orders_contract(client, db, test_mobile_artisan):
    headers = artisan_auth_header(test_mobile_artisan.id)

    # Seed an order for this artisan
    order = Order(
        id=f"order-{uuid.uuid4().hex[:8]}",
        order_number=f"ORD-{uuid.uuid4().hex[:6]}",
        artisan_id=test_mobile_artisan.id,
        customer_id="cust-123",
        product_id="prod-any",
        product_title="Bastar Brass Horse",
        quantity=2,
        total_price=5600.0,
        status="confirmed",
        payment_status="paid",
    )
    db.add(order)
    db.commit()

    response = client.get("/api/v1/orders/artisan", headers=headers)
    assert response.status_code == 200
    orders = response.json()
    assert isinstance(orders, list)
    found = next((o for o in orders if o["id"] == order.id), None)
    assert found is not None
    assert found["total_price"] == 5600.0
    assert found["status"] == "confirmed"


# ---------------------------------------------------------------------------
# Test 4: Mobile Studio Photo Upload Contract (POST /products/studio)
# ---------------------------------------------------------------------------
def test_mobile_studio_upload_contract(client, test_mobile_artisan):
    headers = artisan_auth_header(test_mobile_artisan.id)
    jpeg_bytes = _create_sample_jpeg_bytes()

    response = client.post(
        "/api/v1/products/studio",
        files={"image": ("craft_photo.jpg", jpeg_bytes, "image/jpeg")},
        data={"canvas_size": 1080},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "studio_image_url" in data
    assert "before_after_preview_url" in data
    assert "metadata" in data
    assert data["studio_image_url"].startswith("/static/studio/")
    assert data["before_after_preview_url"].startswith("/static/studio/")


# ---------------------------------------------------------------------------
# Test 5: Mobile Voice-to-Catalog Contract (POST /products/voice-catalog)
# ---------------------------------------------------------------------------
def test_mobile_voice_catalog_contract(client, test_mobile_artisan):
    headers = artisan_auth_header(test_mobile_artisan.id)
    sample_wav_path = AUDIO_FIXTURES_DIR / "hindi_dhokra_horse.wav"
    assert sample_wav_path.exists()

    with open(sample_wav_path, "rb") as f:
        wav_bytes = f.read()

    response = client.post(
        "/api/v1/products/voice-catalog",
        files={"audio": ("hindi_dhokra_horse.wav", wav_bytes, "audio/wav")},
        data={"language_code": "hi"},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "attributes" in data or "extracted_attributes" in data or "raw_transcript" in data

    # Check pricing estimates or fields
    if "pricing" in data:
        pricing = data["pricing"]
        assert "cost_floor" in pricing or "floor_price" in pricing
    elif "extracted_attributes" in data:
        assert data["extracted_attributes"] is not None


# ---------------------------------------------------------------------------
# Test 6: Mobile Master AI Orchestrator Contract (POST /ai/assistant/orchestrate)
# ---------------------------------------------------------------------------
def test_mobile_orchestrate_pipeline_contract(client, test_mobile_artisan):
    headers = artisan_auth_header(test_mobile_artisan.id)

    response = client.post(
        "/api/v1/ai/assistant/orchestrate",
        json={
            "raw_input": "यह बस्तर ढोकरा का पीतल का घोड़ा है, चार दिन लगे, दो हजार रुपये दाम है।",
            "region": "Chhattisgarh",
            "language": "hi",
        },
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "title_en" in data or "title" in data
    assert "title_hi" in data
    assert "pricing" in data
    pricing = data["pricing"]
    floor = pricing.get("cost_estimate") or pricing.get("cost_floor")
    assert floor is not None and floor > 0
    retail_min = pricing.get("market_range_min") or pricing.get("suggested_retail_min")
    assert retail_min is not None and retail_min >= floor


# ---------------------------------------------------------------------------
# Test 7: Mobile Product Publish with Price Floor Guardrail (POST /products)
# ---------------------------------------------------------------------------
def test_mobile_publish_product_floor_enforcement(client, test_mobile_artisan):
    headers = artisan_auth_header(test_mobile_artisan.id)

    # 1. Attempt to publish BELOW cost floor -> Must be rejected with HTTP 422
    invalid_product = {
        "title": "Exploitative Low Priced Dhokra Horse",
        "craft_type": "Bastar Dhokra",
        "technique": "Lost-Wax Casting",
        "cost_materials": 450.0,
        "labor_hours": 32.0,
        "listing_price": 500.0,  # Below statutory floor
        "stock_quantity": 1,
        "cluster_id": test_mobile_artisan.cluster_id,
        "artisan_id": test_mobile_artisan.id,
    }
    fail_res = client.post("/api/v1/products", json=invalid_product, headers=headers)
    assert fail_res.status_code == 422
    assert "PRICE_BELOW_STATUTORY_FLOOR" in fail_res.text or "floor" in fail_res.text.lower()

    # 2. Publish with FAIR PRICE >= cost floor -> Must succeed with HTTP 201
    valid_product = {
        "title": "Artisanal Bastar Dhokra Tribal Horse",
        "craft_type": "Bastar Dhokra",
        "technique": "Lost-Wax Casting",
        "cost_materials": 450.0,
        "labor_hours": 32.0,
        "listing_price": 2850.0,  # Above floor
        "stock_quantity": 3,
        "cluster_id": test_mobile_artisan.cluster_id,
        "artisan_id": test_mobile_artisan.id,
        "description_hindi": "पारंपरिक बस्तर ढोकरा पीतल का घोड़ा",
        "description_english": "Authentic handcrafted Bastar Dhokra tribal horse.",
    }
    success_res = client.post("/api/v1/products", json=valid_product, headers=headers)
    assert success_res.status_code == 201
    created = success_res.json()
    assert created["title"] == "Artisanal Bastar Dhokra Tribal Horse"
    assert created["listing_price"] == 2850.0
    assert created["artisan_id"] == test_mobile_artisan.id


# ---------------------------------------------------------------------------
# Test 8: End-to-End Studio Enhancement -> Product Publish Contract
# ---------------------------------------------------------------------------
def test_studio_upload_and_product_publish_integration(client, test_mobile_artisan):
    """Verifies that studio-processed photo is saved and published with the product listing."""
    headers = artisan_auth_header(test_mobile_artisan.id)
    jpeg_bytes = _create_sample_jpeg_bytes()

    # 1. Process craft photo through AI Studio pipeline
    studio_res = client.post(
        "/api/v1/products/studio",
        files={"image": ("craft_photo.jpg", jpeg_bytes, "image/jpeg")},
        data={"canvas_size": 1080},
        headers=headers,
    )
    assert studio_res.status_code == 200
    studio_data = studio_res.json()
    studio_url = studio_data["studio_image_url"]
    assert studio_url.startswith("/static/studio/")

    # 2. Publish product carrying the AI Studio image URL
    product_payload = {
        "title": "Studio Verified Dhokra Figurine",
        "craft_type": "Bastar Dhokra",
        "technique": "Lost-Wax Casting",
        "cost_materials": 300.0,
        "labor_hours": 16.0,
        "listing_price": 1950.0,
        "stock_quantity": 4,
        "cluster_id": test_mobile_artisan.cluster_id,
        "artisan_id": test_mobile_artisan.id,
        "studio_image_url": studio_url,
    }
    publish_res = client.post("/api/v1/products", json=product_payload, headers=headers)
    assert publish_res.status_code == 201
    product = publish_res.json()
    assert product["studio_image_url"] == studio_url

