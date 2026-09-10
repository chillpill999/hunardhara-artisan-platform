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

    def transcribe_speech(
        self,
        audio_bytes: bytes,
        filename: str = "artisan_audio.wav",
        language_code: str = "hi-IN",
        model: str = "saarika:v2.5"
    ) -> Dict[str, Any]:
        """
        Transcribes artisan Indic speech to text using Sarvam Saarika ASR.
        """
        api_key = settings.SARVAM_API_KEY
        if not api_key:
            return {"success": False, "transcript": "", "error": "SARVAM_API_KEY missing"}

        boundary = "SarvamASRBoundary789456123"
        lines = [
            f"--{boundary}".encode("utf-8"),
            b'Content-Disposition: form-data; name="model"\r\n',
            model.encode("utf-8"),
            f"--{boundary}".encode("utf-8"),
            b'Content-Disposition: form-data; name="language_code"\r\n',
            language_code.encode("utf-8"),
            f"--{boundary}".encode("utf-8"),
            f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode("utf-8"),
            b"Content-Type: audio/wav\r\n",
            audio_bytes,
            f"--{boundary}--\r\n".encode("utf-8")
        ]
        body = b"\r\n".join(lines)

        req = urllib.request.Request(
            "https://api.sarvam.ai/speech-to-text",
            data=body,
            headers={
                "api-subscription-key": api_key,
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "User-Agent": "Hunardhara-Artisan-Platform/1.0"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return {
                    "success": True,
                    "transcript": data.get("transcript", ""),
                    "language_code": data.get("language_code", language_code),
                    "source": "sarvam_saarika"
                }
        except Exception as e:
            logger.error(f"Sarvam ASR error: {e}")
            return {"success": False, "transcript": "", "error": str(e)}

    def translate_text(
        self,
        text: str,
        source_language_code: str = "hi-IN",
        target_language_code: str = "en-IN",
        mode: str = "formal"
    ) -> Dict[str, Any]:
        """
        Translates text between Indic languages and English using Sarvam Mayura.
        """
        api_key = settings.SARVAM_API_KEY
        if not api_key:
            return {"success": False, "translated_text": text, "error": "SARVAM_API_KEY missing"}

        payload = {
            "input": text,
            "source_language_code": source_language_code,
            "target_language_code": target_language_code,
            "mode": mode,
            "model": "mayura:v1"
        }
        req = urllib.request.Request(
            "https://api.sarvam.ai/translate",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "api-subscription-key": api_key,
                "Content-Type": "application/json",
                "User-Agent": "Hunardhara-Artisan-Platform/1.0"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return {
                    "success": True,
                    "translated_text": data.get("translated_text", text),
                    "source_language_code": data.get("source_language_code", source_language_code)
                }
        except Exception as e:
            logger.error(f"Sarvam translation error: {e}")
            return {"success": False, "translated_text": text, "error": str(e)}

    def chat_completion(
        self,
        user_message: str,
        system_prompt: Optional[str] = None,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates conversational Indic AI response using Sarvam 105B LLM.
        """
        api_key = settings.SARVAM_API_KEY
        if not api_key:
            return {"success": False, "reply": "", "error": "SARVAM_API_KEY missing"}

        default_sys = (
            "आप 'हुनर साथी' (Hunar Saathi) हैं - हुनरधारा (Hunardhara) मंच के समर्पित AI सहायक। "
            "आप भारत के ग्रामीण व पारंपरिक कारीगरों (बुनकर, मूर्तिकार, कुम्हार, धातुशिल्पी आदि) के मित्र और मार्गदर्शक हैं। "
            "कारीगरों को सरल, सम्मानजनक, आत्मीय और स्पष्ट हिंदी में 2 से 4 वाक्यों में सटीक सलाह दें। "
            "उन्हें बिचौलियों से बचने, उचित मूल्य (लागत + मजदूरी) पाने, और अपने उत्पादों को ऑनलाइन बेचने के लिए प्रेरित करें। "
            "यदि प्रासंगिक हो, तो 'उत्पाद जोड़ें (Studio)', 'ऑर्डर देखें (Orders)', या 'कमाई देखें (Revenue)' जैसे सुझाव दें।"
        )
        if context:
            default_sys += f"\nकारीगर संदर्भ: {context}"

        messages = [
            {"role": "system", "content": system_prompt or default_sys},
            {"role": "user", "content": user_message}
        ]

        payload = {
            "model": "sarvam-105b-conversations",
            "messages": messages,
            "temperature": 0.5
        }

        req = urllib.request.Request(
            "https://api.sarvam.ai/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "api-subscription-key": api_key,
                "Content-Type": "application/json",
                "User-Agent": "Hunardhara-Artisan-Platform/1.0"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                choices = data.get("choices", [])
                if choices:
                    reply = choices[0].get("message", {}).get("content", "").strip()
                    return {
                        "success": True,
                        "reply": reply,
                        "model": "sarvam-105b-conversations"
                    }
                return {"success": False, "reply": "", "error": "No response choice"}
        except Exception as e:
            logger.error(f"Sarvam chat error: {e}")
            return {"success": False, "reply": "", "error": str(e)}


sarvam_service = SarvamService()

