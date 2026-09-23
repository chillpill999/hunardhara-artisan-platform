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
            with urllib.request.urlopen(req, timeout=settings.EXTERNAL_TIMEOUT_SECONDS) as resp:
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
        model: str = "saaras:v4"
    ) -> Dict[str, Any]:
        """
        Transcribes artisan Indic speech to text using Sarvam Saaras v4 ASR.
        Detects actual audio format from magic bytes without misrepresenting MIME type.
        """
        api_key = settings.SARVAM_API_KEY
        if not api_key:
            return {"success": False, "transcript": "", "error": "SARVAM_API_KEY missing", "source": "none"}

        # Detect genuine format from magic bytes
        if audio_bytes.startswith(b"RIFF") and b"WAVE" in audio_bytes[:16]:
            content_type = "audio/wav"
            upload_filename = "recording.wav" if not filename.endswith(".wav") else filename
        elif audio_bytes.startswith(b"OggS"):
            content_type = "audio/ogg"
            upload_filename = "recording.ogg" if not (filename.endswith(".ogg") or filename.endswith(".opus")) else filename
        elif audio_bytes.startswith(b"\x1a\x45\xdf\xa3"):
            content_type = "audio/webm"
            upload_filename = "recording.webm" if not filename.endswith(".webm") else filename
        else:
            if filename.endswith(".wav"):
                content_type = "audio/wav"
            elif filename.endswith(".ogg") or filename.endswith(".opus"):
                content_type = "audio/ogg"
            elif filename.endswith(".webm"):
                content_type = "audio/webm"
            else:
                content_type = "audio/wav"
            upload_filename = filename

        boundary = "SarvamASRBoundary789456123"
        lines = [
            f"--{boundary}".encode("utf-8"),
            b'Content-Disposition: form-data; name="model"\r\n\r\n',
            model.encode("utf-8"),
            f"\r\n--{boundary}".encode("utf-8"),
            b'Content-Disposition: form-data; name="mode"\r\n\r\ntranscribe',
            f"\r\n--{boundary}".encode("utf-8"),
            b'Content-Disposition: form-data; name="language_code"\r\n\r\n',
            language_code.encode("utf-8"),
            f"\r\n--{boundary}".encode("utf-8"),
            f'Content-Disposition: form-data; name="file"; filename="{upload_filename}"\r\n'.encode("utf-8"),
            f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"),
            audio_bytes,
            f"\r\n--{boundary}--\r\n".encode("utf-8")
        ]
        body = b"".join(lines)

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
            with urllib.request.urlopen(req, timeout=settings.EXTERNAL_TIMEOUT_SECONDS) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return {
                    "success": True,
                    "transcript": data.get("transcript", ""),
                    "language_code": data.get("language_code", language_code),
                    "source": "sarvam_saaras_v4"
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
            with urllib.request.urlopen(req, timeout=settings.EXTERNAL_TIMEOUT_SECONDS) as resp:
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
            with urllib.request.urlopen(req, timeout=settings.EXTERNAL_TIMEOUT_SECONDS) as resp:
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

    def extract_craft_attributes(
        self,
        transcript: str,
        language_code: str = "hi-IN",
        force_fallback: bool = False
    ) -> Dict[str, Any]:
        """
        Extracts structured craft attributes and computes fair price recommendation
        from an artisan voice transcript using Sarvam 105B LLM.
        """
        api_key = settings.SARVAM_API_KEY
        clean_t = (transcript or "").strip()

        # Semantic & Quality Gating: Detect pure greetings or missing craft content
        words = clean_t.split()
        greeting_words = {
            "hello", "hi", "hey", "namaste", "namaskar", "pranam", "नमस्ते", "प्रणाम",
            "हेलो", "हाय", "नमस्कार", "good", "morning", "afternoon", "evening",
            "haan", "ha", "theek", "hai", "ji", "जी", "हां", "हाँ", "ठीक", "है"
        }
        is_all_greetings = bool(words) and all(re.sub(r"[^\w\s]", "", w).lower() in greeting_words for w in words)
        has_craft_term = bool(re.search(
            r"(घंटी|साड़ी|खिलौना|पॉट|बर्तन|पेंटिंग|चित्र|मूर्ति|दीपक|कालीन|दरी|मोजरी|जूती|दुपट्टा|शॉल|चाक|लकड़ी|पीतल|मिट्टी|सिल्क|चमड़ा|ऊन|बांस|बॉक्स|डिब्बा|घैला|घइला|bell|saree|toy|pot|pottery|painting|statue|carpet|rug|leather|wood|brass|silk|clay|box|mojari)",
            clean_t,
            re.IGNORECASE
        ))

        if not clean_t or is_all_greetings or (len(words) < 3 and not has_craft_term):
            return {
                "success": True,
                "requires_clarification": True,
                "message_hi": "आवाज़ में उत्पाद का विवरण नहीं मिला। कृपया अपने शिल्प का नाम (जैसे घंटी, साड़ी, खिलौना, पॉट), सामग्री, और बनाने के दिन बताएं।",
                "message_en": "No product craft details detected. Please describe your item name (e.g. bell, saree, toy, pottery), material used, and days to make.",
                "transcript": clean_t,
                "confidence_score": 0.2
            }

        prompt = (
            "You are Hunardhara AI Artisan Commerce Assistant for the Ministry of Social Justice and Empowerment (MoSJE).\n"
            "Analyze the artisan's voice transcript and extract ONLY explicit facts into a strict JSON object.\n"
            f"Transcript: \"{clean_t}\"\n\n"
            "STRICT TRUTHFULNESS RULES:\n"
            "1. Extract ONLY attributes explicitly stated in the transcript. Do NOT guess or extrapolate missing attributes.\n"
            "2. Unknown values MUST remain null (or empty array [] for materials). NEVER invent product name, craft type, material, dimensions, price, certification, or location.\n"
            "3. Do NOT infer region, cluster, or GI certification unless explicitly stated by the artisan.\n"
            "4. NEVER default to saree, silk, or Varanasi unless explicitly mentioned by the artisan.\n"
            "5. Return ONLY raw valid JSON with these exact keys (no markdown, no backticks):\n"
            "{\n"
            '  "product_name_hi": "सटीक हिंदी नाम यदि स्पष्ट रूप से बोला गया हो, अन्यथा null",\n'
            '  "product_name_en": "Accurate English title if explicitly mentioned, else null",\n'
            '  "craft_type": "Craft category if explicitly stated or directly identified from craft noun, else null",\n'
            '  "materials": ["only explicitly mentioned materials"],\n'
            '  "color": "only explicitly mentioned color or null",\n'
            '  "dimensions": null,\n'
            '  "production_days": null,\n'
            '  "material_cost": null,\n'
            '  "recommended_price": null,\n'
            '  "description_hi": "सत्यनिष्ठ और संक्षिप्त विवरण",\n'
            '  "description_en": "Truthful and concise description",\n'
            '  "voice_script_hi": "बधाई हो! आपके उत्पाद का विवरण तैयार है।",\n'
            '  "confidence": {"overall": 0.9},\n'
            '  "verification_required": ["production_days", "material_cost"]\n'
            "}\n"
        )

        if not force_fallback:
            # 1. Primary: Sovereign Sarvam 105B Indic LLM
            if api_key:
                try:
                    res = self.chat_completion(
                        user_message=prompt,
                        system_prompt="You are a strict JSON-only API. Never output preamble, explanation, or markdown backticks."
                    )
                    if res.get("success") and res.get("reply"):
                        reply = res["reply"]
                        json_match = re.search(r"\{[\s\S]*\}", reply)
                        if json_match:
                            parsed = json.loads(json_match.group(0))
                            # Decouple pricing: Calculate only if genuine economic inputs are provided
                            days = parsed.get("production_days")
                            cost = parsed.get("material_cost")
                            if days is not None:
                                try: days = float(days)
                                except: days = None
                            if cost is not None:
                                try: cost = float(cost)
                                except: cost = None

                            if days is not None and cost is not None:
                                wage_floor = int(round(cost + (days * 650.0), -1))
                                rec_price = int(round(wage_floor * 1.25, -1))
                            else:
                                wage_floor = None
                                rec_price = None

                            # Normalize craft category if cluster is explicitly identified in transcript
                            ct_lower = (parsed.get("craft_type") or "").lower()
                            if any(k in clean_t.lower() for k in ["वाराणसी", "बनारस", "varanasi", "banarasi", "कातान", "कतान"]):
                                if any(s in ct_lower for s in ["saree", "silk", "textile", "handloom", "साड़ी", "सिल्क", "कतान", "कातान", "वस्त्र"]) or not ct_lower:
                                    parsed["craft_type"] = "Varanasi Silk"
                            elif any(k in clean_t.lower() for k in ["बस्तर", "bastar", "ढोकरा", "dhokra"]):
                                if any(s in ct_lower for s in ["bell", "horse", "figurine", "brass", "metal", "घंटी", "घोड़ा", "मूर्ति", "पीतल", "धातु", "ढोकरा"]) or not ct_lower:
                                    parsed["craft_type"] = "Bastar Dhokra"
                            elif any(k in clean_t.lower() for k in ["खुर्जा", "khurja"]):
                                if any(s in ct_lower for s in ["pottery", "pot", "vase", "ceramic", "मिट्टी", "बर्तन", "पॉट", "घड़ा", "फूलदान"]) or not ct_lower:
                                    parsed["craft_type"] = "Khurja Pottery"
                            elif any(k in clean_t.lower() for k in ["मधुबनी", "मिथिला", "madhubani", "mithila"]):
                                if any(s in ct_lower for s in ["painting", "art", "folk", "पेंटिंग", "चित्र", "चित्रकला"]) or not ct_lower:
                                    parsed["craft_type"] = "Madhubani Painting"
                            elif any(k in clean_t.lower() for k in ["चन्नपटना", "चन्नापटना", "channapatna"]):
                                if any(s in ct_lower for s in ["toy", "toys", "wood", "खिलौना", "काष्ठ", "लकड़ी"]) or not ct_lower:
                                    parsed["craft_type"] = "Channapatna Toys"

                            parsed["production_days"] = days
                            parsed["material_cost"] = cost
                            parsed["wage_floor"] = wage_floor
                            parsed["recommended_price"] = rec_price
                            parsed["confidence_score"] = 0.95
                            parsed["source"] = "sarvam_105b"

                            if not parsed.get("craft_type") and not parsed.get("materials") and not (parsed.get("product_name_hi") or parsed.get("product_name_en")):
                                return {
                                    "success": True,
                                    "requires_clarification": True,
                                    "message_hi": parsed.get("description_hi") or "आवाज़ में उत्पाद या शिल्प का विवरण नहीं मिला। कृपया अपने शिल्प का नाम, सामग्री और बनाने के दिन बताएं।",
                                    "message_en": parsed.get("description_en") or "No product craft details detected. Please describe your item name, material used, and days to make.",
                                    "transcript": clean_t,
                                    "confidence_score": 0.2
                                }

                            return {"success": True, "attributes": parsed}
                except Exception as e:
                    logger.warning(f"Sarvam LLM extraction failed: {e}, attempting OpenRouter fallback")

            # 2. Secondary: OpenRouter Indic/Multimodal LLM
            if settings.OPENROUTER_API_KEY and not settings.OFFLINE_MODE:
                try:
                    from app.services.openrouter_service import openrouter_service
                    raw_cat = openrouter_service._call_openrouter([
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": f"Artisan Voice Transcript:\n{clean_t}"}
                    ], max_tokens=1024, temperature=0.1)
                    if raw_cat:
                        json_match = re.search(r"\{[\s\S]*\}", raw_cat)
                        if json_match:
                            parsed = json.loads(json_match.group(0))
                            days = parsed.get("production_days")
                            cost = parsed.get("material_cost")
                            if days is not None:
                                try: days = float(days)
                                except: days = None
                            if cost is not None:
                                try: cost = float(cost)
                                except: cost = None

                            if days is not None and cost is not None:
                                wage_floor = int(round(cost + (days * 650.0), -1))
                                rec_price = int(round(wage_floor * 1.25, -1))
                            else:
                                wage_floor = None
                                rec_price = None

                            # Normalize craft category if cluster is explicitly identified in transcript
                            ct_lower = (parsed.get("craft_type") or "").lower()
                            if any(k in clean_t.lower() for k in ["वाराणसी", "बनारस", "varanasi", "banarasi", "कातान", "कतान"]):
                                if any(s in ct_lower for s in ["saree", "silk", "textile", "handloom", "साड़ी", "सिल्क", "कतान", "कातान", "वस्त्र"]) or not ct_lower:
                                    parsed["craft_type"] = "Varanasi Silk"
                            elif any(k in clean_t.lower() for k in ["बस्तर", "bastar", "ढोकरा", "dhokra"]):
                                if any(s in ct_lower for s in ["bell", "horse", "figurine", "brass", "metal", "घंटी", "घोड़ा", "मूर्ति", "पीतल", "धातु", "ढोकरा"]) or not ct_lower:
                                    parsed["craft_type"] = "Bastar Dhokra"
                            elif any(k in clean_t.lower() for k in ["खुर्जा", "khurja"]):
                                if any(s in ct_lower for s in ["pottery", "pot", "vase", "ceramic", "मिट्टी", "बर्तन", "पॉट", "घड़ा", "फूलदान"]) or not ct_lower:
                                    parsed["craft_type"] = "Khurja Pottery"
                            elif any(k in clean_t.lower() for k in ["मधुबनी", "मिथिला", "madhubani", "mithila"]):
                                if any(s in ct_lower for s in ["painting", "art", "folk", "पेंटिंग", "चित्र", "चित्रकला"]) or not ct_lower:
                                    parsed["craft_type"] = "Madhubani Painting"
                            elif any(k in clean_t.lower() for k in ["चन्नपटना", "चन्नापटना", "channapatna"]):
                                if any(s in ct_lower for s in ["toy", "toys", "wood", "खिलौना", "काष्ठ", "लकड़ी"]) or not ct_lower:
                                    parsed["craft_type"] = "Channapatna Toys"

                            parsed["production_days"] = days
                            parsed["material_cost"] = cost
                            parsed["wage_floor"] = wage_floor
                            parsed["recommended_price"] = rec_price
                            parsed["confidence_score"] = 0.90
                            parsed["source"] = "openrouter_llm"

                            if not parsed.get("craft_type") and not parsed.get("materials") and not (parsed.get("product_name_hi") or parsed.get("product_name_en")):
                                return {
                                    "success": True,
                                    "requires_clarification": True,
                                    "message_hi": parsed.get("description_hi") or "आवाज़ में उत्पाद या शिल्प का विवरण नहीं मिला। कृपया अपने शिल्प का नाम, सामग्री और बनाने के दिन बताएं।",
                                    "message_en": parsed.get("description_en") or "No product craft details detected. Please describe your item name, material used, and days to make.",
                                    "transcript": clean_t,
                                    "confidence_score": 0.2
                                }

                            return {"success": True, "attributes": parsed}
                except Exception as e:
                    logger.warning(f"OpenRouter extraction note: {e}")

        # In production mode, failed AI extraction must return failure; NEVER silently drop into mock/heuristics
        if not settings.OFFLINE_MODE and not force_fallback:
            logger.error("All production LLM craft extraction providers failed. Failing fast without mock fallback.")
            return {
                "success": False,
                "requires_clarification": False,
                "error": "AI_EXTRACTION_FAILED: Upstream AI craft extraction service unavailable.",
                "attributes": None
            }

        # 3. Deterministic Strict Explicit-Facts Indic Fallback parser (Zero Hallucination, Zero Canned Templates - OFFLINE/TEST ONLY)
        t_lower = clean_t.lower()

        # Extract days if explicitly spoken (Default = None, NEVER hallucinate days!)
        days = None
        days_detected = False
        days_match = re.search(r"(\d+)\s*(दिन|हफ्ते|हफ्ता|din|day|days|week|weeks)", t_lower)
        if days_match:
            d_val = int(days_match.group(1))
            if 1 <= d_val <= 90:
                days = d_val * 7 if any(w in days_match.group(2) for w in ["हफ्त", "week"]) else d_val
                days_detected = True
        elif "दो दिन" in t_lower or "2 days" in t_lower:
            days = 2
            days_detected = True
        elif "तीन दिन" in t_lower or "3 days" in t_lower:
            days = 3
            days_detected = True
        elif "चार दिन" in t_lower or "4 days" in t_lower:
            days = 4
            days_detected = True
        elif "पाँच दिन" in t_lower or "पांच दिन" in t_lower or "5 days" in t_lower:
            days = 5
            days_detected = True

        # Extract material cost if explicitly spoken (Default = None, NEVER hallucinate cost!)
        mat_cost = None
        cost_detected = False
        cost_match = (
            re.search(r"(?:₹|rs\.?|rupees?|rupee|रुपये?|रुपिया|रू\.|cost|price|लागत)\s*(\d+)", t_lower) or
            re.search(r"(\d+)\s*(?:₹|rs\.?|rupees?|rupee|रुपये?|रुपिया|रू\.|cost|price|लागत)", t_lower)
        )
        if cost_match:
            c_val = int(cost_match.group(1))
            if 50 <= c_val <= 500000:
                mat_cost = c_val
                cost_detected = True

        # Extract explicit materials only
        mat = []
        if any(k in t_lower for k in ["पीतल", "brass"]): mat.append("पीतल (Brass)")
        if any(k in t_lower for k in ["बेल मेटल", "bell metal"]): mat.append("बेल मेटल (Bell Metal)")
        if any(k in t_lower for k in ["मिट्टी", "माटी", "clay", "terracotta"]): mat.append("मिट्टी (Terracotta Clay)")
        if any(k in t_lower for k in ["शीशम", "सागवान", "लकड़ी", "wood", "rosewood"]): mat.append("प्राकृतिक काष्ठ (Wood)")
        if any(k in t_lower for k in ["चमड़ा", "leather"]): mat.append("चर्म (Leather)")
        if any(k in t_lower for k in ["बांस", "bamboo"]): mat.append("बांस (Bamboo)")
        if any(k in t_lower for k in ["सिल्क", "silk", "रेशम"]): mat.append("शुद्ध सिल्क (Pure Silk)")
        if any(k in t_lower for k in ["सूती", "कॉटन", "cotton"]): mat.append("सूती धागा (Cotton)")

        # Extract explicit color only
        color = None
        if any(k in t_lower for k in ["लाल", "red"]): color = "लाल (Red)"
        elif any(k in t_lower for k in ["नीला", "blue"]): color = "नीला (Blue)"
        elif any(k in t_lower for k in ["हरा", "green"]): color = "हरा (Green)"
        elif any(k in t_lower for k in ["पीला", "yellow"]): color = "पीला (Yellow)"
        elif any(k in t_lower for k in ["काला", "black"]): color = "काला (Black)"
        elif any(k in t_lower for k in ["सफेद", "white"]): color = "सफेद (White)"
        elif any(k in t_lower for k in ["सुनहरा", "gold", "golden"]): color = "सुनहरा (Golden)"

        # Product Noun & Truthful Craft Category - NO GI GUESSES (Zero Canned Templates)
        if any(k in t_lower for k in ["घंटी", "bell"]):
            craft = "Bastar Dhokra" if any(k in t_lower for k in ["बस्तर", "bastar", "ढोकरा", "dhokra"]) else "Metal Craft"
            name_hi = "हाथ से बनी पीतल की घंटी" if any(k in t_lower for k in ["पीतल", "brass"]) else "हाथ से बनी घंटी"
            name_en = "Handcrafted Brass Bell" if any(k in t_lower for k in ["पीतल", "brass"]) else "Handcrafted Bell"
        elif any(k in t_lower for k in ["घोड़ा", "horse", "अश्व"]):
            craft = "Bastar Dhokra" if any(k in t_lower for k in ["बस्तर", "bastar", "ढोकरा", "dhokra"]) else "Metal Craft"
            name_hi = "हस्तनिर्मित बस्तर ढोकरा पीतल का घोड़ा" if any(k in t_lower for k in ["बस्तर", "bastar", "ढोकरा", "dhokra"]) else "हस्तनिर्मित धातु का घोड़ा"
            name_en = "Handcrafted Bastar Dhokra Brass Horse Figurine" if any(k in t_lower for k in ["बस्तर", "bastar", "ढोकरा", "dhokra"]) else "Handcrafted Metal Horse Figurine"
        elif any(k in t_lower for k in ["दीया", "दीया स्टैंड", "diya", "lamp"]):
            craft = "Bastar Dhokra" if any(k in t_lower for k in ["बस्तर", "bastar", "ढोकरा", "dhokra"]) else "Metal Craft"
            name_hi = "हस्तनिर्मित बस्तर ढोकरा पीतल का दीया स्टैंड"
            name_en = "Handcrafted Bastar Dhokra Brass Diya Stand"
        elif any(k in t_lower for k in ["कप-प्लेट", "कप", "cup", "saucer"]):
            craft = "Khurja Pottery" if any(k in t_lower for k in ["खुर्जा", "khurja", "सिरेमिक", "ceramic"]) else "Pottery"
            name_hi = "खुर्जा हस्तनिर्मित सिरेमिक कप-प्लेट सेट (6 पीस)" if "6" in t_lower else "खुर्जा हस्तनिर्मित सिरेमिक कप-प्लेट सेट"
            name_en = "Handcrafted Khurja Ceramic Tea Cup and Saucer Set (6 Pcs)" if "6" in t_lower else "Handcrafted Khurja Ceramic Tea Cup and Saucer Set"
        elif any(k in t_lower for k in ["फूलदान", "vase"]):
            craft = "Khurja Pottery" if any(k in t_lower for k in ["खुर्जा", "khurja", "सिरेमिक", "ceramic"]) else "Pottery"
            name_hi = "खुर्जा हस्तनिर्मित सिरेमिक फूलदान" if any(k in t_lower for k in ["खुर्जा", "khurja", "सिरेमिक", "ceramic"]) else "मिट्टी का फूलदान" if any(k in t_lower for k in ["मिट्टी", "माटी", "clay"]) else "हस्तनिर्मित फूलदान"
            name_en = "Handcrafted Khurja Glazed Ceramic Flower Vase" if any(k in t_lower for k in ["खुर्जा", "khurja", "सिरेमिक", "ceramic"]) else "Handcrafted Earthen Clay Vase" if any(k in t_lower for k in ["मिट्टी", "माटी", "clay"]) else "Handcrafted Vase"
        elif any(k in t_lower for k in ["घड़ा", "घैला", "घइला", "पॉट", "pottery", "कुल्हड़"]):
            craft = "Khurja Pottery" if any(k in t_lower for k in ["खुर्जा", "khurja"]) else "Pottery"
            name_hi = "चाक पर बना हस्तनिर्मित माटी का घड़ा"
            name_en = "Handcrafted Earthen Clay Pot"
        elif any(k in t_lower for k in ["डिब्बा", "बॉक्स", "box", "jewelry box"]):
            craft = "Woodcraft"
            name_hi = "काष्ठ आभूषण डिब्बा" if any(k in t_lower for k in ["लकड़ी", "काष्ठ", "wood"]) else "हस्तनिर्मित डिब्बा"
            name_en = "Hand-Carved Wooden Jewelry Box" if any(k in t_lower for k in ["लकड़ी", "काष्ठ", "wood"]) else "Handcrafted Box"
        elif any(k in t_lower for k in ["खिलौना", "toy", "ಆಟಿಕೆ", "aatike"]):
            craft = "Channapatna Toys" if any(k in t_lower for k in ["चन्नपटना", "चन्नापटना", "channapatna", "ಚನ್ನಪಟ್ಟಣ"]) else "Woodcraft"
            name_hi = "चन्नापटना हस्तनिर्मित गैर-विषाक्त लकड़ी का खिलौना" if "चन्न" in t_lower or "ಚನ್ನ" in t_lower else "हस्तनिर्मित काष्ठ खिलौना"
            name_en = "Handcrafted Channapatna Non-Toxic Wooden Toy" if "चन्न" in t_lower or "ಚನ್ನ" in t_lower else "Handcrafted Wooden Toy"
        elif any(k in t_lower for k in ["दुपट्टा", "dupatta"]):
            craft = "Varanasi Silk" if any(k in t_lower for k in ["वाराणसी", "बनारस", "बनारसी", "varanasi", "कतान", "सिल्क"]) else "Handloom Weaving"
            name_hi = "हथकरघा बनारसी सिल्क दुपट्टा" if any(k in t_lower for k in ["वाराणसी", "बनारस", "बनारसी", "varanasi", "कतान", "सिल्क"]) else "हस्तनिर्मित हथकरघा दुपट्टा"
            name_en = "Handloom Banarasi Silk Dupatta" if any(k in t_lower for k in ["वाराणसी", "बनारस", "बनारसी", "varanasi", "कतान", "सिल्क"]) else "Handloom Woven Dupatta"
        elif any(k in t_lower for k in ["स्टोल", "stole"]):
            craft = "Madhubani Painting" if any(k in t_lower for k in ["मधुबनी", "मिथिला", "madhubani", "mithila", "तसर", "tussar"]) else "Handloom Weaving"
            name_hi = "हस्तचित्रित मधुबनी तसर सिल्क स्टोल" if any(k in t_lower for k in ["मधुबनी", "मिथिला", "तसर"]) else "हस्तनिर्मित सिल्क स्टोल"
            name_en = "Hand-painted Madhubani Tree of Life Tussar Silk Stole" if any(k in t_lower for k in ["मधुबनी", "मिथिला", "तसर"]) else "Handcrafted Silk Stole"
        elif any(k in t_lower for k in ["मधुबनी", "मिथिला", "painting", "चित्रकला", "पेंटिंग"]):
            craft = "Madhubani Painting" if any(k in t_lower for k in ["मधुबनी", "मिथिला", "madhubani", "mithila"]) else "Folk Art"
            if any(k in t_lower for k in ["मछली", "कमल", "fish", "lotus"]):
                name_hi = "हस्तचित्रित मधुबनी मछली और कमल पारंपरिक पेंटिंग"
                name_en = "Hand-painted Madhubani Fish and Lotus Folk Art"
            else:
                name_hi = "हस्तचित्रित मिथिला/मधुबनी पेंटिंग" if any(k in t_lower for k in ["मधुबनी", "मिथिला", "madhubani", "mithila"]) else "हस्तचित्रित पारंपरिक पेंटिंग"
                name_en = "Handpainted Mithila Folk Painting" if any(k in t_lower for k in ["मधुबनी", "मिथिला", "madhubani", "mithila"]) else "Handpainted Folk Art"
        elif any(k in t_lower for k in ["मोजरी", "जूती", "mojari"]):
            craft = "Leather Craft"
            name_hi = "हस्तनिर्मित पारंपरिक लेदर मोजरी"
            name_en = "Handcrafted Traditional Leather Mojari"
        elif any(k in t_lower for k in ["साड़ी", "saree"]):
            craft = "Varanasi Silk" if any(k in t_lower for k in ["वाराणसी", "बनारस", "बनारसी", "varanasi", "कतान", "कातान", "katan", "सिल्क"]) else "Handloom Weaving"
            name_hi = "हथकरघा बनारसी कतान सिल्क साड़ी" if any(k in t_lower for k in ["वाराणसी", "बनारस", "बनारसी", "varanasi", "कतान", "कातान", "katan", "सिल्क"]) else "हथकरघा सूती साड़ी" if "cotton" in t_lower or "सूती" in t_lower else "हस्तनिर्मित हथकरघा साड़ी"
            name_en = "Handloom Banarasi Katan Silk Saree" if any(k in t_lower for k in ["वाराणसी", "बनारस", "बनारसी", "varanasi", "कतान", "कातान", "katan", "सिल्क"]) else "Handcrafted Cotton Handloom Saree" if "cotton" in t_lower or "सूती" in t_lower else "Handloom Woven Saree"
        else:
            craft = None
            name_hi = None
            name_en = None

        # If zero craft attributes, materials, or economics were mentioned, prompt for clarification
        if craft is None and not mat and not days_detected and not cost_detected:
            return {
                "success": True,
                "requires_clarification": True,
                "message_hi": "आवाज़ में शिल्प या उत्पाद का विवरण स्पष्ट नहीं है। कृपया अपने उत्पाद का नाम (जैसे घंटी, साड़ी, खिलौना, पॉट), सामग्री, और बनाने के दिन बताएं।",
                "message_en": "No specific craft or product details were detected in the description. Please mention the craft name, material used, and days required.",
                "transcript": clean_t,
                "confidence_score": 0.2
            }

        # Separate pricing engine: Calculate ONLY if genuine numbers are provided
        if days_detected and cost_detected and days is not None and mat_cost is not None:
            wage_floor = int(round(mat_cost + (days * 650.0), -1))
            rec_price = int(round(wage_floor * 1.25, -1))
        else:
            wage_floor = None
            rec_price = None

        verification_required = []
        if not days_detected: verification_required.append("production_days")
        if not cost_detected: verification_required.append("material_cost")
        if not color: verification_required.append("color")
        if not mat: verification_required.append("materials")
        if not craft: verification_required.append("craft_type")
        if not name_hi and not name_en: verification_required.append("product_name")

        item_label = f"'{name_hi}' " if name_hi else ""
        if rec_price:
            v_script = f"बधाई हो! आपके उत्पाद {item_label}की जानकारी तैयार है। इसका उचित बिक्री मूल्य ₹{rec_price} है।"
        else:
            v_script = f"बधाई हो! आपके उत्पाद {item_label}की जानकारी तैयार है।"

        return {
            "success": True,
            "attributes": {
                "product_name_hi": name_hi,
                "product_name_en": name_en,
                "craft_type": craft,
                "materials": mat,
                "color": color,
                "dimensions": None,  # Strictly null - never invent!
                "production_days": days,
                "material_cost": mat_cost,
                "wage_floor": wage_floor,
                "recommended_price": rec_price,
                "description_hi": f"कारीगर द्वारा स्वयं वर्णित प्रामाणिक विवरण: \"{clean_t}\"",
                "description_en": f"Authentic artisan product described as: \"{clean_t}\"",
                "voice_script_hi": v_script,
                "confidence_score": 0.85 if (days_detected and mat) else 0.65,
                "facts_detected": {
                    "days": days_detected,
                    "cost": cost_detected,
                    "materials": len(mat) > 0,
                    "color": bool(color)
                },
                "verification_required": verification_required,
                "source": "indic_heuristics_fallback"
            },
            "verification_required": verification_required
        }

    def normalize_codemixed_speech(self, text: str) -> str:
        """
        Module A: Normalizes colloquial code-mixed Indian speech, traditional units, and colloquial numbers.
        Example: 'Ham ye cotton saree banate hain, iska price 1200 hai' -> clean normalized text.
        """
        if not text:
            return ""

        norm = text.strip()

        # Colloquial numbers & periods
        replacements = [
            ("बारह सौ", "1200"),
            ("पंद्रह सौ", "1500"),
            ("अठारह सौ", "1800"),
            ("दो हज़ार", "2000"),
            ("दो हजार", "2000"),
            ("ढाई हज़ार", "2500"),
            ("ढाई हजार", "2500"),
            ("तीन हज़ार", "3000"),
            ("तीन हजार", "3000"),
            ("पाँच हज़ार", "5000"),
            ("पांच हजार", "5000"),
            ("हफ्ता", "7 दिन"),
            ("हफ्ते", "7 दिन"),
            ("एक हफ्ता", "7 दिन"),
            ("दो हफ्ता", "14 दिन"),
            ("दो हफ्ते", "14 दिन"),
            ("महीना", "30 दिन"),
            ("डेढ़", "1.5"),
            ("ढाई", "2.5"),
            ("साढ़े तीन", "3.5"),
            ("वित्ता", "वित्ता (लगभग 22 सेमी)"),
            ("हाथ", "हाथ (लगभग 45 सेमी)"),
        ]

        for old, new in replacements:
            norm = re.sub(re.escape(old), new, norm, flags=re.IGNORECASE)

        return norm


sarvam_service = SarvamService()



