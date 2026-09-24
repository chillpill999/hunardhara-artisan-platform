import asyncio
import logging
from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.security import CurrentUser, require_artisan, RateLimiter
from app.core.storage_security import validate_uploaded_file, generate_secure_filename
from app.services.sarvam_service import sarvam_service
from app.services.offline_mock_engine import offline_voice_engine

logger = logging.getLogger("artisan_platform.api.voice")
router = APIRouter(prefix="/voice", tags=["Indic Voice & TTS (हुनर साथी)"])


class TTSRequest(BaseModel):
    text: str = Field(..., max_length=2500, description="Devanagari Hindi or Indic text to synthesize")
    language_code: Optional[str] = Field("hi-IN", description="Language code e.g. hi-IN, bn-IN, te-IN")
    speaker: Optional[str] = Field("shubh", description="Voice persona: shubh, sanchita_hi_assistant, roopa_hi_conversational")
    model: Optional[str] = Field("bulbul:v3", description="Sarvam model name")


class TTSResponse(BaseModel):
    success: bool
    audio_base64: Optional[str] = None
    format: str = "wav"
    source: str
    speaker: Optional[str] = None
    language_code: Optional[str] = None
    message: str


@router.post(
    "/tts",
    response_model=TTSResponse,
    summary="Synthesize Indic Speech (Sarvam AI Bulbul)",
    dependencies=[Depends(RateLimiter(max_requests=30, window_seconds=60, prefix="voice_tts"))]
)
async def synthesize_indic_speech(req: TTSRequest):
    """
    Synthesizes conversational, natural Indic speech for rural artisans using Sarvam AI Bulbul.
    Falls back gracefully if network or quota is unavailable.
    Non-blocking async execution offloaded from the main event loop.
    """
    return await asyncio.to_thread(
        sarvam_service.synthesize_speech,
        text=req.text,
        language_code=req.language_code or "hi-IN",
        speaker=req.speaker or "shubh",
        model=req.model or "bulbul:v3"
    )


class ChatRequest(BaseModel):
    message: str = Field(..., description="Artisan question or voice transcript")
    context: Optional[str] = Field(None, description="Current page or artisan context")
    system_prompt: Optional[str] = Field(None, description="Optional custom system prompt")


class ChatResponse(BaseModel):
    success: bool
    reply: str
    model: Optional[str] = None
    error: Optional[str] = None


class TranscribeResponse(BaseModel):
    success: bool
    transcript: str
    language_code: Optional[str] = None
    source: Optional[str] = None
    error: Optional[str] = None


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Hunar Saathi Conversational AI (Sarvam 105B)",
    dependencies=[Depends(RateLimiter(max_requests=30, window_seconds=60, prefix="voice_chat"))]
)
async def hunar_saathi_chat(req: ChatRequest):
    """
    Conversational assistant for rural artisans using sovereign Sarvam 105B Indic LLM.
    Answers pricing, scheme, catalog, and platform questions in warm, culturally resonant Hindi.
    Non-blocking async execution offloaded from the main event loop.
    """
    res = await asyncio.to_thread(
        sarvam_service.chat_completion,
        user_message=req.message,
        system_prompt=req.system_prompt,
        context=req.context
    )
    if not res.get("success"):
        # Graceful fallback response if API is unreachable
        return ChatResponse(
            success=True,
            reply="मैं समझ गया। आप निश्चिंत रहें, आपका हुनर अनमोल है। आप चाहें तो ऊपर दिए गए बटन दबाकर उत्पाद जोड़ सकते हैं या अपनी बिक्री की जानकारी ले सकते हैं।",
            model="offline_fallback",
            error=res.get("error")
        )
    return ChatResponse(
        success=True,
        reply=res.get("reply", ""),
        model=res.get("model", "sarvam-105b-conversations")
    )


