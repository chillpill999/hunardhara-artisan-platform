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


@router.post("/chat", response_model=ChatResponse, summary="Hunar Saathi Conversational AI (Sarvam 105B)")
def hunar_saathi_chat(req: ChatRequest):
    """
    Conversational assistant for rural artisans using sovereign Sarvam 105B Indic LLM.
    Answers pricing, scheme, catalog, and platform questions in warm, culturally resonant Hindi.
    """
    res = sarvam_service.chat_completion(
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


from fastapi import File, UploadFile, Form

@router.post("/transcribe", response_model=TranscribeResponse, summary="Transcribe Indic Audio (Sarvam Saarika ASR)")
async def transcribe_audio(
    audio: UploadFile = File(..., description="Voice recording audio (.opus / .wav / .m4a)"),
    language_code: str = Form("hi-IN", description="Language code e.g. hi-IN")
):
    """
    Transcribes audio recording in Hindi/Indic languages to Devanagari text using Sarvam Saarika.
    """
    audio_bytes = await audio.read()
    if not audio_bytes or len(audio_bytes) < 10:
        return TranscribeResponse(success=False, transcript="", error="Audio file empty")

    res = sarvam_service.transcribe_speech(
        audio_bytes=audio_bytes,
        filename=audio.filename or "recording.wav",
        language_code=language_code
    )
    return TranscribeResponse(
        success=res.get("success", False),
        transcript=res.get("transcript", ""),
        language_code=res.get("language_code", language_code),
        source=res.get("source", "sarvam_saarika"),
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

