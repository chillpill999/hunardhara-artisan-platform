"""
Voice Engine Alias & Entrypoint (SIH26090 - R2).
Re-exports VoiceService, voice_service, and offline_voice_engine.
"""

from app.services.voice_service import VoiceService, voice_service
from app.services.offline_mock_engine import OfflineMockVoiceEngine, offline_voice_engine

__all__ = [
    "VoiceService",
    "voice_service",
    "OfflineMockVoiceEngine",
    "offline_voice_engine"
]

