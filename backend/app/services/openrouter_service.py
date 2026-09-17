import os
import json
import time
import base64
import re
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List

from app.core.config import settings
from app.schemas.voice import VoiceCraftAttributes, MarketingDescription, VoiceCatalogResponse
from app.schemas.image_understanding import ImageUnderstandingResponse
from app.services.offline_mock_engine import offline_voice_engine

logger = logging.getLogger("artisan_platform.openrouter_service")


class OpenRouterService:
    """
    AI Service integrating Google Gemma 4 31B (google/gemma-4-31b-it:free) via OpenRouter.
    Provides:
    1. Structured E-commerce Catalogue Generation (Indic Voice & Text)
    2. Multimodal Handicraft Image Understanding & Visual Inspection
    """

    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.model = settings.OPENROUTER_MODEL or "google/gemma-4-31b-it:free"
        self.base_url = settings.OPENROUTER_BASE_URL.rstrip("/")
        self.endpoint = f"{self.base_url}/chat/completions"

    def _call_openrouter(self, messages: List[Dict[str, Any]], max_tokens: int = 1500, temperature: float = 0.2) -> Optional[str]:
        """Executes chat completion with exponential backoff on 429 rate limits."""
        if not self.api_key or settings.OFFLINE_MODE:
            logger.info("OpenRouter key not configured or OFFLINE_MODE active; skipping remote call.")
            return None

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://hunardhara.workers.dev",
            "X-Title": "HunarDhara Artisan Platform"
        }

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }

        # Try up to 2 attempts with backoff
        for attempt in range(2):
            try:
                req = urllib.request.Request(
                    self.endpoint,
                    headers=headers,
                    data=json.dumps(payload).encode("utf-8")
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    if resp.status == 200:
                        body = json.loads(resp.read().decode("utf-8"))
                        choices = body.get("choices", [])
                        if choices:
                            return choices[0].get("message", {}).get("content", "")
            except urllib.error.HTTPError as e:
                err_msg = e.read().decode("utf-8", errors="ignore")
                logger.warning(f"OpenRouter HTTP {e.code} (attempt {attempt+1}): {err_msg}")
                if e.code == 429 and attempt == 0:
                    time.sleep(2.0)
                    continue
                return None
            except Exception as e:
                logger.warning(f"OpenRouter invocation failed (attempt {attempt+1}): {e}")
                return None

        return None

    def generate_catalog(self, transcript: str, language_code: str = "hi") -> VoiceCatalogResponse:
        """
        Generates 7 structured craft attributes, bilingual descriptions, and SEO tags
        using Google Gemma 4 31B from spoken/written transcript.
        """
        system_prompt = (
            "You are an expert Indian Handicrafts curator for the Ministry of Social Justice and Empowerment (MoSJE). "
            "Given an artisan spoken craft description, extract structured catalog attributes and create compelling bilingual marketing copy. "
            "Return ONLY a valid, parseable JSON object without markdown formatting or code blocks, conforming to this exact structure:\n"
            "{\n"
            '  "product_name": "Name of product in English",\n'
            '  "craft_type": "Recognized GI/traditional craft category (e.g. Varanasi Silk, Bastar Dhokra, Khurja Pottery, Madhubani Art, Channapatna Toys)",\n'
            '  "materials": ["list", "of", "materials"],\n'
            '  "dimensions": "Dimensions string e.g. 15cm x 12cm x 6cm or 5.5m x 1.2m",\n'
            '  "production_time_days": 4.0,\n'
            '  "technique": "Specific traditional technique (e.g. Lost-Wax Casting, Handloom Jacquard, High-Fire Kiln Glazing)",\n'
            '  "color": "Dominant colors and finish",\n'
            '  "marketing_description": {\n'
            '    "hi": "Compelling marketing description in Hindi (Devanagari)",\n'
            '    "en": "Compelling marketing description in English"\n'
            "  },\n"
            '  "seo_tags": ["Tag1", "Tag2", "Tag3", "Tag4", "Tag5"]\n'
            "}"
        )

        user_prompt = f"Artisan Voice Transcript ({language_code}):\n\"{transcript}\""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        raw_output = self._call_openrouter(messages, max_tokens=1024, temperature=0.1)

        if raw_output:
            try:
                # Extract JSON block
                match = re.search(r'\{[\s\S]*\}', raw_output)
                if match:
                    parsed = json.loads(match.group(0))
                    p_days = parsed.get("production_time_days")
                    if p_days is not None:
                        try:
                            p_days = float(p_days)
                        except Exception:
                            p_days = None

                    attributes = VoiceCraftAttributes(
                        product_name=parsed.get("product_name") or None,
                        craft_type=parsed.get("craft_type") or None,
                        materials=parsed.get("materials") or [],
                        dimensions=parsed.get("dimensions") or None,
                        production_time_days=p_days,
                        technique=parsed.get("technique") or None,
                        color=parsed.get("color") or None
                    )
                    mkt = parsed.get("marketing_description", {})
                    p_title = attributes.product_name or ""
                    marketing_description = MarketingDescription(
                        hi=mkt.get("hi", transcript),
                        en=mkt.get("en", f"Handcrafted {p_title} created with traditional technique." if p_title else transcript)
                    )
                    base_tags = [attributes.craft_type, "Indian Handicrafts", "Artisan Made", "Authentic Heritage"]
                    tags = [t for t in parsed.get("seo_tags", base_tags) if t and "MoSJE Certified" not in t]
                    if len(tags) < 5:
                        tags.extend(["Handcrafted", "Traditional Art"])

                    return VoiceCatalogResponse(
                        transcript_original=transcript,
                        transcript_english=marketing_description.en,
                        attributes=attributes,
                        marketing_description=marketing_description,
                        seo_tags=tags[:8],
                        is_offline_mock=False
                    )
            except Exception as parse_err:
                logger.warning(f"Gemma 4 catalog parsing error: {parse_err}. Output was: {raw_output[:200]}")

        # Fallback handling:
        if settings.OFFLINE_MODE:
            logger.info("Using deterministic offline engine fallback for catalog generation (explicit OFFLINE_MODE)")
            return offline_voice_engine.process_audio(
                audio_bytes=b"\x00" * 100,
                filename="synthetic_audio.wav",
                sample_text=transcript,
                language_code=language_code
            )
        # Production: fail truthfully, never silently fall back to mock engine
        raise ValueError("CATALOG_GENERATION_FAILED: Upstream AI model failed to extract catalog attributes.")

    def analyze_craft_image(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        hint: Optional[str] = None
    ) -> ImageUnderstandingResponse:
        """
        Multimodal image inspection using Google Gemma 4 31B vision capabilities.
        Detects Indian craft cluster, materials, techniques, and prepares catalog attributes.
        """
        data_url = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode('utf-8')}"

        system_instruction = (
            "You are an expert Indian Handicraft inspector and visual appraiser for the Ministry of Social Justice and Empowerment (MoSJE). "
            "Inspect the craft image carefully and identify the exact traditional Indian craft cluster. "
            "Common craft clusters include: Bastar Dhokra (bell metal lost-wax), Varanasi Silk (brocade/katan handloom), "
            "Khurja Pottery (glazed ceramic floral), Madhubani Art (Mithila painting), Channapatna Toys (lacquerware wood). "
            "Return ONLY a valid JSON object matching these exact keys: "
            "craft_type, product_name_hi, product_name_en, materials (list of strings), technique, dominant_colors (list of strings), "
            "estimated_dimensions, estimated_production_days (float), suggested_retail_price (float in INR), description_hi, description_en, "
            "artisan_heritage_notes, visual_quality_score (float 1.0 to 10.0)."
        )

        user_content = [
            {"type": "text", "text": f"Please inspect this artisan handicraft. {f'Hint: {hint}' if hint else ''}"},
            {"type": "image_url", "image_url": {"url": data_url}}
        ]

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_content}
        ]

        raw_output = self._call_openrouter(messages, max_tokens=1024, temperature=0.1)

        if raw_output:
            try:
                match = re.search(r'\{[\s\S]*\}', raw_output)
                if match:
                    parsed = json.loads(match.group(0))
                    return ImageUnderstandingResponse(
                        success=True,
                        craft_type=parsed.get("craft_type", "Traditional Indian Craft"),
                        product_name_hi=parsed.get("product_name_hi", "पारंपरिक हस्तनिर्मित शिल्प"),
                        product_name_en=parsed.get("product_name_en", "Handcrafted Indian Heritage Craft"),
                        materials=parsed.get("materials", ["Traditional Raw Materials"]),
                        technique=parsed.get("technique", "Handmade Heritage Craft"),
                        dominant_colors=parsed.get("dominant_colors", ["Natural"]),
                        estimated_dimensions=parsed.get("estimated_dimensions", "20cm x 15cm x 10cm"),
                        estimated_production_days=float(parsed.get("estimated_production_days", 5.0)),
                        suggested_retail_price=float(parsed.get("suggested_retail_price", 2400.0)),
                        description_hi=parsed.get("description_hi", "हाथ से निर्मित उत्कृष्ट पारंपरिक कलाकृति।"),
                        description_en=parsed.get("description_en", "Authentic handcrafted heritage item made by skilled artisans."),
                        artisan_heritage_notes=parsed.get("artisan_heritage_notes", "Preserving indigenous cultural craftsmanship under MoSJE support."),
                        visual_quality_score=float(parsed.get("visual_quality_score", 9.0)),
                        model=self.model,
                        provider="openrouter",
                        raw_analysis=raw_output
                    )
            except Exception as e:
                logger.warning(f"Error parsing Gemma 4 image understanding output: {e}")

        # In production mode: return real failure, NEVER fake success with canned craft attributes!
        if not settings.OFFLINE_MODE:
            logger.error("Vision inspection failed or unavailable in production mode")
            return ImageUnderstandingResponse(
                success=False,
                error="VISION_SERVICE_UNAVAILABLE: Upstream vision analysis service failed or is not configured.",
                craft_type=None,
                product_name_hi=None,
                product_name_en=None,
                materials=[],
                technique=None,
                dominant_colors=[],
                description_hi=None,
                description_en=None,
                visual_quality_score=None,
                model=self.model,
                provider="openrouter"
            )

        # Isolated explicit OFFLINE_MODE fallback only
        return self._heuristic_image_analysis(hint=hint)

    def _heuristic_image_analysis(self, hint: Optional[str] = None) -> ImageUnderstandingResponse:
        """Sovereign fallback when offline or upstream rate-limited."""
        h = (hint or "").lower()
        if "silk" in h or "saree" in h or "बनारस" in h or "सिल्क" in h:
            return ImageUnderstandingResponse(
                success=True,
                craft_type="Varanasi Silk",
                product_name_hi="पारंपरिक बनारसी कतान सिल्क साड़ी",
                product_name_en="Varanasi Pure Katan Silk Brocade Saree",
                materials=["Pure Katan Silk", "Gold Zari Thread"],
                technique="Handloom Jacquard Brocade Weaving",
                dominant_colors=["Royal Crimson", "Gold"],
                estimated_dimensions="5.5m x 1.2m with blouse piece",
                estimated_production_days=10.0,
                suggested_retail_price=11650.0,
                description_hi="शुद्ध कतान सिल्क पर सोने की ज़री का काम, हाथ से बुनी गई पारंपरिक बनारसी साड़ी।",
                description_en="Master handwoven Varanasi pure katan silk saree adorned with intricate gold zari brocade motifs.",
                artisan_heritage_notes="Varanasi Silk Cluster GI-certified heritage weaving tradition.",
                visual_quality_score=9.4,
                model="google/gemma-4-31b-it:free (offline fallback)",
                provider="openrouter-resilient-fallback"
            )
        elif "dhokra" in h or "brass" in h or "पीतल" in h or "ढोकरा" in h:
            return ImageUnderstandingResponse(
                success=True,
                craft_type="Bastar Dhokra",
                product_name_hi="बस्तर ढोकरा जनजातीय पीतल नंदी",
                product_name_en="Bastar Dhokra Tribal Bell Metal Nandi Figurine",
                materials=["Bell Metal", "Brass", "Natural Beeswax"],
                technique="4,000-Year-Old Lost-Wax Bell Metal Casting",
                dominant_colors=["Antique Brass Bronze"],
                estimated_dimensions="18cm x 14cm x 8cm",
                estimated_production_days=5.0,
                suggested_retail_price=2450.0,
                description_hi="प्राचीन लॉस्ट-वैक्स तकनीक से निर्मित बस्तर ढोकरा पीतल का जनजातीय शिल्प।",
                description_en="Authentic hand-cast Bastar Dhokra brass figurine sculpted by master tribal artisans.",
                artisan_heritage_notes="Bastar tribal heritage GI craft from Chhattisgarh.",
                visual_quality_score=9.2,
                model="google/gemma-4-31b-it:free (offline fallback)",
                provider="openrouter-resilient-fallback"
            )
        elif "pottery" in h or "ceramic" in h or "खुर्जा" in h:
            return ImageUnderstandingResponse(
                success=True,
                craft_type="Khurja Pottery",
                product_name_hi="खुर्जा हस्तनिर्मित सेरामिक फूलदान",
                product_name_en="Khurja Hand-Painted Ceramic Floral Vase",
                materials=["Ceramic Clay", "High-Fire Glaze", "Cobalt Pigment"],
                technique="Wheel Throwing and High-Fire Kiln Glazing",
                dominant_colors=["Cobalt Blue", "Ivory White"],
                estimated_dimensions="25cm x 15cm x 15cm",
                estimated_production_days=3.0,
                suggested_retail_price=1450.0,
                description_hi="उत्तर प्रदेश के खुर्जा के मास्टर कुम्हारों द्वारा चाक पर तराशी गई सेरामिक फूलदान।",
                description_en="Artisanal glazed ceramic flower vase handcrafted by heritage Khurja potters.",
                artisan_heritage_notes="Khurja Blue Pottery GI Cluster, Uttar Pradesh.",
                visual_quality_score=8.9,
                model="google/gemma-4-31b-it:free (offline fallback)",
                provider="openrouter-resilient-fallback"
            )
        else:
            return ImageUnderstandingResponse(
                success=True,
                craft_type="Handicrafts & Art",
                product_name_hi="पारंपरिक हस्तनिर्मित शिल्प",
                product_name_en="Handcrafted Indian Heritage Item",
                materials=["Natural Craft Raw Materials"],
                technique="Traditional Handcrafted Technique",
                dominant_colors=["Natural"],
                estimated_dimensions=None,
                estimated_production_days=None,
                suggested_retail_price=None,
                description_hi="कारीगर द्वारा हाथ से निर्मित पारंपरिक कलाकृति।",
                description_en="Authentic handcrafted heritage item made by skilled Indian artisan.",
                artisan_heritage_notes="Preserving indigenous cultural craftsmanship under MoSJE support.",
                visual_quality_score=8.5,
                model="sovereign-vision-curator",
                provider="sovereign-ai"
            )


openrouter_service = OpenRouterService()
