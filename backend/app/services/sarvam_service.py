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

    def extract_craft_attributes(self, transcript: str, language_code: str = "hi-IN") -> Dict[str, Any]:
        """
        Extracts structured craft attributes and computes fair price recommendation
        from an artisan voice transcript using Sarvam 105B LLM.
        """
        api_key = settings.SARVAM_API_KEY
        prompt = (
            "You are an expert Indian Handicraft Cataloging AI for the Ministry of Social Justice and Empowerment (MoSJE).\n"
            "Analyze the artisan's voice transcript and extract key product attributes into a strict JSON object.\n"
            f"Transcript: \"{transcript}\"\n\n"
            "Return ONLY valid JSON with these exact keys:\n"
            "{\n"
            '  "product_name_hi": "सटीक हिंदी नाम",\n'
            '  "product_name_en": "Accurate English Title",\n'
            '  "craft_type": "Specific Craft (e.g. Varanasi Silk, Bastar Dhokra, Khurja Pottery, Madhubani Painting, Channapatna Toys)",\n'
            '  "materials": ["मुख्य सामग्री 1", "सामग्री 2"],\n'
            '  "color": "रंग",\n'
            '  "dimensions": "आकार या माप (e.g. 5.5m x 1.2m)",\n'
            '  "production_days": 10,\n'
            '  "material_cost": 2500,\n'
            '  "recommended_price": 6000,\n'
            '  "description_hi": "2-line descriptive summary in Hindi",\n'
            '  "description_en": "2-line descriptive summary in English",\n'
            '  "voice_script_hi": "बधाई हो! आपका उत्पाद तैयार है। इसका उचित बिक्री मूल्य... रुपये तय किया गया है।"\n'
            "}\n"
            "Ensure material_cost and production_days are numbers. Compute recommended_price as: material_cost + (production_days * 650) + 15% margin.\n"
            "Do NOT include markdown formatting or backticks, return raw JSON only."
        )

        if api_key:
            try:
                res = self.chat_completion(
                    user_message=prompt,
                    system_prompt="You are a strict JSON-only API. Never output preamble, explanation, or markdown backticks."
                )
                if res.get("success") and res.get("reply"):
                    reply = res["reply"]
                    # Extract JSON substring if needed
                    json_match = re.search(r"\{[\s\S]*\}", reply)
                    if json_match:
                        parsed = json.loads(json_match.group(0))
                        # Enforce statutory wage floor: material_cost + (days * 650)
                        mat_cost = float(parsed.get("material_cost", 2000))
                        days = int(parsed.get("production_days", 7))
                        wage_floor = mat_cost + (days * 650.0)
                        rec_price = max(float(parsed.get("recommended_price", wage_floor * 1.2)), wage_floor * 1.15)
                        parsed["material_cost"] = int(mat_cost)
                        parsed["production_days"] = days
                        parsed["recommended_price"] = int(round(rec_price, -1))
                        parsed["wage_floor"] = int(round(wage_floor, -1))
                        parsed["source"] = "sarvam_105b"
                        return {"success": True, "attributes": parsed}
            except Exception as e:
                logger.warning(f"Sarvam LLM extraction failed: {e}, using heuristic fallback")

        # Deterministic Indic Fallback parser
        t_lower = transcript.lower()
        is_silk = any(k in t_lower for k in ["सिल्क", "साड़ी", "रेशम", "बुनकर", "silk", "saree", "katan", "banarasi"])
        is_dhokra = any(k in t_lower for k in ["ढोकरा", "पीतल", "धातु", "नंदी", "dhokra", "brass", "bell metal", "tribal"])
        is_pottery = any(k in t_lower for k in ["मिट्टी", "बर्तन", "सिरेमिक", "पॉट", "खुर्जा", "pottery", "ceramic"])

        if is_silk:
            craft = "Varanasi Silk"
            name_hi = "पारंपरिक बनारसी कतान सिल्क साड़ी"
            name_en = "Varanasi Pure Katan Silk Handloom Saree"
            mat = ["शुद्ध कतान सिल्क", "स्वर्ण ज़री धागा"]
            days = 10
            mat_cost = 2800
        elif is_dhokra:
            craft = "Bastar Dhokra"
            name_hi = "बस्तर ढोकरा जनजातीय नंदी प्रतिमा"
            name_en = "Bastar Dhokra Tribal Bell Metal Nandi Figurine"
            mat = ["बेल मेटल", "पीतल", "प्राकृतिक मोम"]
            days = 5
            mat_cost = 650
        elif is_pottery:
            craft = "Khurja Pottery"
            name_hi = "खुर्जा हस्तनिर्मित ग्लेज्ड सिरेमिक वाटर पॉट"
            name_en = "Khurja Handcrafted Glazed Ceramic Water Pot"
            mat = ["टेराकोटा मिट्टी", "कोबाल्ट ग्लेज"]
            days = 3
            mat_cost = 350
        else:
            craft = "Indian Traditional Handicraft"
            name_hi = "हस्तनिर्मित पारंपरिक भारतीय शिल्प"
            name_en = "Authentic Indian Handcrafted Art"
            mat = ["प्राकृतिक सामग्री"]
            days = 6
            mat_cost = 1200

        wage_floor = mat_cost + (days * 650.0)
        rec_price = int(round(wage_floor * 1.25, -1))

        return {
            "success": True,
            "attributes": {
                "product_name_hi": name_hi,
                "product_name_en": name_en,
                "craft_type": craft,
                "materials": mat,
                "color": "पारंपरिक प्राकृतिक रंग",
                "dimensions": "मानक हस्तशिल्प आकार",
                "production_days": days,
                "material_cost": mat_cost,
                "wage_floor": int(round(wage_floor, -1)),
                "recommended_price": rec_price,
                "description_hi": f"हस्तशिल्पकार द्वारा {days} दिनों के समर्पित परिश्रम से निर्मित प्रामाणिक {craft}।",
                "description_en": f"Authentic {craft} meticulously created by master artisan over {days} days of skilled craftsmanship.",
                "voice_script_hi": f"बधाई हो! आपका उत्पाद {name_hi} तैयार है। आपकी {days} दिनों की मेहनत और कच्चे माल को जोड़कर इसका उचित बिक्री मूल्य ₹{rec_price} तय किया गया है।",
                "source": "indic_heuristics_fallback"
            }
        }


sarvam_service = SarvamService()


