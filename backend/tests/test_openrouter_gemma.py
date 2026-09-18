import io
import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.openrouter_service import openrouter_service, OpenRouterService
from app.schemas.image_understanding import ImageUnderstandingResponse
from app.schemas.voice import VoiceCatalogResponse


@pytest.fixture
def client():
    return TestClient(app)


class TestOpenRouterGemmaIntegration:
    """Test suite for OpenRouter Gemma 4 31B Catalogue Generation & Multimodal Vision."""

    def test_openrouter_service_config(self):
        """Verifies OpenRouter Gemma 4 31B is properly configured in settings."""
        assert settings.OPENROUTER_MODEL == "google/gemma-4-31b-it:free"
        if settings.OPENROUTER_API_KEY:
            assert len(settings.OPENROUTER_API_KEY) > 10
        assert openrouter_service.model == "google/gemma-4-31b-it:free"

    def test_openrouter_catalog_generation_fallback(self):
        """Verifies catalog generation succeeds and adheres to VoiceCatalogResponse schema."""
        transcript = "यह बस्तर का पारंपरिक ढोकरा पीतल का घोड़ा है जो चार दिन में लॉस्ट वैक्स तकनीक से बना है।"
        res = openrouter_service.generate_catalog(transcript, language_code="hi")

        assert isinstance(res, VoiceCatalogResponse)
        assert res.attributes.craft_type in ["Bastar Dhokra", "Traditional Craft"]
        assert len(res.attributes.materials) >= 1
        assert res.attributes.production_time_days >= 1.0
        assert len(res.marketing_description.hi) > 0
        assert len(res.marketing_description.en) > 0
        assert len(res.seo_tags) >= 5

    def test_openrouter_catalog_generation_with_llm_json_response(self):
        """Verifies strict JSON parsing and schema normalization from Gemma 4 response."""
        mock_gemma_json = json.dumps({
            "product_name": "Authentic Bastar Bell Metal Horse",
            "craft_type": "Bastar Dhokra",
            "materials": ["Brass", "Bell Metal", "Beeswax"],
            "dimensions": "16cm x 12cm x 7cm",
            "production_time_days": 4.5,
            "technique": "Lost-Wax Casting",
            "color": "Antique Golden Bronze",
            "marketing_description": {
                "hi": "मास्टर आदिवासी कारीगरों द्वारा हस्तनिर्मित बस्तर ढोकरा पीतल का घोड़ा।",
                "en": "Exquisite hand-cast Bastar Dhokra brass figurine handcrafted by tribal artisans."
            },
            "seo_tags": ["Bastar Dhokra", "Bell Metal", "Handcrafted", "Tribal Art", "MoSJE Certified"]
        })

        with patch.object(openrouter_service, "_call_openrouter", return_value=mock_gemma_json):
            res = openrouter_service.generate_catalog("कुछ विवरण", language_code="hi")

            assert res.attributes.product_name == "Authentic Bastar Bell Metal Horse"
            assert res.attributes.craft_type == "Bastar Dhokra"
            assert res.attributes.production_time_days == 4.5
            assert "Brass" in res.attributes.materials
            assert len(res.seo_tags) >= 5
            assert res.is_offline_mock is False

    def test_openrouter_image_understanding_multimodal_vision(self):
        """Verifies multimodal image analysis returns complete ImageUnderstandingResponse."""
        dummy_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"

        res = openrouter_service.analyze_craft_image(
            image_bytes=dummy_png,
            mime_type="image/png",
            hint="Bastar Dhokra brass craft"
        )

        assert isinstance(res, ImageUnderstandingResponse)
        assert res.success is True
        assert res.craft_type == "Bastar Dhokra"
        assert len(res.materials) >= 2
        assert res.suggested_retail_price > 0
        assert res.estimated_production_days >= 1.0
        assert res.visual_quality_score >= 7.0
        assert "google/gemma-4-31b-it:free" in res.model

    def test_openrouter_image_understanding_silk_hint(self):
        """Verifies silk saree detection and pricing logic."""
        dummy_jpg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"

        res = openrouter_service.analyze_craft_image(
            image_bytes=dummy_jpg,
            mime_type="image/jpeg",
            hint="Varanasi Silk Saree"
        )

        assert res.craft_type == "Varanasi Silk"
        assert res.suggested_retail_price >= 10000
        assert "Katan Silk" in " ".join(res.materials)

    def test_openrouter_rate_limit_429_resilience(self):
        """Verifies simulated 429 upstream rate limit does not crash and uses graceful fallback."""
        with patch.object(openrouter_service, "_call_openrouter", return_value=None):
            # Should not raise exception when craft description is provided
            res = openrouter_service.generate_catalog("यह बस्तर का ढोकरा पीतल का शिल्प है", language_code="hi")
            assert res is not None
            assert res.attributes.craft_type == "Bastar Dhokra"

            # Multimodal should also gracefully fallback
            dummy_bytes = b"\x00" * 50
            vision_res = openrouter_service.analyze_craft_image(dummy_bytes, hint="pottery")
            assert vision_res.success is True
            assert vision_res.craft_type == "Khurja Pottery"

    def test_api_endpoint_analyze_image(self, client):
        """TC-VISION-01: Verifies POST /api/v1/products/analyze-image endpoint."""
        from app.core.security import create_access_token
        auth_token = create_access_token("artisan-user-123", extra_claims={"app_metadata": {"role": "artisan"}})
        dummy_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"

        res = client.post(
            "/api/v1/products/analyze-image",
            files={"image": ("craft.png", dummy_png, "image/png")},
            data={"hint": "Bastar Dhokra brass art"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["craft_type"] == "Bastar Dhokra"
        assert "product_name_hi" in data
        assert "product_name_en" in data
        assert "suggested_retail_price" in data
        assert data["suggested_retail_price"] > 0
        assert "google/gemma-4-31b-it:free" in data["model"]

    def test_api_endpoint_extract_catalog_with_gemma_pipeline(self, client):
        """TC-VISION-02: Verifies /api/v1/voice/extract-catalog integrates Gemma 4."""
        from app.core.security import create_access_token
        auth_token = create_access_token("artisan-user-123", extra_claims={"app_metadata": {"role": "artisan"}, "email": "artisan@crafts.gov.in"})
        res = client.post(
            "/api/v1/voice/extract-catalog",
            json={"transcript": "यह वाराणसी की शुद्ध कातान सिल्क साड़ी है, 5 दिन लगे, 1200 रुपये लागत", "language_code": "hi-IN"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        attrs = data["attributes"]
        assert attrs["craft_type"] == "Varanasi Silk"
        assert attrs["recommended_price"] >= attrs["wage_floor"]
