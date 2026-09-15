from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.models.artisan import Artisan
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
