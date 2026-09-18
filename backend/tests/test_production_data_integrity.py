import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.models.artisan import Artisan
from app.api.v1.b2b import b2b_matching_service
from app.api.v1.products import openrouter_service
from app.services.b2b_matching_service import B2BMatchingService
from app.services.openrouter_service import OpenRouterService
from app.schemas.b2b import (
    B2BMatchResponse,
    B2BArtisanMatchItem,
    B2BMatchScoreBreakdown,
)
from app.schemas.image_understanding import ImageUnderstandingResponse


@pytest.fixture(autouse=True)
def init_test_db():
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


@pytest.fixture
def b2b_auth_token():
    return create_access_token(
        "buyer-test-01",
        extra_claims={
            "app_metadata": {"role": "buyer"},
            "email": "procurement@verifiedbuyer.org",
        },
    )


class TestProductionDataIntegrity:
    """Rigorous tests ensuring zero silent mock fallbacks or invalid artisan substitutions in production."""

    def test_b2b_candidate_artisans_production_uses_only_db(self, db, monkeypatch):
        """In production (OFFLINE_MODE=False), candidates must come ONLY from verified DB artisans."""
        monkeypatch.setattr(settings, "OFFLINE_MODE", False)

        service = B2BMatchingService()
        candidates = service.get_candidate_artisans(db=db)

        # Ensure all returned candidates correspond to real DB records
        active_db_ids = {a.id for a in db.query(Artisan).filter(Artisan.is_active == True).all()}
        for cand in candidates:
            assert cand["id"] in active_db_ids, f"Candidate {cand['id']} was not found in verified DB active artisans!"

    def test_b2b_match_no_invalid_artisan_substitution(self, client, db, b2b_auth_token, monkeypatch):
        """If a candidate match has an artisan_id not found in the DB, it must NEVER be substituted with an unrelated artisan."""
        monkeypatch.setattr(settings, "OFFLINE_MODE", False)

        real_artisan = db.query(Artisan).filter(Artisan.is_active == True).first()
        fake_id = "00000000-0000-0000-0000-000000000000"

        fake_item = B2BArtisanMatchItem(
            artisan_id=fake_id,
            artisan_name="Ghost Artisan",
            cluster_name="Ghost Cluster",
            state="Unknown",
            location="Delhi, India",
            match_percentage=95.0,
            capacity_feasible=True,
            estimated_production_days=15,
            offered_wholesale_price=1100.0,
            distance_km=10.0,
            match_explanation="Ghost match",
            breakdown=B2BMatchScoreBreakdown(
                craft_compatibility=95.0,
                price_compatibility=90.0,
                capacity_feasibility=95.0,
                location_score=90.0,
            ),
        )
        fake_response = B2BMatchResponse(
            rfq_id="test-rfq-01",
            rfq_summary={
                "craft_type": "Bastar Dhokra",
                "required_quantity": 50,
                "unit_budget": 1200.0,
                "days_to_deadline": 30,
            },
            total_matches_found=1,
            matches=[fake_item],
        )

        with patch.object(b2b_matching_service, "match_rfq", return_value=fake_response):
            res = client.post(
                "/api/v1/b2b/rfq",
                json={
                    "craft_type": "Bastar Dhokra",
                    "required_quantity": 50,
                    "unit_budget": 1200.0,
                    "deadline_days": 30,
                    "delivery_state": "Delhi",
                },
                headers={"Authorization": f"Bearer {b2b_auth_token}"},
            )
            assert res.status_code == 201
            data = res.json()
            persisted_matched_ids = [m["artisan_id"] for m in data.get("matched_artisans", [])]
            # Ensure fake_id was not silently substituted with an existing DB artisan's ID
            if real_artisan:
                assert real_artisan.id not in persisted_matched_ids

    def test_openrouter_image_analysis_production_failure_no_heuristic_fallback(self, monkeypatch):
        """In production, missing API key or upstream failure must return success=False and an error, not heuristic success."""
        monkeypatch.setattr(settings, "OFFLINE_MODE", False)
        monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")

        service = OpenRouterService()
        result = service.analyze_craft_image(image_bytes=b"dummy-image-bytes")

        assert result.success is False
        assert "VISION_SERVICE_UNAVAILABLE" in (result.error or "")

    def test_openrouter_generate_catalog_production_failure_raises(self, monkeypatch):
        """In production, catalog generation failure must raise ValueError and not invoke offline mock engine."""
        monkeypatch.setattr(settings, "OFFLINE_MODE", False)
        monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")

        service = OpenRouterService()
        with pytest.raises(ValueError, match="CATALOG_GENERATION_FAILED"):
            service.generate_catalog(transcript="कुछ सुंदर खिलौने")

    def test_api_analyze_image_returns_502_on_service_failure(self, client, monkeypatch):
        """Endpoint /api/v1/products/analyze-image must return 502 when OpenRouter fails in production."""
        monkeypatch.setattr(settings, "OFFLINE_MODE", False)

        fake_err_resp = ImageUnderstandingResponse(
            success=False,
            error="AI provider service unavailable",
        )
        from app.core.security import create_access_token
        auth_token = create_access_token("artisan-user-123", extra_claims={"app_metadata": {"role": "artisan"}})
        with patch.object(
            openrouter_service,
            "analyze_craft_image",
            return_value=fake_err_resp,
        ):
            res = client.post(
                "/api/v1/products/analyze-image",
                files={"image": ("test.jpg", b"\xff\xd8\xff\xe0dummyjpgdata", "image/jpeg")},
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            assert res.status_code == 502
            assert "AI provider service unavailable" in res.json()["detail"]
