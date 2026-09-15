import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token, mask_email
from app.models.b2b_rfq import B2BRFQ


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


def test_mask_email_utility():
    """Verify that mask_email correctly redacts email addresses."""
    assert mask_email(None) is None
    assert mask_email("") is None
    assert mask_email("invalid-email") is None
    assert mask_email("a@example.com") == "a***@example.com"
    assert mask_email("ab@example.com") == "a***@example.com"
    assert mask_email("buyer@crafts.gov.in") == "b***r@crafts.gov.in"
    assert mask_email("admin.platform@crafts.nic.in") == "a***m@crafts.nic.in"


def test_anonymous_rfq_list_has_zero_buyer_emails(client, db):
    """Verify anonymous GET /api/v1/b2b/rfq never leaks buyer_email."""
    # Ensure at least one RFQ exists in db
    rfq = db.query(B2BRFQ).first()
    if not rfq:
        client.post(
            "/api/v1/b2b/rfq",
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 50,
                "unit_budget": 1200.0,
                "buyer_name": "Test Institutional Buyer",
                "buyer_email": "private.buyer@trifed.gov.in",
                "buyer_phone": "+919876543210"
            }
        )

    res = client.get("/api/v1/b2b/rfq")
    assert res.status_code == 200
    rfqs = res.json()
    assert isinstance(rfqs, list)
    for item in rfqs:
        # PII Isolation Guarantee: buyer_email MUST be None for anonymous callers
        assert item.get("buyer_email") is None, f"Leaked buyer_email: {item.get('buyer_email')}"
        # buyer_phone must never even be in schema
        assert "buyer_phone" not in item


def test_anonymous_rfq_detail_has_zero_buyer_emails(client, db):
    """Verify anonymous GET /api/v1/b2b/rfq/{id} never leaks buyer_email."""
    res_create = client.post(
        "/api/v1/b2b/rfq",
        json={
            "craft_type": "Bastar Dhokra",
            "quantity": 10,
            "unit_budget": 1500.0,
            "buyer_name": "Secret Buyer Org",
            "buyer_email": "confidential.officer@gov.in",
            "buyer_phone": "+919876543210"
        }
    )
    assert res_create.status_code == 201
    created_id = res_create.json()["id"]

    # Anonymous inspection must have buyer_email redacted to None
    res_anon = client.get(f"/api/v1/b2b/rfq/{created_id}")
    assert res_anon.status_code == 200
    assert res_anon.json().get("buyer_email") is None


def test_authenticated_admin_can_view_rfq_buyer_email(client, db):
    """Verify authenticated administrator CAN view buyer_email for procurement coordination."""
    res_create = client.post(
        "/api/v1/b2b/rfq",
        json={
            "craft_type": "Bastar Dhokra",
            "quantity": 25,
            "unit_budget": 1800.0,
            "buyer_name": "Admin Coordination Buyer",
            "buyer_email": "official.coordinator@crafts.nic.in"
        }
    )
    assert res_create.status_code == 201
    created_id = res_create.json()["id"]

    # Mint admin JWT
    admin_token = create_access_token(
        subject="admin-test-uuid",
        extra_claims={"app_metadata": {"role": "admin"}, "email": "platform.admin@hunardhara.gov.in"}
    )

    res_admin = client.get(
        f"/api/v1/b2b/rfq/{created_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_admin.status_code == 200
    assert res_admin.json().get("buyer_email") == "official.coordinator@crafts.nic.in"


def test_public_clusters_contains_zero_pii(client):
    """Verify GET /api/v1/clusters contains no personal emails or phone numbers."""
    res = client.get("/api/v1/clusters")
    assert res.status_code == 200
    content_str = res.text.lower()
    assert "@gmail.com" not in content_str
    assert "@yahoo" not in content_str
    assert "phone" not in content_str
    assert "aadhaar" not in content_str


def test_public_products_contains_zero_pii(client):
    """Verify GET /api/v1/products contains no personal emails, phones, or bank info."""
    res = client.get("/api/v1/products")
    assert res.status_code == 200
    content_str = res.text.lower()
    assert "@gmail.com" not in content_str
    assert "bank" not in content_str
    assert "aadhaar" not in content_str