@router.post(
    "/transcribe",
    response_model=TranscribeResponse,
    summary="Transcribe Indic Audio (Sarvam Saarika ASR)",
    dependencies=[Depends(RateLimiter(max_requests=20, window_seconds=60, prefix="voice_transcribe"))]
)
async def transcribe_audio(
    audio: UploadFile = File(..., description="Voice recording audio (.opus / .wav / .m4a)"),
    language_code: str = Form("hi-IN", description="Language code e.g. hi-IN"),
    current_user: CurrentUser = Depends(require_artisan)
):
    """
    Transcribes audio recording in Hindi/Indic languages to Devanagari text using Sarvam Saarika.
    Requires authenticated artisan or admin.
    Non-blocking execution offloaded from the event loop.
    """
    audio_bytes = await audio.read()
    raw_fn = audio.filename or "recording.wav"

    try:
        validate_uploaded_file(
            data=audio_bytes,
            original_filename=raw_fn,
            expected_type="audio",
            max_size_mb=settings.UPLOAD_MAX_SIZE_MB
        )
    except HTTPException as he:
        return TranscribeResponse(success=False, transcript="", error=he.detail)

    res = await asyncio.to_thread(
        sarvam_service.transcribe_speech,
        audio_bytes=audio_bytes,
        filename=raw_fn,
        language_code=language_code
    )
    return TranscribeResponse(
        success=res.get("success", False),
        transcript=res.get("transcript", ""),
        language_code=res.get("language_code", language_code),
        source=res.get("source", "sarvam_saaras_v4"),
        error=res.get("error")
    )


@router.get("/speakers", summary="List available Sarvam AI Indic speakers")
def list_indic_speakers():
    """
    Returns curated Sarvam AI Indic voice personas tuned for rural artisan communication.
    """
    return {
        "recommended_hindi": [
            {"id": "shubh", "name": "Shubh (शुभ)", "tone": "Friendly, warm male guide", "gender": "male"},
            {"id": "sanchita_hi_assistant", "name": "Sanchita (संचिता)", "tone": "Compassionate female assistant", "gender": "female"},
            {"id": "roopa_hi_conversational", "name": "Roopa (रूपा)", "tone": "Artisan conversational elder", "gender": "female"},
            {"id": "aditya_hi_conversational", "name": "Aditya (आदित्य)", "tone": "Youthful advisor", "gender": "male"}
        ],
        "default": "shubh"
    }


class ExtractCatalogRequest(BaseModel):
    transcript: str = Field(..., description="Artisan spoken voice description in Hindi/Indic language")
    language_code: Optional[str] = Field("hi-IN", description="Language code")


@router.post(
    "/extract-catalog",
    summary="Extract Craft Attributes via Sarvam AI",
    dependencies=[Depends(RateLimiter(max_requests=20, window_seconds=60, prefix="voice_extract"))]
)
async def extract_catalog_from_voice(
    req: ExtractCatalogRequest,
    current_user: CurrentUser = Depends(require_artisan)
):
    """
    Parses spoken artisan description into structured craft attributes,
    calculates statutory wage floor, and prepares bilingual listing details.
    Requires authenticated artisan or admin.
    Non-blocking async execution offloaded from the main event loop.
    """
    res = await asyncio.to_thread(
        sarvam_service.extract_craft_attributes,
        transcript=req.transcript,
        language_code=req.language_code or "hi-IN"
    )
    if not res.get("success") and not res.get("requires_clarification"):
        err_detail = res.get("error", "Upstream craft extraction failed.")
        raise HTTPException(
            status_code=502,
            detail=f"AI_EXTRACTION_FAILED: {err_detail}"
        )
    return res


