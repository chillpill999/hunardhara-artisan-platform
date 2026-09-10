import os
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.voice_service import voice_service
from app.services.offline_mock_engine import offline_voice_engine


@pytest.fixture
def client():
    return TestClient(app)


class TestVoiceToCatalogEngine:
    """R2: Indic Voice-to-Catalog Engine Test Suite."""

    def test_voice_extraction_mandatory_attributes(self, sample_dhokra_audio_path):
        """TC-VOICE-01: Verifies extraction of all 7 mandatory craft attributes."""
        with open(sample_dhokra_audio_path, "rb") as f:
            audio_bytes = f.read()

        catalog = voice_service.process_audio_bytes(audio_bytes, filename="bastar_horse.wav")
        attrs = catalog.attributes

        assert attrs.product_name is not None and len(attrs.product_name) > 0
        assert attrs.craft_type == "Bastar Dhokra"
        assert isinstance(attrs.materials, list) and len(attrs.materials) >= 2
        assert "Brass" in attrs.materials
        assert attrs.dimensions is not None
        assert attrs.production_time_days >= 1.0
        assert attrs.technique is not None
        assert attrs.color is not None

    def test_voice_bilingual_marketing_descriptions(self, sample_khurja_opus_path):
        """TC-VOICE-02: Verifies bilingual marketing copy satisfy length & Devanagari constraints."""
        with open(sample_khurja_opus_path, "rb") as f:
            audio_bytes = f.read()

        catalog = voice_service.process_audio_bytes(audio_bytes, filename="khurja_pottery.opus")
        
        # English copy >= 50 chars
        assert len(catalog.marketing_description.en) >= 50
        # Hindi copy >= 50 chars and has Devanagari characters
        assert len(catalog.marketing_description.hi) >= 50
        devanagari_chars = [c for c in catalog.marketing_description.hi if '\u0900' <= c <= '\u097F']
        assert len(devanagari_chars) >= 20

        # Minimum 5 SEO tags
        assert len(catalog.seo_tags) >= 5

    def test_voice_silence_detection_rejection(self, sample_silence_audio_path):
        """TC-VOICE-03: Pure silence (< -60 dBFS) raises AUDIO_SILENT_OR_INCOMPREHENSIBLE."""
        with open(sample_silence_audio_path, "rb") as f:
            audio_bytes = f.read()

        with pytest.raises(ValueError) as exc:
            voice_service.process_audio_bytes(audio_bytes, filename="silence.wav")
        assert "AUDIO_SILENT_OR_INCOMPREHENSIBLE" in str(exc.value)

    def test_voice_noise_warning_confidence(self, sample_noisy_audio_path):
        """TC-VOICE-04: High noise level sets LOW_AUDIO_CONFIDENCE_BACKGROUND_NOISE warning."""
        with open(sample_noisy_audio_path, "rb") as f:
            audio_bytes = f.read()

        catalog = voice_service.process_audio_bytes(audio_bytes, filename="edge_noisy_market_snr3db.wav")
        assert catalog.warning == "LOW_AUDIO_CONFIDENCE_BACKGROUND_NOISE"
        assert catalog.attributes.craft_type is not None

    def test_voice_corrupt_opus_header_rejection(self, sample_corrupt_opus_path):
        """TC-VOICE-05: Corrupt opus header raises INVALID_AUDIO_FORMAT_OR_CORRUPT."""
        with open(sample_corrupt_opus_path, "rb") as f:
            audio_bytes = f.read()

        with pytest.raises(ValueError) as exc:
            voice_service.process_audio_bytes(audio_bytes, filename="corrupt.opus")
        assert "INVALID_AUDIO_FORMAT_OR_CORRUPT" in str(exc.value)

    def test_voice_endpoint_multipart_upload(self, client, sample_dhokra_audio_path):
        """TC-VOICE-06: Verifies POST /api/v1/products/voice-catalog endpoint."""
        with open(sample_dhokra_audio_path, "rb") as f:
            res = client.post(
                "/api/v1/products/voice-catalog",
                files={"audio": ("dhokra.wav", f, "audio/wav")},
                data={"language_code": "hi"}
            )
        assert res.status_code == 200
        data = res.json()
        assert "transcript_original" in data
        assert "transcript_english" in data
        assert data["attributes"]["craft_type"] == "Bastar Dhokra"
        assert len(data["seo_tags"]) >= 5
        assert data["is_offline_mock"] is True

    def test_voice_endpoint_silence_returns_400(self, client, sample_silence_audio_path):
        """TC-VOICE-07: Verifies silence audio returns HTTP 400."""
        with open(sample_silence_audio_path, "rb") as f:
            res = client.post(
                "/api/v1/products/voice-catalog",
                files={"audio": ("silence.wav", f, "audio/wav")},
                data={"language_code": "hi"}
            )
        assert res.status_code == 400
        assert "AUDIO_SILENT" in res.json()["detail"]

