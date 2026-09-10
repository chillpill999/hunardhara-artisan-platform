import re
import json
import logging
import urllib.request
import urllib.error
from typing import Optional, Dict, Any

from app.core.config import settings

logger = logging.getLogger("artisan_platform.sarvam_service")


class SarvamService:
    """
    Sovereign Indian Voice Integration via Sarvam AI (Bulbul TTS).
    Provides conversational, warm Indic speech synthesis for marginalized artisans.
    """

    API_URL = "https://api.sarvam.ai/text-to-speech"

    def clean_text_for_speech(self, text: str) -> str:
        """
        Cleans markdown markers, emojis, and symbols so TTS voice speaks naturally.
        """
        # Remove markdown bold/italics
        cleaned = re.sub(r"[\*\_#`~]", "", text)
        # Remove URLs
        cleaned = re.sub(r"https?://\S+", "", cleaned)
        # Remove bracketed navigation hints like [ + अभी उत्पाद जोड़ें ]
        cleaned = re.sub(r"\[.*?\]", "", cleaned)
        # Remove excessive whitespace
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        # Cap at 2000 characters for safety
        return cleaned[:2000]

    def synthesize_speech(
        self,
        text: str,
        language_code: str = "hi-IN",
        speaker: str = "shubh",
        model: str = "bulbul:v3"
    ) -> Dict[str, Any]:
        """
        Calls Sarvam AI Bulbul TTS API to synthesize Indic speech.
        Returns dict with audio_base64 and metadata, or fallback flag.
        """
        api_key = settings.SARVAM_API_KEY
        if not api_key:
            logger.warning("SARVAM_API_KEY not configured. Falling back to client-side TTS.")
            return {
                "success": False,
                "audio_base64": None,
                "source": "browser_fallback",
                "message": "Sarvam API key not configured on server"
            }

        cleaned = self.clean_text_for_speech(text)
        if not cleaned:
            return {
                "success": False,
                "audio_base64": None,
                "source": "none",
                "message": "Empty text provided"
            }

        payload = {
            "text": cleaned,
            "language_code": language_code,
            "speaker": speaker,
            "model": model
        }

        req = urllib.request.Request(
            self.API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "api-subscription-key": api_key,
                "Content-Type": "application/json",
                "User-Agent": "Hunardhara-Artisan-Platform/1.0"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                audios = data.get("audios", [])
                if audios:
                    return {
                        "success": True,
                        "audio_base64": audios[0],
                        "format": "wav",
                        "source": "sarvam_ai",
                        "speaker": speaker,
                        "language_code": language_code,
                        "message": "Audio synthesized successfully via Sarvam AI"
                    }
                else:
                    return {
                        "success": False,
                        "audio_base64": None,
                        "source": "browser_fallback",
                        "message": "No audio returned from Sarvam"
                    }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            logger.error(f"Sarvam API HTTP error {e.code}: {err_body}")
            return {
                "success": False,
                "audio_base64": None,
                "source": "browser_fallback",
                "message": f"Sarvam HTTP {e.code}: {err_body}"
            }
        except Exception as e:
            logger.error(f"Sarvam synthesis failed: {e}")
            return {
                "success": False,
                "audio_base64": None,
                "source": "browser_fallback",
                "message": str(e)
            }


sarvam_service = SarvamService()
