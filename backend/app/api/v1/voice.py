import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.schemas.voice import VoiceCatalogResponse
from app.services.voice_service import voice_service

logger = logging.getLogger("artisan_platform.api.voice")
router = APIRouter(prefix="/products", tags=["Indic Voice-to-Catalog"])


@router.post("/voice-catalog", response_model=VoiceCatalogResponse, summary="Indic Voice-to-Catalog")
async def process_voice_catalog(
    audio: UploadFile = File(..., description="Voice recording audio (.opus / .wav / .m4a)"),
    language_code: str = Form("hi", description="ISO 639 Indic language code")
):
    if not audio.filename:
        raise HTTPException(status_code=400, detail="INVALID_AUDIO_FORMAT_OR_CORRUPT")

    audio_bytes = await audio.read()
    if not audio_bytes or len(audio_bytes) < 16:
        raise HTTPException(status_code=400, detail="INVALID_AUDIO_FORMAT_OR_CORRUPT")

    try:
        return voice_service.process_audio_bytes(
            audio_bytes=audio_bytes,
            filename=audio.filename,
            language_code=language_code
        )
    except ValueError as ve:
        err_msg = str(ve)
        if "AUDIO_SILENT" in err_msg or "INCOMPREHENSIBLE" in err_msg or "silent" in err_msg.lower():
            raise HTTPException(status_code=400, detail="AUDIO_SILENT_OR_INCOMPREHENSIBLE")
        if "CORRUPT" in err_msg or "INVALID" in err_msg:
            raise HTTPException(status_code=400, detail="INVALID_AUDIO_FORMAT_OR_CORRUPT")
        raise HTTPException(status_code=400, detail=err_msg)
    except Exception as e:
        logger.error(f"Voice processing failed: {e}")
        raise HTTPException(status_code=400, detail=f"VOICE_PROCESSING_ERROR: {str(e)}")

