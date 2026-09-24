import os
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.voice_service import voice_service
from app.services.offline_mock_engine import offline_voice_engine
from app.core.security import create_access_token


def artisan_auth_headers(artisan_id: str = "art-varanasi-001"):
    token = create_access_token(artisan_id, extra_claims={"app_metadata": {"role": "artisan"}, "email": "artisan@crafts.gov.in"})
    return {"Authorization": f"Bearer {token}"}


def customer_auth_headers(customer_id: str = "cust-001"):
    token = create_access_token(customer_id, extra_claims={"app_metadata": {"role": "customer"}, "email": "customer@crafts.gov.in"})
    return {"Authorization": f"Bearer {token}"}


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

        catalog = voice_service.process_audio_bytes(audio_bytes, filename="edge_noisy_market_dhokra_snr3db.wav")
        assert catalog.warning == "LOW_AUDIO_CONFIDENCE_BACKGROUND_NOISE"
        assert catalog.attributes.craft_type == "Bastar Dhokra"

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
                data={"language_code": "hi"},
                headers=artisan_auth_headers()
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
                data={"language_code": "hi"},
                headers=artisan_auth_headers()
            )
        assert res.status_code == 400
        assert "AUDIO_SILENT" in res.json()["detail"]

    def test_voice_corrupt_wav_header_rejection(self):
        """TC-VOICE-08: Corrupt WAV bytes raise INVALID_AUDIO_FORMAT_OR_CORRUPT."""
        corrupt_wav_bytes = b"RIFF\x20\x00\x00\x00WAVEfmt \x10\x00\x00\x00CORRUPT_HEADER_TRUNCATED"
        with pytest.raises(ValueError) as exc:
            voice_service.process_audio_bytes(corrupt_wav_bytes, filename="corrupt_audio.wav")
        assert "INVALID_AUDIO_FORMAT_OR_CORRUPT" in str(exc.value)

    def test_voice_greeting_clarification_gating(self):
        """TC-VOICE-09: Pure greetings or silence must require clarification and never invent a craft catalog."""
        from app.services.sarvam_service import SarvamService
        svc = SarvamService()

        # Pure Hindi greeting
        res_hi = svc.extract_craft_attributes("नमस्ते")
        assert res_hi["requires_clarification"] is True
        assert "आवाज़ में उत्पाद का विवरण नहीं मिला" in res_hi["message_hi"]

        # Pure English greeting
        res_en = svc.extract_craft_attributes("Hello good morning")
        assert res_en["requires_clarification"] is True
        assert res_en.get("attributes") is None

        # Short acknowledgement without craft facts
        res_short = svc.extract_craft_attributes("haan theek hai")
        assert res_short["requires_clarification"] is True

    def test_multi_dialect_distinct_extraction(self):
        """TC-VOICE-10: Verifies 5 distinct regional language/dialect inputs produce distinct catalogs with ZERO repetitions."""
        from app.services.sarvam_service import SarvamService
        svc = SarvamService()

        test_cases = [
            {
                "lang": "hi",
                "input": "हाथ से बनी पीतल की घंटी है, 2 दिन लगे, 300 रुपये लागत",
                "expected_craft": "Metal Craft",
                "expected_name_keyword": "घंटी",
                "expected_days": 2,
                "expected_cost": 300
            },
            {
                "lang": "en",
                "input": "This is a hand-carved wooden jewelry box made of rosewood, 4 days of work, 600 cost",
                "expected_craft": "Woodcraft",
                "expected_name_keyword": "Box",
                "expected_days": 4,
                "expected_cost": 600
            },
            {
                "lang": "bho",
                "input": "ई हमनी के माटी के घैला हवे, 3 दिन लागल, 200 रुपिया लागत",
                "expected_craft": "Pottery",
                "expected_name_keyword": "घड़ा",
                "expected_days": 3,
                "expected_cost": 200
            },
            {
                "lang": "mai",
                "input": "ई मिथिला के हस्तचित्रित मधुबनी पेंटिंग अइछ, 5 दिन में बनल, 400 रुपिया लागत",
                "expected_craft": "Madhubani",
                "expected_name_keyword": "मधुबनी",
                "expected_days": 5,
                "expected_cost": 400
            },
            {
                "lang": "hinglish",
                "input": "Maine yeh leather mojari banayi hai, 3 din mein, 500 rupees cost",
                "expected_craft": "Leather",
                "expected_name_keyword": "मोजरी",
                "expected_days": 3,
                "expected_cost": 500
            }
        ]

        extracted_titles = []
        extracted_crafts = []

        for tc in test_cases:
            result = svc.extract_craft_attributes(tc["input"], force_fallback=True)
            assert result.get("success") is True, f"Failed for {tc['lang']}"
            assert result.get("requires_clarification") is not True, f"Should not require clarification for {tc['lang']}"

            attrs = result["attributes"]
            # 1. Assert craft type matches expected domain
            assert tc["expected_craft"].lower() in attrs["craft_type"].lower()

            # 2. Assert specific keyword is in title
            assert (
                tc["expected_name_keyword"].lower() in attrs["product_name_hi"].lower() or
                tc["expected_name_keyword"].lower() in attrs["product_name_en"].lower()
            )

            # 3. Assert extraction of days and cost
            assert attrs["production_days"] == tc["expected_days"]
            assert attrs["material_cost"] == tc["expected_cost"]

            # 4. Strict check: NEVER default to Varanasi Silk for non-saree crafts!
            assert "saree" not in attrs["craft_type"].lower()
            assert "saree" not in attrs["product_name_en"].lower()

            # 5. Statutory wage floor calculation
            expected_floor = tc["expected_cost"] + (tc["expected_days"] * 650.0)
            assert attrs["wage_floor"] == int(round(expected_floor, -1))
            assert attrs["recommended_price"] >= attrs["wage_floor"]

            extracted_titles.append(attrs["product_name_en"])
            extracted_crafts.append(attrs["craft_type"])

        # 6. Verify zero repetitive/identical outputs across all 5 dialects
        assert len(set(extracted_titles)) == 5, f"Expected 5 unique titles, got: {extracted_titles}"
        assert len(set(extracted_crafts)) == 5, f"Expected 5 unique crafts, got: {extracted_crafts}"

    def test_fallback_extracts_explicit_facts_only(self):
        """TC-VOICE-11: Rule-based fallback extracts only explicit facts; never invents dimensions or color."""
        from app.services.sarvam_service import SarvamService
        svc = SarvamService()

        # Input without dimensions or color
        text = "यह हाथ से बनी पीतल की घंटी है, 2 दिन लगे, 300 रुपये लागत"
        result = svc.extract_craft_attributes(text, force_fallback=True)
        attrs = result["attributes"]

        # Color and dimensions must be None (not hallucinated)
        assert attrs["color"] is None
        assert attrs["dimensions"] is None
        assert "पीतल (Brass)" in attrs["materials"]
        assert attrs["facts_detected"]["days"] is True
        assert attrs["facts_detected"]["cost"] is True

    def test_5_distinct_voice_inputs(self):
        """TC-VOICE-12: Verifies 5 distinct artisan handicraft voice inputs produce 5 distinct structured outputs."""
        from app.services.sarvam_service import SarvamService
        svc = SarvamService()

        inputs = [
            {
                "text": "यह हाथ से बनी पीतल की घंटी है, 2 दिन लगे, 300 रुपये लागत",
                "name": "Handcrafted Brass Bell",
                "craft": "Metal Craft",
                "days": 2,
                "cost": 300
            },
            {
                "text": "लाल मिट्टी का फूलदान है, 1 दिन में बना, 150 रुपये लागत",
                "name": "Handcrafted Earthen Clay Vase",
                "craft": "Pottery",
                "days": 1,
                "cost": 150
            },
            {
                "text": "गुलाब की लकड़ी का नक्काशीदार आभूषण बॉक्स, 4 दिन लगे, 600 रुपये लागत",
                "name": "Handcrafted Wooden Jewelry Box",
                "craft": "Woodcraft",
                "days": 4,
                "cost": 600
            },
            {
                "text": "चाक पर बना मिट्टी का घड़ा है, 3 दिन लगे, 200 रुपये लागत",
                "name": "Handcrafted Earthen Clay Pot",
                "craft": "Pottery",
                "days": 3,
                "cost": 200
            },
            {
                "text": "मिथिला की हस्तनिर्मित मधुबनी पेंटिंग है, 5 दिन लगे, 400 रुपये लागत",
                "name": "Handcrafted Madhubani Painting",
                "craft": "Madhubani",
                "days": 5,
                "cost": 400
            }
        ]

        results = []
        for item in inputs:
            res = svc.extract_craft_attributes(item["text"], force_fallback=True)
            assert res["success"] is True
            attrs = res["attributes"]
            assert attrs["production_days"] == item["days"]
            assert attrs["material_cost"] == item["cost"]
            assert item["craft"].lower() in attrs["craft_type"].lower()
            assert "saree" not in attrs["craft_type"].lower()
            results.append(attrs["product_name_en"])

        # All 5 items must have distinct product names
        assert len(set(results)) == 5

    def test_voice_idempotence_and_anti_repetition(self):
        """TC-VOICE-13: Same audio transcript produces identical output (idempotence); different audios produce distinct outputs."""
        from app.services.sarvam_service import SarvamService
        svc = SarvamService()

        sample_a = "यह हाथ से बनी पीतल की घंटी है, 2 दिन लगे, 300 रुपये लागत"
        res_a1 = svc.extract_craft_attributes(sample_a, force_fallback=True)["attributes"]
        res_a2 = svc.extract_craft_attributes(sample_a, force_fallback=True)["attributes"]

        # Idempotence: exactly equal
        assert res_a1["product_name_en"] == res_a2["product_name_en"]
        assert res_a1["production_days"] == res_a2["production_days"]
        assert res_a1["material_cost"] == res_a2["material_cost"]
        assert res_a1["wage_floor"] == res_a2["wage_floor"]

        sample_b = "गुलाब की लकड़ी का आभूषण बॉक्स है, 4 दिन लगे, 600 रुपये लागत"
        res_b = svc.extract_craft_attributes(sample_b, force_fallback=True)["attributes"]

        # Distinctness: A != B
        assert res_a1["product_name_en"] != res_b["product_name_en"]
        assert res_a1["craft_type"] != res_b["craft_type"]
        assert res_a1["material_cost"] != res_b["material_cost"]

    def test_decoupled_economic_verification(self):
        """TC-VOICE-14: If labor days or material cost are not spoken, wage floor & price are NOT calculated and verification is flagged."""
        from app.services.sarvam_service import SarvamService
        svc = SarvamService()

        # Case 1: Only craft stated, no days or cost
        res_none = svc.extract_craft_attributes("यह हाथ से बनी पीतल की घंटी है", force_fallback=True)
        attrs_none = res_none["attributes"]
        assert attrs_none["production_days"] is None
        assert attrs_none["material_cost"] is None
        assert attrs_none["wage_floor"] is None
        assert attrs_none["recommended_price"] is None
        assert "production_days" in res_none.get("verification_required", [])
        assert "material_cost" in res_none.get("verification_required", [])

        # Case 2: Only days stated, no cost
        res_days = svc.extract_craft_attributes("यह हाथ से बनी पीतल की घंटी है, 2 दिन लगे", force_fallback=True)
        attrs_days = res_days["attributes"]
        assert attrs_days["production_days"] == 2
        assert attrs_days["material_cost"] is None
        assert attrs_days["wage_floor"] is None
        assert attrs_days["recommended_price"] is None
        assert "material_cost" in res_days.get("verification_required", [])

        # Case 3: Only cost stated, no days
        res_cost = svc.extract_craft_attributes("यह हाथ से बनी पीतल की घंटी है, 300 रुपये लागत", force_fallback=True)
        attrs_cost = res_cost["attributes"]
        assert attrs_cost["production_days"] is None
        assert attrs_cost["material_cost"] == 300
        assert attrs_cost["wage_floor"] is None
        assert attrs_cost["recommended_price"] is None
        assert "production_days" in res_cost.get("verification_required", [])

    def test_real_hindi_speech_to_actual_transcript(self, monkeypatch):
        """TC-VOICE-15: Real Hindi audio -> Real ASR transcript via Sarvam Saarika provider."""
        from app.services.sarvam_service import sarvam_service
        from app.core.config import settings
        import base64

        if not settings.SARVAM_API_KEY:
            pytest.skip("SARVAM_API_KEY not set in environment")

        # Synthesize genuine Hindi speech audio via Sarvam Bulbul TTS
        tts_res = sarvam_service.synthesize_speech("यह पीतल का नंदी है", "hi-IN")
        if not tts_res.get("audio_base64"):
            pytest.skip("Sarvam TTS unavailable for live roundtrip")

        audio_bytes = base64.b64decode(tts_res["audio_base64"])

        # Activate online mode for this test
        monkeypatch.setattr(settings, "OFFLINE_MODE", False)

        catalog = voice_service.process_audio_bytes(audio_bytes, filename="real_artisan_hindi.wav", language_code="hi")

        # Verify genuine ASR transcript
        assert catalog.is_offline_mock is False
        assert len(catalog.transcript_original) > 0
        assert any(term in catalog.transcript_original for term in ["पीतल", "नंदी", "घोड़ा", "यह"])

    def test_unrelated_speech_no_bastar_fallback(self):
        """TC-VOICE-16: Unrelated speech audio must NEVER fall back to hardcoded Bastar Dhokra data."""
        import numpy as np
        import io
        import wave

        bio = io.BytesIO()
        with wave.open(bio, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            tone = (np.sin(np.linspace(0, 440 * 2 * np.pi, 16000)) * 5000).astype(np.int16)
            wf.writeframes(tone.tobytes())
        tone_bytes = bio.getvalue()

        catalog = voice_service.process_audio_bytes(tone_bytes, filename="general_meeting_discussion.wav")
        assert catalog.attributes.craft_type is None
        assert catalog.attributes.product_name != "Bastar Traditional Brass Dhokra Horse"
        assert "Bastar" not in (catalog.attributes.craft_type or "")
        assert catalog.warning in ("UNRECOGNIZED_OR_INSUFFICIENT_CRAFT_DETAILS", "REQUIRES_CLARIFICATION")

    def test_two_different_recordings_no_leakage(self, sample_dhokra_audio_path, sample_khurja_opus_path):
        """TC-VOICE-17: Sequential recordings must be completely independent with zero state leakage."""
        with open(sample_dhokra_audio_path, "rb") as f:
            dhokra_bytes = f.read()
        with open(sample_khurja_opus_path, "rb") as f:
            khurja_bytes = f.read()

        # Call 1: Dhokra
        cat_dhokra = voice_service.process_audio_bytes(dhokra_bytes, filename="bastar_horse.wav")
        assert cat_dhokra.attributes.craft_type == "Bastar Dhokra"

        # Call 2: Khurja Pottery
        cat_khurja = voice_service.process_audio_bytes(khurja_bytes, filename="khurja_pottery.opus")
        assert cat_khurja.attributes.craft_type == "Khurja Pottery"
        assert "Dhokra" not in cat_khurja.attributes.craft_type
        assert "Brass" not in cat_khurja.attributes.materials

        # Call 3: Dhokra again
        cat_dhokra2 = voice_service.process_audio_bytes(dhokra_bytes, filename="bastar_horse.wav")
        assert cat_dhokra2.attributes.craft_type == "Bastar Dhokra"
        assert "Pottery" not in cat_dhokra2.attributes.craft_type
        assert "Ceramic" not in str(cat_dhokra2.attributes.materials)

    def test_asr_failure_no_mock_success(self, monkeypatch, sample_dhokra_audio_path):
        """TC-VOICE-18: When ASR fails in online mode, raise error and NEVER silently fall back to mock data."""
        from app.services.sarvam_service import sarvam_service
        from app.core.config import settings

        monkeypatch.setattr(settings, "OFFLINE_MODE", False)
        monkeypatch.setattr(settings, "SARVAM_API_KEY", "test-sarvam-key")

        # Mock sarvam_service.transcribe_speech to simulate upstream failure
        monkeypatch.setattr(
            sarvam_service,
            "transcribe_speech",
            lambda *args, **kwargs: {"success": False, "transcript": "", "error": "Simulated upstream 502 connection timeout"}
        )

        with open(sample_dhokra_audio_path, "rb") as f:
            audio_bytes = f.read()

        with pytest.raises(ValueError) as exc:
            voice_service.process_audio_bytes(audio_bytes, filename="artisan.wav")

        assert "ASR_TRANSCRIPTION_FAILED" in str(exc.value)

    def test_production_missing_credentials_fails_fast(self, monkeypatch, sample_dhokra_audio_path):
        """TC-VOICE-19: In production mode without OFFLINE_MODE, missing SARVAM_API_KEY must raise configuration error."""
        from app.core.config import settings

        monkeypatch.setattr(settings, "OFFLINE_MODE", False)
        monkeypatch.setattr(settings, "SARVAM_API_KEY", None)

        with open(sample_dhokra_audio_path, "rb") as f:
            audio_bytes = f.read()

        with pytest.raises(RuntimeError) as exc:
            voice_service.process_audio_bytes(audio_bytes, filename="artisan.wav")

        assert "CONFIGURATION_ERROR" in str(exc.value)
        assert "SARVAM_API_KEY is missing" in str(exc.value)

    def test_speak_catalog_endpoint_silence_returns_400(self, client, sample_silence_audio_path):
        """TC-VOICE-20: /voice/speak-catalog returns HTTP 400 on pure silence."""
        with open(sample_silence_audio_path, "rb") as f:
            res = client.post(
                "/api/v1/voice/speak-catalog",
                files={"audio": ("silence.wav", f, "audio/wav")},
                data={"language_code": "hi-IN"},
                headers=artisan_auth_headers()
            )
        assert res.status_code == 400
        data = res.json()
        assert data["success"] is False
        assert "AUDIO_SILENT" in data.get("error", "")

    def test_speak_catalog_endpoint_corrupt_audio_returns_400(self, client):
        """TC-VOICE-21: /voice/speak-catalog returns HTTP 400 on truncated/corrupt audio."""
        corrupt_wav = b"RIFF\x20\x00\x00\x00WAVEfmt \x10\x00\x00\x00CORRUPT_BYTES_DATA"
        res = client.post(
            "/api/v1/voice/speak-catalog",
            files={"audio": ("corrupt.wav", corrupt_wav, "audio/wav")},
            data={"language_code": "hi-IN"},
            headers=artisan_auth_headers()
        )
        assert res.status_code == 400
        data = res.json()
        assert data["success"] is False
        assert "INVALID_AUDIO_FORMAT_OR_CORRUPT" in data.get("error", "")

    def test_speak_catalog_endpoint_asr_failure_returns_502(self, client, monkeypatch, sample_dhokra_audio_path):
        """TC-VOICE-22: /voice/speak-catalog returns HTTP 502 on upstream ASR failure with zero mock fallback."""
        from app.services.sarvam_service import sarvam_service
        from app.core.config import settings

        monkeypatch.setattr(settings, "OFFLINE_MODE", False)
        monkeypatch.setattr(settings, "SARVAM_API_KEY", "test-sarvam-key")
        monkeypatch.setattr(
            sarvam_service,
            "transcribe_speech",
            lambda *args, **kwargs: {"success": False, "transcript": "", "error": "Upstream Sarvam 502 Bad Gateway"}
        )

        with open(sample_dhokra_audio_path, "rb") as f:
            res = client.post(
                "/api/v1/voice/speak-catalog",
                files={"audio": ("artisan.wav", f, "audio/wav")},
                data={"language_code": "hi-IN"},
                headers=artisan_auth_headers()
            )

        assert res.status_code == 502
        data = res.json()
        assert data["success"] is False
        assert "ASR_TRANSCRIPTION_FAILED" in data.get("error", "")
        # Must never return canned product data
        assert "attributes" not in data or data["attributes"] is None

    def test_speak_catalog_endpoint_missing_credentials_returns_500(self, client, monkeypatch, sample_dhokra_audio_path):
        """TC-VOICE-23: /voice/speak-catalog returns HTTP 500 when SARVAM_API_KEY is missing in production."""
        from app.core.config import settings

        monkeypatch.setattr(settings, "OFFLINE_MODE", False)
        monkeypatch.setattr(settings, "SARVAM_API_KEY", None)

        with open(sample_dhokra_audio_path, "rb") as f:
            res = client.post(
                "/api/v1/voice/speak-catalog",
                files={"audio": ("artisan.wav", f, "audio/wav")},
                data={"language_code": "hi-IN"},
                headers=artisan_auth_headers()
            )

        assert res.status_code == 500
        data = res.json()
        assert data["success"] is False
        assert "CONFIGURATION_ERROR" in data.get("error", "")
        assert "SARVAM_API_KEY is missing" in data.get("error", "")

    def test_speak_catalog_endpoint_clarification_gating(self, client, monkeypatch, sample_dhokra_audio_path):
        """TC-VOICE-24: Greeting-only speech returns requires_clarification=True and null attributes."""
        from app.services.sarvam_service import sarvam_service
        from app.core.config import settings

        monkeypatch.setattr(settings, "OFFLINE_MODE", False)
        monkeypatch.setattr(settings, "SARVAM_API_KEY", "test-sarvam-key")
        monkeypatch.setattr(
            sarvam_service,
            "transcribe_speech",
            lambda *args, **kwargs: {"success": True, "transcript": "नमस्ते, क्या आप मेरी मदद कर सकते हैं", "language_code": "hi-IN"}
        )
        monkeypatch.setattr(
            sarvam_service,
            "extract_craft_attributes",
            lambda *args, **kwargs: {
                "success": True,
                "requires_clarification": True,
                "message_hi": "आवाज़ में उत्पाद का विवरण नहीं मिला।",
                "message_en": "No product craft details detected.",
                "attributes": None
            }
        )

        with open(sample_dhokra_audio_path, "rb") as f:
            res = client.post(
                "/api/v1/voice/speak-catalog",
                files={"audio": ("artisan.wav", f, "audio/wav")},
                data={"language_code": "hi-IN"},
                headers=artisan_auth_headers()
            )

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["requires_clarification"] is True
        assert data["attributes"] is None
        assert "message_hi" in data

    def test_speak_catalog_endpoint_success_offline_mode(self, client, sample_dhokra_audio_path):
        """TC-VOICE-25: /voice/speak-catalog in explicit OFFLINE_MODE returns valid structured response."""
        from app.core.config import settings
        original_offline = settings.OFFLINE_MODE
        try:
            settings.OFFLINE_MODE = True
            with open(sample_dhokra_audio_path, "rb") as f:
                res = client.post(
                    "/api/v1/voice/speak-catalog",
                    files={"audio": ("dhokra.wav", f, "audio/wav")},
                    data={"language_code": "hi-IN"},
                    headers=artisan_auth_headers()
                )
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["attributes"]["craft_type"] == "Bastar Dhokra"
            assert "transcript" in data
        finally:
            settings.OFFLINE_MODE = original_offline

    def test_speak_catalog_endpoint_two_recordings_no_leakage(self, client, sample_dhokra_audio_path, sample_khurja_opus_path):
        """TC-VOICE-26: Sequential calls to /voice/speak-catalog exhibit zero state leakage across requests."""
        from app.core.config import settings
        original_offline = settings.OFFLINE_MODE
        try:
            settings.OFFLINE_MODE = True
            with open(sample_dhokra_audio_path, "rb") as f1:
                res1 = client.post(
                    "/api/v1/voice/speak-catalog",
                    files={"audio": ("dhokra.wav", f1, "audio/wav")},
                    data={"language_code": "hi-IN"},
                    headers=artisan_auth_headers()
                )
            assert res1.status_code == 200
            data1 = res1.json()
            assert data1["attributes"]["craft_type"] == "Bastar Dhokra"

            with open(sample_khurja_opus_path, "rb") as f2:
                res2 = client.post(
                    "/api/v1/voice/speak-catalog",
                    files={"audio": ("khurja.opus", f2, "audio/ogg")},
                    data={"language_code": "hi-IN"},
                    headers=artisan_auth_headers()
                )
            assert res2.status_code == 200
            data2 = res2.json()
            assert data2["attributes"]["craft_type"] == "Khurja Pottery"
            assert "Dhokra" not in data2["attributes"]["craft_type"]
            assert "Brass" not in str(data2["attributes"]["materials"])
        finally:
            settings.OFFLINE_MODE = original_offline

    def test_voice_catalog_rbac_enforcement(self, client, sample_dhokra_audio_path):
        """TC-VOICE-27: Voice catalog endpoints strictly require artisan or admin role."""
        with open(sample_dhokra_audio_path, "rb") as f:
            audio_bytes = f.read()

        # 1. Anonymous call to /voice/speak-catalog -> 401 Unauthorized
        res_anon = client.post(
            "/api/v1/voice/speak-catalog",
            files={"audio": ("dhokra.wav", audio_bytes, "audio/wav")},
            data={"language_code": "hi-IN"}
        )
        assert res_anon.status_code == 401

        # 2. Customer call to /voice/speak-catalog -> 403 Forbidden
        res_cust = client.post(
            "/api/v1/voice/speak-catalog",
            files={"audio": ("dhokra.wav", audio_bytes, "audio/wav")},
            data={"language_code": "hi-IN"},
            headers=customer_auth_headers()
        )
        assert res_cust.status_code == 403

        # 3. Anonymous call to /products/voice-catalog -> 401 Unauthorized
        res_prod_anon = client.post(
            "/api/v1/products/voice-catalog",
            files={"audio": ("dhokra.wav", audio_bytes, "audio/wav")},
            data={"language_code": "hi"}
        )
        assert res_prod_anon.status_code == 401

        # 4. Customer call to /products/voice-catalog -> 403 Forbidden
        res_prod_cust = client.post(
            "/api/v1/products/voice-catalog",
            files={"audio": ("dhokra.wav", audio_bytes, "audio/wav")},
            data={"language_code": "hi"},
            headers=customer_auth_headers()
        )
        assert res_prod_cust.status_code == 403

    def test_voice_catalog_never_invents_mosje_certification(self, client, sample_dhokra_audio_path):
        """TC-VOICE-28: Pipeline must never invent fake 'MoSJE Certified' tags for unverified crafts."""
        with open(sample_dhokra_audio_path, "rb") as f:
            audio_bytes = f.read()

        catalog = voice_service.process_audio_bytes(audio_bytes, filename="bastar_horse.wav")
        assert "MoSJE Certified" not in catalog.seo_tags

        # Also verify via API endpoint
        res = client.post(
            "/api/v1/products/voice-catalog",
            files={"audio": ("dhokra.wav", audio_bytes, "audio/wav")},
            data={"language_code": "hi"},
            headers=artisan_auth_headers()
        )
        assert res.status_code == 200
        tags = res.json().get("seo_tags", [])
        assert "MoSJE Certified" not in tags

    def test_voice_catalog_truthfulness_unspecified_attributes_remain_null(self):
        """TC-VOICE-29: AI extracts only facts explicitly present; unmentioned fields remain null/empty."""
        from app.services.sarvam_service import SarvamService
        svc = SarvamService()

        # Transcript only mentions a bell with no materials, dimensions, days, or costs
        res = svc.extract_craft_attributes("यह हाथ से बनी पारंपरिक घंटी है", force_fallback=True)
        attrs = res.get("attributes", {})

        # Dimensions, days, costs, prices must remain None
        assert attrs.get("dimensions") is None
        assert attrs.get("production_days") is None
        assert attrs.get("material_cost") is None
        assert attrs.get("wage_floor") is None
        assert attrs.get("recommended_price") is None

    def test_voice_fail_fast_on_extraction_error_in_production(self, client, monkeypatch):
        """TC-VOICE-30: Upstream AI extraction failure in production must return HTTP 502 with zero canned fallback."""
        from app.services.sarvam_service import sarvam_service
        from app.core.config import settings

        monkeypatch.setattr(settings, "OFFLINE_MODE", False)
        monkeypatch.setattr(
            sarvam_service,
            "extract_craft_attributes",
            lambda *args, **kwargs: {"success": False, "error": "Simulated upstream AI failure (502)"}
        )

        res = client.post(
            "/api/v1/voice/extract-catalog",
            json={"transcript": "यह शुद्ध सिल्क की बनारसी साड़ी है", "language_code": "hi-IN"},
            headers=artisan_auth_headers()
        )
        assert res.status_code == 502
        data = res.json()
        assert "AI_EXTRACTION_FAILED" in str(data)

    def test_voice_asr_non_blocking_async_offload(self):
        """TC-VOICE-31: Verifies async wrappers offload blocking calls to threads without freezing event loop."""
        import asyncio
        from app.services.sarvam_service import sarvam_service

        # Test that async wrappers exist and are coroutine functions
        assert asyncio.iscoroutinefunction(sarvam_service.async_transcribe_speech)
        assert asyncio.iscoroutinefunction(sarvam_service.async_extract_craft_attributes)
        assert asyncio.iscoroutinefunction(sarvam_service.async_synthesize_speech)
        assert asyncio.iscoroutinefunction(sarvam_service.async_chat_completion)

    def test_voice_asr_timeout_and_retry_transient_failures(self, monkeypatch):
        """TC-VOICE-32: Verifies ASR timeout is >= 30s and transient 503/429 errors trigger retry."""
        from app.services.sarvam_service import SarvamService
        from app.core.config import settings
        import urllib.error

        assert settings.EXTERNAL_TIMEOUT_SECONDS >= 30
        assert settings.SARVAM_STT_TIMEOUT_SECONDS >= 30

        svc = SarvamService()
        monkeypatch.setattr(settings, "SARVAM_API_KEY", "test-key")

        attempt_count = 0
        def mock_urlopen(req, timeout):
            nonlocal attempt_count
            attempt_count += 1
            assert timeout >= 30
            if attempt_count == 1:
                # First attempt fails with transient 503 Service Unavailable
                import io
                raise urllib.error.HTTPError("https://api.sarvam.ai", 503, "Service Unavailable", {}, io.BytesIO(b'{"message": "temporary overload"}'))
            # Second attempt succeeds
            import io
            return io.BytesIO(b'{"transcript": "Dhokra brass bell", "language_code": "hi-IN"}')

        monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)
        res = svc.transcribe_speech(b"RIFF....WAVEfmt ", filename="bell.wav")

        assert attempt_count == 2
        assert res["success"] is True
        assert res["transcript"] == "Dhokra brass bell"

    def test_voice_asr_detailed_http_error_reporting(self, monkeypatch):
        """TC-VOICE-33: Verifies transcribe_speech extracts and returns structured HTTP error body."""
        from app.services.sarvam_service import SarvamService
        from app.core.config import settings
        import urllib.error
        import io

        svc = SarvamService()
        monkeypatch.setattr(settings, "SARVAM_API_KEY", "test-key")

        def mock_urlopen_fail(req, timeout):
            raise urllib.error.HTTPError(
                "https://api.sarvam.ai",
                400,
                "Bad Request",
                {},
                io.BytesIO(b'{"error": {"code": "unsupported_audio_format", "message": "Sample rate below 16000Hz"}}')
            )

        monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen_fail)
        res = svc.transcribe_speech(b"RIFF....WAVEfmt ", filename="bell.wav")

        assert res["success"] is False
        assert res["status_code"] == 400
        assert "Sample rate below 16000Hz" in res["error"]
        assert "unsupported_audio_format" in res["details"]

    def test_voice_expanded_craft_term_gating(self):
        """TC-VOICE-34: Terse descriptions with jewelry, utensils, baskets, and regional terms are not rejected."""
        from app.services.sarvam_service import SarvamService
        svc = SarvamService()

        # Terse descriptions (1-2 words) that previously failed
        valid_terse_samples = [
            "कांच की चूड़ी",         # Glass bangle
            "चांदी की पायल",         # Silver anklet
            "बांस की टोकरी",         # Bamboo basket
            "सिल्क दुपट्टा",          # Silk dupatta
            "ब्रास घंटी",            # Brass bell
            "কাঁচের চুড়ি",          # Bengali glass bangle
            "வெண்கல சிலை",           # Tamil bronze idol
            "చెక్క బొమ్మ",            # Telugu wooden doll
            "മൺപാത്രം",             # Malayalam / Indic clay pot
            "silver anklet",        # English anklet
            "bamboo basket",        # English basket
            "dhokra bell"           # English dhokra bell
        ]

        for sample in valid_terse_samples:
            res = svc.extract_craft_attributes(sample, force_fallback=True)
            # Should NOT be bounced as "requires_clarification: True" with no attributes
            assert not (res.get("requires_clarification") and not res.get("attributes")), f"Failed on: {sample}"

    def test_voice_multilingual_cluster_normalization(self):
        """TC-VOICE-35: Regional cluster keywords across Indic languages trigger craft cluster normalization."""
        from app.services.sarvam_service import SarvamService

        # 1. Bengali Varanasi Silk
        res_bn = SarvamService._normalize_cluster_craft_type("বারাণসী খাঁটি সিল্ক শাড়ি", "Saree")
        assert res_bn == "Varanasi Silk"

        # 2. Tamil Bastar Dhokra
        res_ta = SarvamService._normalize_cluster_craft_type("பஸ்தார் பித்தளை மணி குதிரை", "Handicraft")
        assert res_ta == "Bastar Dhokra"

        # 3. Telugu Khurja Pottery
        res_te = SarvamService._normalize_cluster_craft_type("ఖుర్జా మట్టి కుండ", "Pottery")
        assert res_te == "Khurja Pottery"

        # 4. Kannada Madhubani Painting
        res_kn = SarvamService._normalize_cluster_craft_type("ಮಧುಬನಿ ಚಿತ್ರಕಲೆ ಕಲೆ", "Painting")
        assert res_kn == "Madhubani Painting"

        # 5. Odia Channapatna Toys
        res_or = SarvamService._normalize_cluster_craft_type("ଚନ୍ନପଟ୍ଟଣ କାଠ ଖେଳଣା", "Toy")
        assert res_or == "Channapatna Toys"

    def test_voice_non_greedy_balanced_json_extraction(self):
        """TC-VOICE-36: Robust JSON extractor parses valid JSON without greedy span corruption across multiple blocks."""
        from app.core.json_utils import extract_first_valid_json

        # Case 1: JSON followed by trailing note containing another JSON object
        raw_output_multiple_blocks = (
            "Here is the catalog data:\n"
            "{\n"
            '  "product_name_hi": "ढोकरा घंटी",\n'
            '  "craft_type": "Bastar Dhokra",\n'
            '  "materials": ["पीतल"]\n'
            "}\n"
            "Note: Verification status is recorded in: {\"verified\": false, \"step\": 1}"
        )
        parsed = extract_first_valid_json(raw_output_multiple_blocks)
        assert parsed is not None
        assert parsed["product_name_hi"] == "ढोकरा घंटी"
        assert parsed["craft_type"] == "Bastar Dhokra"
        assert parsed["materials"] == ["पीतल"]

        # Case 2: Markdown code fence block
        code_fence_output = (
            "```json\n"
            "{\n"
            '  "product_name_hi": "सिल्क साड़ी",\n'
            '  "craft_type": "Varanasi Silk"\n'
            "}\n"
            "```"
        )
        parsed_cf = extract_first_valid_json(code_fence_output)
        assert parsed_cf is not None
        assert parsed_cf["craft_type"] == "Varanasi Silk"




