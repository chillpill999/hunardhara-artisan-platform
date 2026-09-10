import logging
from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from fastapi import APIRouter

from app.services.sarvam_service import sarvam_service

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


@router.post("/tts", response_model=TTSResponse, summary="Synthesize Indic Speech (Sarvam AI Bulbul)")
def synthesize_indic_speech(req: TTSRequest):
    """
    Synthesizes conversational, natural Indic speech for rural artisans using Sarvam AI Bulbul.
    Falls back gracefully if network or quota is unavailable.
    """
    return sarvam_service.synthesize_speech(
        text=req.text,
        language_code=req.language_code or "hi-IN",
        speaker=req.speaker or "shubh",
        model=req.model or "bulbul:v3"
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
