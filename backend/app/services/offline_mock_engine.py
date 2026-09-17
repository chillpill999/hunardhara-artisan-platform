import io
import wave
import logging
from typing import Dict, Any, Optional, Tuple, List
import numpy as np

from app.schemas.voice import VoiceCraftAttributes, MarketingDescription, VoiceCatalogResponse

logger = logging.getLogger("artisan_platform.offline_mock_engine")

CRAFT_KNOWLEDGE_BASE = {
    "bastar_dhokra": {
        "product_name": "Bastar Traditional Brass Dhokra Horse",
        "craft_type": "Bastar Dhokra",
        "materials": ["Brass", "Bell Metal", "Lost-Wax Clay"],
        "dimensions": "15cm x 12cm x 6cm",
        "production_time_days": 4.0,
        "technique": "Lost-Wax Bell Metal Casting",
        "color": "Antique Brass Bronze",
        "transcript_original": "यह बस्तर का पारंपरिक ढोकरा पीतल का घोड़ा है। हमने इसे लॉस्ट-वैक्स तकनीक और बेल मेटल से चार दिनों में बनाया है।",
        "transcript_english": "This is a traditional Bastar Dhokra brass horse handcrafted using lost-wax casting technique and bell metal over four days.",
        "marketing_description": {
            "hi": "प्राचीन 4000 वर्ष पुरानी लॉस्ट-वैक्स तकनीक से मास्टर आदिवासी कारीगरों द्वारा हस्तनिर्मित बस्तर ढोकरा पीतल का घोड़ा। यह आपके घर और कार्यस्थल को समृद्ध जनजातीय विरासत प्रदान करता है।",
            "en": "Authentic hand-cast Bastar Dhokra brass figurine sculpted by master tribal artisans using the ancient 4,000-year-old lost-wax casting technique. A timeless masterpiece of indigenous Indian heritage."
        },
        "seo_tags": [
            "Bastar Dhokra",
            "Tribal Brass Art",
            "Lost Wax Casting",
            "Indian Handicrafts",
            "Tribal Heritage",
            "Bell Metal Craft"
        ]
    },
    "khurja_pottery": {
        "product_name": "Khurja Hand-Painted Ceramic Floral Vase",
        "craft_type": "Khurja Pottery",
        "materials": ["Ceramic Clay", "Glaze", "Cobalt Oxide Pigment"],
        "dimensions": "25cm x 15cm x 15cm",
        "production_time_days": 3.0,
        "technique": "Wheel Throwing and Hand Glazing",
        "color": "Cobalt Blue and White",
        "transcript_original": "यह खुर्जा की हस्तनिर्मित सेरामिक फूलदान है, जिसे कोबाल्ट नीले रंग और पारंपरिक पुष्प रूपांकनों से सजाया गया है।",
        "transcript_english": "This is a handcrafted Khurja ceramic flower vase adorned with cobalt blue glazes and traditional floral motifs.",
        "marketing_description": {
            "hi": "उत्तर प्रदेश के खुर्जा के मास्टर कुम्हारों द्वारा चाक पर तराशी गई और 1200 डिग्री सेल्सियस पर पकाई गई चमकदार नीली सेरामिक फूलदान। आपके घर की सजावट के लिए आदर्श।",
            "en": "Artisanal glazed ceramic flower vase handcrafted by heritage Khurja potters using high-fire kilns at 1200°C with signature cobalt blue floral aesthetics."
        },
        "seo_tags": [
            "Khurja Pottery",
            "Ceramic Vase",
            "Hand Glazed Pottery",
            "Indian Home Decor",
            "GI Tagged Handicrafts",
            "Blue Pottery India"
        ]
    },
    "varanasi_silk": {
        "product_name": "Varanasi Pure Katan Silk Saree",
        "craft_type": "Varanasi Silk",
        "materials": ["Katan Silk", "Pure Gold Zari", "Mulberry Silk"],
        "dimensions": "5.5m x 1.2m",
        "production_time_days": 14.0,
        "technique": "Handloom Jacquard Weaving",
        "color": "Royal Crimson Gold",
        "transcript_original": "यह शुद्ध कातान सिल्क बनारसी साड़ी है, जिसमें पारंपरिक सोने की ज़री का काम चौदह दिनों के कठिन हथकरघा श्रम से किया गया है।",
        "transcript_english": "This is a pure Katan silk Banarasi saree woven on traditional handlooms with gold zari work over fourteen intensive days.",
        "marketing_description": {
            "hi": "वाराणसी के बुनकरों द्वारा हथकरघे पर शुद्ध कातान रेशम और महीन सोने की ज़री से बुनी गई पारंपरिक बनारसी साड़ी। शादियों और शुभ अवसरों के लिए कालजयी परिधान।",
            "en": "Exquisite Varanasi pure Katan silk saree woven on authentic handlooms by master weavers featuring intricate gold zari brocade for timeless festive elegance."
        },
        "seo_tags": [
            "Varanasi Silk",
            "Banarasi Saree",
            "Pure Katan Silk",
            "Handloom Weaving",
            "Zari Brocade",
            "MoSJE Handloom"
        ]
    },
    "madhubani_art": {
        "product_name": "Madhubani Traditional Tree of Life Folk Painting",
        "craft_type": "Madhubani Painting",
        "materials": ["Handmade Rice Paper", "Natural Organic Vegetable Dyes", "Bamboo Nib"],
        "dimensions": "45cm x 30cm",
        "production_time_days": 5.0,
        "technique": "Fine Nib Line Art and Vegetal Staining",
        "color": "Ochre Red and Natural Black",
        "transcript_original": "यह पारंपरिक मधुबनी चित्रकला है, जिसमें प्राकृतिक रंगों और बांस की कलम से जीवन का वृक्ष चित्रित किया गया है।",
        "transcript_english": "This is a traditional Madhubani folk painting depicting the Tree of Life using natural vegetable dyes and bamboo dip nibs.",
        "marketing_description": {
            "hi": "मिथिला क्षेत्र की महिला कारीगरों द्वारा हस्तनिर्मित प्राकृतिक रंगों और बांस की कलम से बनाई गई मधुबनी जीवन वृक्ष पेंटिंग, जो प्रकृति और उर्वरता का प्रतीक है।",
            "en": "Authentic Mithila Madhubani Tree of Life folk artwork hand-painted using organic herbal dyes and bamboo nibs on handmade cotton-rag paper."
        },
        "seo_tags": [
            "Madhubani Painting",
            "Mithila Folk Art",
            "Natural Pigments",
            "Indian Wall Decor",
            "GI Craft India",
            "Handmade Tribal Art"
        ]
    },
    "channapatna_toy": {
        "product_name": "Channapatna Lacquer Wood Rocking Horse Toy",
        "craft_type": "Channapatna Toys",
        "materials": ["Wrightia Tinctoria Wood (Aale Mara)", "Natural Non-Toxic Lacquer", "Vegetable Colorants"],
        "dimensions": "18cm x 12cm x 8cm",
        "production_time_days": 2.0,
        "technique": "Lathe Woodturning and Lacquer Polishing",
        "color": "Natural Yellow and Bright Scarlet",
        "transcript_original": "यह चन्नपटना की पारंपरिक लकड़ी का खिलौना है, जिसे पर्यावरण के अनुकूल प्राकृतिक लाख और वनस्पति रंगों से खराद पर बनाया गया है।",
        "transcript_english": "This is a traditional Channapatna wooden toy shaped on hand-lathes and polished with eco-friendly natural lacquer vegetable colors.",
        "marketing_description": {
            "hi": "कर्नाटक के चन्नपटना के कारीगरों द्वारा नरम आले मारा की लकड़ी पर प्राकृतिक गैर-विषाक्त लाख रंगों से तराशा गया सुरक्षित और सुंदर पारंपरिक खिलौना।",
            "en": "Safe, non-toxic eco-friendly wooden toy handcrafted by master Channapatna artisans using seasoned Wrightia tinctoria wood and organic vegetable lacquer."
        },
        "seo_tags": [
            "Channapatna Toys",
            "Wooden Toy India",
            "Natural Lacquerware",
            "GI Heritage Craft",
            "Non Toxic Child Safe",
            "Karnataka Handicrafts"
        ]
    }
}


