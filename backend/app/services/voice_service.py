import logging
from typing import Optional
from app.core.config import settings
from app.schemas.voice import VoiceCatalogResponse, VoiceCraftAttributes, MarketingDescription
from app.services.offline_mock_engine import offline_voice_engine, OfflineMockVoiceEngine
from app.services.sarvam_service import sarvam_service

logger = logging.getLogger("artisan_platform.voice_service")


class VoiceService:
    """
    Indic Voice-to-Catalog Service (SIH26090 - R2).
    Authoritative production pipeline powered by Sarvam Saarika ASR (and Sarvam 105B / OpenRouter LLM),
    with strictly isolated deterministic mock engine available only when explicitly enabled via OFFLINE_MODE=true.
    """

    def __init__(self):
        self.offline_engine = offline_voice_engine

    def process_audio_bytes(
        self,
        audio_bytes: bytes,
        filename: str = "artisan_audio.wav",
        language_code: str = "hi"
    ) -> VoiceCatalogResponse:
        """
        Processes voice recording into structured e-commerce catalog attributes,
        bilingual marketing descriptions, and SEO tags.
        """
        # 1. Validate audio integrity & acoustics prior to any processing
        err, warning = self.offline_engine.validate_audio(audio_bytes, filename)
        if err:
            raise ValueError(err)

        # 2. Production / Online Path: Real configured ASR provider (Sarvam Saarika ASR)
        if not settings.OFFLINE_MODE:
            # Production MUST NOT silently fall back to mock if credentials are missing
            if not settings.SARVAM_API_KEY:
                raise RuntimeError(
                    "CONFIGURATION_ERROR: SARVAM_API_KEY is missing. "
                    "Production environment cannot run ASR without configured credentials. "
                    "Offline mock mode is disabled unless explicitly enabled via OFFLINE_MODE=true."
                )

            logger.info("Executing Voice-to-Catalog via real Sarvam Saarika ASR provider")
            lang_code = "hi-IN" if language_code.startswith("hi") else language_code

            asr_res = sarvam_service.transcribe_speech(
                audio_bytes=audio_bytes,
                filename=filename,
                language_code=lang_code
            )

            # On ASR failure: Return an actual error; NEVER fall back to mock data!
            if not asr_res.get("success"):
                err_detail = asr_res.get("error", "ASR transcription failed")
                logger.error(f"Sarvam ASR provider failure: {err_detail}")
                raise ValueError(f"ASR_TRANSCRIPTION_FAILED: {err_detail}")

            transcript = (asr_res.get("transcript") or "").strip()
            if not transcript:
                raise ValueError("AUDIO_SILENT_OR_INCOMPREHENSIBLE")

            # 3. Extract craft attributes from genuine ASR transcript
            extract_res = sarvam_service.extract_craft_attributes(
                transcript=transcript,
                language_code=lang_code
            )

            # If transcript requires clarification (e.g. pure greetings or insufficient craft content)
            if extract_res.get("requires_clarification"):
                return VoiceCatalogResponse(
                    transcript_original=transcript,
                    transcript_english=transcript,
                    attributes=VoiceCraftAttributes(
                        product_name=None,
                        craft_type=None,
                        materials=[],
                        dimensions=None,
                        production_time_days=None,
                        technique=None,
                        color=None
                    ),
                    marketing_description=MarketingDescription(
                        hi=extract_res.get("message_hi", "आवाज़ में उत्पाद का विवरण नहीं मिला।"),
                        en=extract_res.get("message_en", "No product craft details detected.")
                    ),
                    seo_tags=["Indian Handicrafts", "Handmade", "Traditional Art", "Clarification Required", "Hunardhara"],
                    is_offline_mock=False,
                    warning=warning or "REQUIRES_CLARIFICATION"
                )

            extracted_attrs = extract_res.get("attributes", {})
            craft_type = extracted_attrs.get("craft_type")
            product_name_hi = extracted_attrs.get("product_name_hi")
            product_name_en = extracted_attrs.get("product_name_en")
            materials = extracted_attrs.get("materials") or []
            dimensions = extracted_attrs.get("dimensions")
            days = extracted_attrs.get("production_days")
            if days is not None:
                try:
                    days = float(days)
                except Exception:
                    days = None
            color = extracted_attrs.get("color")
            technique = extracted_attrs.get("technique")

            # Translate transcript to English if needed
            trans_res = sarvam_service.translate_text(
                text=transcript,
                source_language_code=lang_code,
                target_language_code="en-IN"
            )
            transcript_en = trans_res.get("translated_text", transcript)

            desc_hi = extracted_attrs.get("description_hi") or (f"{product_name_hi} - हस्तनिर्मित भारतीय शिल्प।" if product_name_hi else transcript)
            desc_en = extracted_attrs.get("description_en") or (f"{product_name_en} - Handcrafted Indian artisan item." if product_name_en else transcript_en)

            tags = [t for t in [craft_type, "Indian Handicrafts", "Handmade", "Traditional Art", "Artisan"] if t]
            if len(tags) < 5:
                tags.extend(["MoSJE Certified", "Authentic Heritage", "VocalForLocal", "Handloom"])

            return VoiceCatalogResponse(
                transcript_original=transcript,
                transcript_english=transcript_en,
                attributes=VoiceCraftAttributes(
                    product_name=product_name_en or product_name_hi,
                    craft_type=craft_type,
                    materials=materials,
                    dimensions=dimensions,
                    production_time_days=days,
                    technique=technique,
                    color=color
                ),
                marketing_description=MarketingDescription(
                    hi=desc_hi,
                    en=desc_en
                ),
                seo_tags=tags[:8],
                is_offline_mock=False,
                warning=warning
            )

        # 4. Offline Mock Path (Allowed ONLY when explicitly enabled via OFFLINE_MODE=true)
        logger.info("Executing Voice-to-Catalog via deterministic offline engine (explicit OFFLINE_MODE)")
        return self.offline_engine.process_audio(
            audio_bytes=audio_bytes,
            filename=filename,
            language_code=language_code
        )


voice_service = VoiceService()