@router.post(
    "/speak-catalog",
    summary="End-to-End Speak-to-Catalog via Sarvam AI",
    dependencies=[Depends(RateLimiter(max_requests=15, window_seconds=60, prefix="voice_speak_catalog"))]
)
async def speak_to_catalog(
    audio: UploadFile = File(..., description="Voice recording audio (.opus / .wav / .m4a / .webm)"),
    language_code: str = Form("hi-IN", description="Language code"),
    current_user: CurrentUser = Depends(require_artisan)
):
    """
    Canonical Speak-to-Catalog Pipeline:
    16kHz mono WAV -> real Sarvam ASR -> real craft extraction -> frontend review.
    Zero canned defaults; proper HTTP errors on upstream failure; clarification gating for empty/greeting speech.
    Non-blocking async execution offloaded from the main event loop.
    """
    audio_bytes = await audio.read()
    filename = audio.filename or "recording.wav"

    try:
        validate_uploaded_file(
            data=audio_bytes,
            original_filename=filename,
            expected_type="audio",
            max_size_mb=settings.UPLOAD_MAX_SIZE_MB
        )
    except HTTPException as he:
        return JSONResponse(
            status_code=he.status_code,
            content={"success": False, "error": he.detail}
        )

    # 1. Validate audio integrity & acoustic levels
    err, warning = offline_voice_engine.validate_audio(audio_bytes, filename)
    if err:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": err, "warning": warning}
        )

    # 2. Offline mock mode check (test/demo only - forbidden in production)
    if settings.OFFLINE_MODE:
        if settings.is_production:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "error": "OFFLINE_MODE_FORBIDDEN: Offline mock mode cannot run in production."
                }
            )
        mock_res = offline_voice_engine.process_audio(audio_bytes, filename=filename)
        return {
            "success": True,
            "requires_clarification": False,
            "transcript": mock_res.transcript_original,
            "attributes": mock_res.attributes.model_dump(),
            "confirmation_audio_base64": None,
            "source": "offline_mock_engine"
        }

    # 3. Production credentials check: never silently drop into mock
    if not settings.SARVAM_API_KEY:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "CONFIGURATION_ERROR: SARVAM_API_KEY is missing. Production mode requires valid Sarvam credentials."
            }
        )

    # 4. Authoritative ASR via Sarvam Saaras v4 (offloaded to thread to avoid freezing event loop)
    lang_code = "hi-IN" if language_code.startswith("hi") else language_code
    asr_res = await asyncio.to_thread(
        sarvam_service.transcribe_speech,
        audio_bytes=audio_bytes,
        filename=filename,
        language_code=lang_code
    )

    if not asr_res.get("success"):
        err_detail = asr_res.get("error", "ASR transcription failed")
        logger.error(f"Sarvam ASR provider failure: {err_detail}")
        return JSONResponse(
            status_code=502,
            content={
                "success": False,
                "error": f"ASR_TRANSCRIPTION_FAILED: {err_detail}",
                "details": asr_res
            }
        )

    transcript = (asr_res.get("transcript") or "").strip()
    if not transcript:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "AUDIO_SILENT_OR_INCOMPREHENSIBLE"}
        )

    # 5. Extract craft attributes (offloaded to thread to avoid freezing event loop)
    extract_res = await asyncio.to_thread(
        sarvam_service.extract_craft_attributes,
        transcript=transcript,
        language_code=lang_code
    )

    if not extract_res.get("success") and not extract_res.get("requires_clarification"):
        err_detail = extract_res.get("error", "AI craft extraction failed")
        logger.error(f"Sarvam LLM extraction failure: {err_detail}")
        return JSONResponse(
            status_code=502,
            content={
                "success": False,
                "error": f"AI_EXTRACTION_FAILED: {err_detail}",
                "details": extract_res
            }
        )

    # Clarification Gating: greetings-only or missing craft details
    extracted_attrs = extract_res.get("attributes")
    is_empty_craft = (
        extracted_attrs and
        not extracted_attrs.get("craft_type") and
        not extracted_attrs.get("materials") and
        not (extracted_attrs.get("product_name_hi") or extracted_attrs.get("product_name_en"))
    )

    if extract_res.get("requires_clarification") or is_empty_craft:
        return {
            "success": True,
            "requires_clarification": True,
            "transcript": transcript,
            "message_hi": extract_res.get("message_hi") or (extracted_attrs or {}).get("description_hi") or "आवाज़ में उत्पाद का विवरण नहीं मिला। कृपया अपने शिल्प का नाम, सामग्री और बनाने के दिन बताएं।",
            "message_en": extract_res.get("message_en") or (extracted_attrs or {}).get("description_en") or "No product craft details detected. Please describe your item name, material used, and days to make.",
            "attributes": None,
            "source": "sarvam_ai_suite"
        }

    attributes = extracted_attrs or {}

    # 6. Synthesize voice confirmation (best-effort, non-blocking offloaded to thread)
    confirmation_audio = None
    try:
        voice_script = attributes.get("voice_script_hi", f"आपका उत्पाद {attributes.get('product_name_hi', '')} तैयार है।")
        tts_res = await asyncio.to_thread(
            sarvam_service.synthesize_speech,
            text=voice_script,
            language_code=lang_code,
            speaker="shubh"
        )
        if tts_res.get("success"):
            confirmation_audio = tts_res.get("audio_base64")
    except Exception as tts_err:
        logger.warning(f"Voice confirmation TTS synthesis skipped: {tts_err}")

    return {
        "success": True,
        "requires_clarification": False,
        "transcript": transcript,
        "attributes": attributes,
        "confirmation_audio_base64": confirmation_audio,
        "source": "sarvam_ai_suite"
    }