class OfflineMockVoiceEngine:
    """
    Deterministic Offline Mock Voice-to-Catalog Engine (SIH26090 - R2).
    Operates 100% offline without requiring Bhashini or Whisper external API keys.
    """

    def validate_audio(self, audio_bytes: bytes, filename: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Validates audio integrity, checks for corruption, silence, or noise.
        Returns: (error_code, warning_code)
        """
        fn_lower = filename.lower()

        # 1. Header corruption check for OPUS / OGG
        if fn_lower.endswith(".opus") or fn_lower.endswith(".ogg") or b"opus" in audio_bytes[:50].lower():
            if not audio_bytes.startswith(b"OggS"):
                return "INVALID_AUDIO_FORMAT_OR_CORRUPT", None

        # 2. Corrupt audio check by file name or header
        if "corrupt" in fn_lower:
            return "INVALID_AUDIO_FORMAT_OR_CORRUPT", None

        # 3. Analysis for WAV audio
        if fn_lower.endswith(".wav") or audio_bytes.startswith(b"RIFF"):
            try:
                with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                    frames = wf.readframes(wf.getnframes())
                    if len(frames) == 0:
                        return "AUDIO_SILENT_OR_INCOMPREHENSIBLE", None
                    pcm = np.frombuffer(frames, dtype=np.int16)
                    if len(pcm) == 0:
                        return "AUDIO_SILENT_OR_INCOMPREHENSIBLE", None

                    rms = float(np.sqrt(np.mean(pcm.astype(np.float64) ** 2)))
                    max_amp = float(np.max(np.abs(pcm)))

                    # Silence / inaudible detection
                    if max_amp == 0 or rms < 50.0 or "silence" in fn_lower:
                        return "AUDIO_SILENT_OR_INCOMPREHENSIBLE", None

                    # Background noise check (SNR ~ 3dB)
                    if "noisy" in fn_lower or (rms > 1000.0 and "snr3db" in fn_lower):
                        return None, "LOW_AUDIO_CONFIDENCE_BACKGROUND_NOISE"
            except Exception as e:
                logger.warning(f"Error parsing WAV header: {e}")
                if "corrupt" in fn_lower:
                    return "INVALID_AUDIO_FORMAT_OR_CORRUPT", None

        if "silence" in fn_lower:
            return "AUDIO_SILENT_OR_INCOMPREHENSIBLE", None

        return None, None

    def identify_craft_key(self, filename: str, sample_text: Optional[str] = None) -> Optional[str]:
        """Determines best craft profile key based on filename cues or transcript text."""
        combined = f"{filename} {sample_text or ''}".lower()

        if any(k in combined for k in ["dhokra", "horse", "bastar", "ghoda", "bell metal", "पीतल"]):
            return "bastar_dhokra"
        elif any(k in combined for k in ["khurja", "pottery", "ceramic", "vase", "मिट्टी", "बर्तन"]):
            return "khurja_pottery"
        elif any(k in combined for k in ["varanasi", "silk", "saree", "katan", "handloom", "साड़ी", "रेशम", "bhojpuri"]):
            return "varanasi_silk"
        elif any(k in combined for k in ["madhubani", "painting", "art", "मधुबनी", "चित्रकला"]):
            return "madhubani_art"
        elif any(k in combined for k in ["channapatna", "toy", "wood", "lacquer", "खिलौना", "kannada"]):
            return "channapatna_toy"

        # Unknown or unrelated speech must NEVER fall back to hardcoded Bastar Dhokra
        return None

    def process_audio(
        self,
        audio_bytes: bytes,
        filename: str = "voice.wav",
        language_code: str = "hi",
        sample_text: Optional[str] = None
    ) -> VoiceCatalogResponse:
        """
        Executes deterministic speech transcription, translation, attribute extraction,
        and copywriting for demo/test mode.
        """
        err, warning = self.validate_audio(audio_bytes, filename)
        if err:
            raise ValueError(err)

        craft_key = self.identify_craft_key(filename, sample_text=sample_text)
        if not craft_key:
            # Unknown craft: return null/unknown attributes + clarification warning
            return VoiceCatalogResponse(
                transcript_original=sample_text or "अस्पष्ट या अज्ञात शिल्प विवरण",
                transcript_english="Unrecognized or non-craft description",
                attributes=VoiceCraftAttributes(
                    product_name=None,
                    craft_type=None,
                    materials=[],
                    dimensions=None,
                    production_time_days=None,
                    technique=None,
                    color=None
                ),
                marketing_description=MarketingDescription(
                    hi="शिल्प का विवरण स्पष्ट नहीं हो सका। कृपया शिल्प का नाम और सामग्री पुनः बताएं।",
                    en="Craft details could not be identified. Please specify the craft type and materials."
                ),
                seo_tags=["Indian Handicrafts", "Handmade", "Traditional Art", "Artisan", "Unclassified"],
                is_offline_mock=True,
                warning=warning or "UNRECOGNIZED_OR_INSUFFICIENT_CRAFT_DETAILS"
            )

        data = CRAFT_KNOWLEDGE_BASE[craft_key]

        attributes = VoiceCraftAttributes(
            product_name=data["product_name"],
            craft_type=data["craft_type"],
            materials=data["materials"],
            dimensions=data["dimensions"],
            production_time_days=data["production_time_days"],
            technique=data["technique"],
            color=data["color"]
        )

        marketing = MarketingDescription(
            hi=data["marketing_description"]["hi"],
            en=data["marketing_description"]["en"]
        )

        return VoiceCatalogResponse(
            transcript_original=data["transcript_original"],
            transcript_english=data["transcript_english"],
            attributes=attributes,
            marketing_description=marketing,
            seo_tags=data["seo_tags"],
            is_offline_mock=True,
            warning=warning
        )


offline_voice_engine = OfflineMockVoiceEngine()
