"""
Hunardhara Catalog Prompt Library & Style Engine
Enforces warm, respectful, truthful copywriting without marketing hyperbole or patronizing tropes.
"""

import re
from typing import List, Tuple, Dict, Any

# Prohibited exaggerated marketing terms
BANNED_HYPERBOLE = [
    "timeless masterpiece",
    "exquisite luxury",
    "world-renowned",
    "magical heritage",
    "unparalleled craftsmanship",
    "breathtaking luxury",
    "one-of-a-kind royal",
    "royal splendor",
    "priceless artifact",
    "peerless beauty",
]

# Prohibited patronizing or pity-inducing phrases
BANNED_PATRONIZING = [
    "poor artisan",
    "helpless artisan",
    "underprivileged seller",
    "struggling maker",
    "pitiful weaver",
    "poverty-stricken",
    "sympathy purchase",
    "charity product",
]


def lint_artisan_text(text: str) -> Tuple[bool, List[str]]:
    """
    Checks if generated copy complies with Hunardhara's dignity and truthfulness standards.
    Returns: (is_compliant, list_of_violations)
    """
    violations = []
    text_lower = text.lower()

    for phrase in BANNED_HYPERBOLE:
        if phrase in text_lower:
            violations.append(f"Hyperbole violation: '{phrase}' (use simple, authentic descriptions)")

    for phrase in BANNED_PATRONIZING:
        if phrase in text_lower:
            violations.append(f"Dignity violation: '{phrase}' (artisans must be presented as skilled professionals)")

    # Flag unverified GI claims
    if "definitely gi certified" in text_lower or "100% pure certified" in text_lower:
        violations.append("Certification violation: claim of certification requires verified database lookup")

    return (len(violations) == 0, violations)


class CatalogPromptLibrary:
    """Prompt templates and few-shot exemplars for Hunardhara Artisan Commerce Assistant."""

    SYSTEM_PROMPT_CATALOG = """You are the specialized 'Hunardhara Artisan Commerce Assistant' for the Ministry of Social Justice and Empowerment (MoSJE).
Your mission is to help rural Indian artisans, weavers, and craftspeople turn unedited photos and regional voice descriptions into truthful, dignified, market-ready digital product listings.

CRITICAL WRITING PRINCIPLES:
1. WARM, RESPECTFUL & HUMAN: Speak with cultural warmth and pride in Indian craft traditions.
2. DIGNIFIED & PROFESSIONAL: Present the artisan as an accomplished craftsperson. NEVER use patronizing language like 'poor artisan' or 'helpless weaver'.
3. TRUTHFUL & ACCURATE: NEVER invent missing details. If material, certification, or origin is unstated or uncertain, mark it as 'Unknown' or 'Verification Required'.
4. ZERO MARKETING HYPERBOLE: BANNED terms: 'timeless masterpiece', 'exquisite luxury', 'world-renowned', 'magical heritage', 'unparalleled craftsmanship'. Use simple, clear, commercial language instead.
5. INDIAN LANGUAGE MASTERY: Produce fluent, culturally authentic Devanagari Hindi alongside high-converting English.

OUTPUT FORMAT:
Return a valid, well-formed JSON object adhering strictly to the requested schema. Do not enclose in markdown code blocks unless requested.
"""

    SYSTEM_PROMPT_VISION = """You are the Computer Vision Expert for the Hunardhara Artisan Platform.
Your task is to visually inspect handicraft photos and extract observable craft traits without guessing facts that cannot be seen.

RULES:
1. Identify product category, shape, primary/secondary colors, surface patterns, and visible textures.
2. If the item looks like a traditional craft (e.g. Banarasi, Dhokra, Khurja, Madhubani, Channapatna), state it as 'visual style characteristic' (e.g., 'Banarasi-style motifs').
3. NEVER assert official GI certification or guaranteed fabric purity from a photo alone.
4. Assess visual quality, lighting, and background framing. Note any visible flaws or defects truthfully.
"""

    FEW_SHOT_EXEMPLARS = [
        {
            "artisan_input": "यह बस्तर का पारंपरिक ढोकरा पीतल का घोड़ा है जो चार दिन में लॉस्ट वैक्स तकनीक से बना है।",
            "extracted_attributes": {
                "product_name": "Bastar Dhokra Brass Horse",
                "category": "Home Decor & Sculptures",
                "sub_category": "Metal Figurines",
                "craft_type": "Bastar Dhokra",
                "material": ["Brass", "Bell Metal", "Clay core"],
                "primary_color": "Antique Brass Bronze",
                "secondary_colors": ["Golden sheen"],
                "production_time_days": 4.0,
                "region": "Bastar, Chhattisgarh",
                "language": "hi"
            },
            "listing_title_en": "Handcrafted Bastar Dhokra Brass Horse Figurine",
            "listing_title_hi": "हस्तनिर्मित बस्तर ढोकरा पीतल का घोड़ा (नक्काशीदार मूर्ति)",
            "short_description_en": "Traditional hollow-cast brass horse figurine crafted by tribal artisans in Bastar using the 4,000-year-old lost-wax casting technique. Features detailed tribal wirework embellishments.",
            "short_description_hi": "बस्तर के जनजातीय कारीगरों द्वारा 4,000 वर्ष पुरानी प्राचीन लॉस्ट-वैक्स (मोम ढलाई) तकनीक से निर्मित पारंपरिक पीतल का घोड़ा। महीन तार-वर्क और पारंपरिक नक्काशी से सुसज्जित।"
        },
        {
            "artisan_input": "Ye Banarasi katan silk saree hai, yellow colour ka hai. Silk hai aur mujhe banane mein 14 din lage.",
            "extracted_attributes": {
                "product_name": "Yellow Banarasi Katan Saree",
                "category": "Apparel & Textiles",
                "sub_category": "Sarees",
                "craft_type": "Varanasi Handloom Silk Weaving",
                "material": ["Katan Silk", "Zari"],
                "primary_color": "Mustard Yellow",
                "secondary_colors": ["Antique Gold Zari"],
                "production_time_days": 14.0,
                "region": "Varanasi, Uttar Pradesh",
                "language": "hi"
            },
            "listing_title_en": "Handloom Mustard Yellow Banarasi Katan Silk Saree",
            "listing_title_hi": "हथकरघा निर्मित पीली बनारसी कतान सिल्क साड़ी",
            "short_description_en": "Handwoven over 14 days by master weavers in Varanasi, this mustard yellow katan silk saree showcases traditional zari floral motifs along the border and pallu.",
            "short_description_hi": "वाराणसी के कुशल बुनकरों द्वारा 14 दिनों के परिश्रम से हथकरघे पर बुनी गई कतान सिल्क साड़ी। पारंपरिक जरी के फूलों की बूटियों और आकर्षक पल्लू से सजी हुई।"
        }
    ]

    @classmethod
    def get_catalog_prompt(cls, raw_transcript: str, visual_findings: Dict[str, Any], grounded_rag: Dict[str, Any]) -> str:
        """Constructs the prompt for the catalog generator model."""
        return f"""Task: Generate a verified, dignified digital product catalog listing from the following inputs.

ARTISAN RAW SPOKEN INPUT:
"{raw_transcript}"

COMPUTER VISION INSPECTION FINDINGS:
{visual_findings}

VERIFIED RAG KNOWLEDGE BASE GROUNDING:
{grounded_rag}

Enforce the Hunardhara style guidelines: warm, truthful, no exaggerated marketing hyperbole, no patronizing words. Return strict JSON.
"""


prompt_library = CatalogPromptLibrary()
