from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.models.artisan import Artisan
from app.models.product import Product
from app.models.order import Order
from app.models.b2b_rfq import B2BRFQ
from app.services.correction_feedback_service import correction_feedback_service


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def initialize_test_db():
    init_db()


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def auth_header(subject: str, role: str = "customer", **claims):
    payload = {"app_metadata": {"role": role}, **claims}
    return {"Authorization": f"Bearer {create_access_token(subject, extra_claims=payload)}"}


def test_user_metadata_admin_claim_is_not_authorization(client):
    token = create_access_token(
        "untrusted-subject",
        extra_claims={"user_metadata": {"role": "admin"}},
    )
    response = client.get("/api/v1/ai/assistant/observability", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


def test_admin_claim_requires_configured_subject_id(client):
    response = client.get(
        "/api/v1/ai/assistant/observability",
        headers=auth_header("unlisted-admin", "admin"),
    )
    assert response.status_code == 403


def test_token_requires_valid_issuer_audience_and_expiry(client):
    wrong_issuer = create_access_token(
        "admin-001",
        extra_claims={"app_metadata": {"role": "admin"}, "iss": "https://invalid.example/auth/v1"},
    )
    expired = create_access_token(
        "admin-001",
        expires_delta=timedelta(seconds=-1),
        extra_claims={"app_metadata": {"role": "admin"}},
    )

    assert client.get("/api/v1/ai/assistant/observability", headers={"Authorization": f"Bearer {wrong_issuer}"}).status_code == 401
    assert client.get("/api/v1/ai/assistant/observability", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_privacy_endpoints_reject_anonymous_and_cross_artisan_requests(client, db):
    artisan = db.query(Artisan).first()
    if artisan is None:
        artisan = Artisan(
            id="art-owned-by-test",
            full_name="Security Test Artisan",
            phone_number="9000000001",
            masked_aadhaar="XXXXXXXX0001",
            aadhaar_hash="test-aadhaar-hash-0001",
            cluster_id="cluster-test",
            state="Test State",
            district="Test District",
            latitude=0.0,
            longitude=0.0,
            primary_craft="Test Craft",
        )
        db.add(artisan)
        db.commit()

    payload = {
        "artisan_id": artisan.id,
        "consent_type": "VOICE_RECORDING",
        "granted": True,
        "purpose": "catalog generation",
    }
    assert client.post("/api/v1/compliance/consent", json=payload).status_code == 401
    assert client.post("/api/v1/compliance/consent", json=payload, headers=auth_header("another-artisan", "artisan")).status_code == 403
    assert client.post(
        "/api/v1/compliance/forget",
        json={"artisan_id": artisan.id, "confirmation": True},
        headers=auth_header("another-artisan", "artisan"),
    ).status_code == 403


def test_ai_curation_endpoints_reject_anonymous_and_non_admin(client):
    assert client.get("/api/v1/ai/assistant/feedback/pending").status_code == 401
    assert client.get("/api/v1/ai/assistant/observability").status_code == 401
    assert client.post("/api/v1/ai/assistant/dataset/export-finetuning").status_code == 401
    assert client.get("/api/v1/ai/assistant/feedback/pending", headers=auth_header("art-001", "artisan")).status_code == 403


def test_feedback_uses_authenticated_artisan_subject(client, monkeypatch, tmp_path):
    monkeypatch.setattr(correction_feedback_service, "pending_file", str(tmp_path / "pending.jsonl"))
    response = client.post(
        "/api/v1/ai/assistant/feedback",
        headers=auth_header("art-001", "artisan"),
        json={
            "artisan_id": "victim-artisan",
            "craft_type": "Pottery",
            "field_name": "materials",
            "ai_prediction": "Unknown",
            "artisan_correction": "Clay",
        },
    )
    assert response.status_code == 200
    assert response.json()["record"]["artisan_id"] == "art-001"


def test_configured_admin_can_inspect_global_feedback(client):
    response = client.get(
        "/api/v1/ai/assistant/feedback/pending",
        headers=auth_header("admin-001", "admin"),
    )
    assert response.status_code == 200


def test_unlisted_admin_claim_downgraded_and_denied_artisan_and_admin_endpoints(client):
    """Unlisted subject claiming admin in JWT is downgraded to customer and denied artisan/admin access."""
    # Attempt artisan earnings
    res = client.get("/api/v1/earnings", headers=auth_header("unlisted-subj", "admin"))
    assert res.status_code == 403
    assert "FORBIDDEN" in res.json()["detail"]

    # Attempt artisan product creation
    res = client.post(
        "/api/v1/products",
        headers=auth_header("unlisted-subj", "admin"),
        json={
            "title": "Unauthorized Craft",
            "craft_type": "Khurja Pottery",
            "artisan_id": "unlisted-subj",
            "cluster_id": "cluster-khurja-pottery-01",
            "cost_materials": 100.0,
            "labor_hours": 4.0,
            "listing_price": 800.0,
        },
    )
    assert res.status_code == 403

    # Attempt admin endpoint
    res = client.get("/api/v1/admin/applications", headers=auth_header("unlisted-subj", "admin"))
    assert res.status_code == 403


def test_unlisted_admin_cannot_delete_or_modify_other_artisan_product(client, db):
    """An unlisted admin token cannot delete another artisan's product."""
    prod = Product(
        id="prod-sec-test-01",
        artisan_id="art-001",
        cluster_id="cluster-varanasi-silk-01",
        title="Banarasi Silk Dupatta",
        craft_type="Varanasi Silk",
        materials=["Silk"],
        dimensions="2m x 1m",
        production_time_hours=24,
        technique="Handloom",
        dominant_colors=["Red"],
        cost_materials=500.0,
        labor_hours=10.0,
        hourly_wage_rate=150.0,
        floor_price=2000.0,
        recommended_retail_price=3500.0,
        wholesale_b2b_price=2500.0,
        listing_price=3000.0,
        stock_quantity=5,
        description_hindi="सिल्क दुपट्टा",
        description_english="Silk Dupatta",
        seo_tags_hindi=["दुपट्टा"],
        seo_tags_english=["Dupatta"],
        is_active=True,
    )
    db.merge(prod)
    db.commit()

    # Customer tries to delete
    res = client.delete("/api/v1/products/prod-sec-test-01", headers=auth_header("cust-001", "customer"))
    assert res.status_code == 403

    # Unlisted admin tries to delete
    res = client.delete("/api/v1/products/prod-sec-test-01", headers=auth_header("unlisted-admin", "admin"))
    assert res.status_code == 403

    # Another artisan tries to delete
    res = client.delete("/api/v1/products/prod-sec-test-01", headers=auth_header("art-002", "artisan"))
    assert res.status_code == 403

    # Verified admin can delete
    res = client.delete("/api/v1/products/prod-sec-test-01", headers=auth_header("admin-001", "admin"))
    assert res.status_code == 200


def test_order_ownership_isolation_and_status_transitions(client, db):
    """Orders are strictly isolated: single order GET and status PUT enforce ownership."""
    order = Order(
        id="ord-sec-test-01",
        order_number="HN-2026-TEST01",
        customer_id="cust-001",
        artisan_id="art-001",
        product_id="prod-varanasi-001",
        product_title="Silk Saree",
        quantity=1,
        total_price=5000.0,
        status="confirmed",
    )
    db.merge(order)
    db.commit()

    # Customer B cannot view order
    res = client.get("/api/v1/orders/ord-sec-test-01", headers=auth_header("cust-002", "customer"))
    assert res.status_code == 403

    # Customer B cannot update order status
    res = client.put(
        "/api/v1/orders/ord-sec-test-01/status",
        headers=auth_header("cust-002", "customer"),
        json={"status": "cancelled"},
    )
    assert res.status_code == 403

    # Customer A (owner) can view order
    res = client.get("/api/v1/orders/ord-sec-test-01", headers=auth_header("cust-001", "customer"))
    assert res.status_code == 200
    assert res.json()["id"] == "ord-sec-test-01"

    # Customer A cannot change status to 'shipped' (only cancel allowed)
    res = client.put(
        "/api/v1/orders/ord-sec-test-01/status",
        headers=auth_header("cust-001", "customer"),
        json={"status": "shipped"},
    )
    assert res.status_code == 403

    # Artisan owner (art-001) can change status to 'processing'
    res = client.put(
        "/api/v1/orders/ord-sec-test-01/status",
        headers=auth_header("art-001", "artisan"),
        json={"status": "processing"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "processing"


def test_rfq_ownership_zero_exposure_and_deletion(client, db):
    """RFQs isolate buyer email from unverified users and allow deletion only by creator or verified admin."""
    rfq = B2BRFQ(
        id="rfq-sec-test-01",
        buyer_name="Institutional Buyer",
        buyer_organization="FabIndia Procurement",
        buyer_email="procurement@fabindia.com",
        buyer_phone="+919999999999",
        craft_type="Varanasi Silk",
        required_quantity=50,
        unit_budget=4000.0,
        total_budget=200000.0,
        deadline_days=30,
        delivery_state="Delhi",
        delivery_district="New Delhi",
        delivery_latitude=28.61,
        delivery_longitude=77.20,
        status="OPEN",
    )
    db.merge(rfq)
    db.commit()

    # Unauthenticated user cannot see buyer email
    res = client.get("/api/v1/b2b/rfq/rfq-sec-test-01")
    assert res.status_code == 200
    assert res.json()["buyer_email"] is None

    # Unlisted admin user cannot see unmasked buyer email
    res = client.get(
        "/api/v1/b2b/rfq/rfq-sec-test-01",
        headers=auth_header("unlisted-admin", "admin", email="hacker@fake.com"),
    )
    assert res.status_code == 200
    assert res.json()["buyer_email"] is None

    # Buyer creator can see unmasked buyer email
    res = client.get(
        "/api/v1/b2b/rfq/rfq-sec-test-01",
        headers=auth_header("buyer-user", "customer", email="procurement@fabindia.com"),
    )
    assert res.status_code == 200
    assert res.json()["buyer_email"] == "procurement@fabindia.com"

    # Unrelated user cannot delete RFQ
    res = client.delete(
        "/api/v1/b2b/rfq/rfq-sec-test-01",
        headers=auth_header("attacker", "customer", email="attacker@evil.com"),
    )
    assert res.status_code == 403

    # Creator can delete RFQ
    res = client.delete(
        "/api/v1/b2b/rfq/rfq-sec-test-01",
        headers=auth_header("buyer-user", "customer", email="procurement@fabindia.com"),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "deleted"


def test_destructive_erasure_requires_artisan_role_and_prevents_customer_erasure(client, db):
    """Customer cannot call DELETE /compliance/artisan/{id} even if their subject ID matches."""
    artisan = db.query(Artisan).first()
    if not artisan:
        artisan = Artisan(
            id="art-varanasi-001",
            full_name="Security Test Artisan",
            phone_number="9000000001",
            masked_aadhaar="XXXXXXXX0001",
            aadhaar_hash="test-aadhaar-hash-0001",
            cluster_id="cluster-bastar-dhokra-01",
            state="Chhattisgarh",
            district="Bastar",
            latitude=19.07,
            longitude=82.03,
            primary_craft="Bastar Dhokra",
        )
        db.add(artisan)
        db.commit()
        db.refresh(artisan)

    # Customer with matching ID calls artisan delete -> 403 Forbidden!
    res = client.delete(
        f"/api/v1/compliance/artisan/{artisan.id}",
        headers=auth_header(artisan.id, "customer"),
    )
    assert res.status_code == 403
    assert "FORBIDDEN" in res.json()["detail"]

    # Customer can delete their own customer data
    res = client.delete(
        "/api/v1/compliance/customer/cust-owner-01",
        headers=auth_header("cust-owner-01", "customer"),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    # Customer cannot delete another customer's data
    res = client.delete(
        "/api/v1/compliance/customer/victim-cust-01",
        headers=auth_header("cust-owner-01", "customer"),
    )
    assert res.status_code == 403

