import hashlib
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.models.artisan import Artisan
from app.models.consent_log import ConsentLog
from app.services.pricing_service import pricing_service


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


class TestSecurityAndDPDPCompliance:
    """R6: Enterprise Security & DPDP Compliance Test Suite."""

    def test_dpdp_consent_ledger_recording(self, client, db):
        """TC-SEC-01: Verifies explicit consent is recorded with SHA256 cryptographic provenance."""
        artisan = db.query(Artisan).first()
        artisan_id = artisan.id if artisan else "art-varanasi-001"
        token = create_access_token(artisan_id, extra_claims={"app_metadata": {"role": "artisan"}})
        res = client.post(
            "/api/v1/compliance/consent",
            json={
                "artisan_id": artisan_id,
                "consent_type": "VOICE_RECORDING",
                "granted": True,
                "purpose": "Acoustic transcription and smart catalog generation"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "recorded"
        assert "ledger_id" in data
        assert "consent_artifact_hash" in data
        assert len(data["consent_artifact_hash"]) == 64  # Valid SHA256 hex length

    def test_sovereign_data_erasure_requires_confirmation(self, client):
        """TC-SEC-02: Erasure without confirmation raises HTTP 400."""
        token = create_access_token("artisan-dpdp-test-02", extra_claims={"app_metadata": {"role": "artisan"}})
        res = client.post(
            "/api/v1/compliance/forget",
            json={
                "artisan_id": "artisan-dpdp-test-02",
                "confirmation": False
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 400
        assert "CONFIRMATION_REQUIRED" in res.json()["detail"]

    def test_sovereign_data_erasure_success(self, client, db):
        """TC-SEC-03: Confirmed erasure purges PII and creates audit log."""
        artisan = db.query(Artisan).filter(Artisan.id == "art-varanasi-001").first()
        if not artisan:
            artisan = db.query(Artisan).first()
        assert artisan is not None, "At least one artisan must exist in DB for DPDP erasure test"
        artisan_id = artisan.id
        token = create_access_token(artisan_id, extra_claims={"app_metadata": {"role": "artisan"}})

        res = client.post(
            "/api/v1/compliance/forget",
            json={
                "artisan_id": artisan_id,
                "confirmation": True,
                "reason": "Artisan requested deletion under DPDP Act 2023 Section 12"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["artisan_id"] == artisan_id
        assert data["records_redacted"] >= 1

        # Direct database state assertion: PII must be genuinely redacted and account deactivated
        db.expire_all()
        artisan_after = db.query(Artisan).filter(Artisan.id == artisan_id).first()
        assert artisan_after is not None
        assert artisan_after.full_name == "REDACTED_ARTISAN"
        assert artisan_after.masked_aadhaar == "XXXXXXXX0000"
        assert artisan_after.is_active is False
        assert artisan_after.village == "REDACTED"
        assert artisan_after.district == "REDACTED"
        assert artisan_after.phone_number.startswith("REDACTED_")

        # Verify audit entry in ConsentLog
        audit_log = db.query(ConsentLog).filter(
            ConsentLog.artisan_id == artisan_id,
            ConsentLog.consent_type == "RIGHT_TO_BE_FORGOTTEN"
        ).first()
        assert audit_log is not None
        assert audit_log.granted is True
        assert audit_log.consent_artifact_type == "ERASURE_DIRECTIVE"

    def test_sovereign_data_erasure_nonexistent_artisan_404(self, client):
        """TC-SEC-06: Erasure for non-existent artisan ID returns HTTP 404."""
        token = create_access_token("nonexistent-artisan-dpdp-404", extra_claims={"app_metadata": {"role": "artisan"}})
        res = client.post(
            "/api/v1/compliance/forget",
            json={
                "artisan_id": "nonexistent-artisan-dpdp-404",
                "confirmation": True
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 404
        assert "ARTISAN_NOT_FOUND" in res.json()["detail"]

    def test_price_floor_guardrail_rejection_http422(self, client):
        """TC-SEC-04: Enforces HTTP 422 rejection when listing price is below certified cost-plus floor."""
        from app.core.security import create_access_token
        artisan_token = create_access_token("artisan-bastar-001", extra_claims={"app_metadata": {"role": "artisan"}})
        headers = {"Authorization": f"Bearer {artisan_token}"}
        # For Bastar Dhokra: raw materials ₹400 + (8 hrs * ₹120) + ₹40 overhead = ₹1400 Floor!
        # Predatory listing price: ₹500
        res = client.post(
            "/api/v1/products",
            json={
                "title": "Exploitative Underpriced Dhokra Horse",
                "craft_type": "Bastar Dhokra",
                "artisan_id": "artisan-bastar-001",
                "cluster_id": "cluster-bastar-dhokra-01",
                "cost_materials": 400.0,
                "labor_hours": 8.0,
                "hourly_wage_rate": 120.0,
                "technique": "Lost-Wax Casting",
                "listing_price": 500.0  # Certified floor is 1400.0!
            },
            headers=headers
        )
        assert res.status_code == 422, f"Expected 422 rejection, got {res.status_code}"
        assert "PRICE_BELOW_STATUTORY_FLOOR" in res.json()["detail"]

    def test_price_floor_guardrail_acceptance_fair_price(self, client):
        """TC-SEC-05: Product listing priced >= cost-plus floor price is accepted (HTTP 201)."""
        from app.core.security import create_access_token
        artisan_token = create_access_token("artisan-bastar-001", extra_claims={"app_metadata": {"role": "artisan"}})
        headers = {"Authorization": f"Bearer {artisan_token}"}
        # Certified floor is ₹1400. Fair listing price: ₹2850.
        res = client.post(
            "/api/v1/products",
            json={
                "title": "Certified Fair Price Dhokra Horse",
                "craft_type": "Bastar Dhokra",
                "artisan_id": "artisan-bastar-001",
                "cluster_id": "cluster-bastar-dhokra-01",
                "cost_materials": 400.0,
                "labor_hours": 8.0,
                "hourly_wage_rate": 120.0,
                "technique": "Lost-Wax Casting",
                "listing_price": 2850.0  # Above floor 1400.0!
            },
            headers=headers
        )
        assert res.status_code == 201
        data = res.json()
        assert data["floor_price"] == 1400.0
        assert data["listing_price"] == 2850.0
        assert data["is_active"] is True

