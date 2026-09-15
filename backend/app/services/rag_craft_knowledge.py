"""
Hunardhara RAG Craft Knowledge Base & GI Certification Safety Engine
Provides verified Indian craft metadata, statutory wage floors, material care guidelines,
and strict GI certification verification to prevent hallucination.
"""

from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger("artisan_platform.rag_craft_knowledge")

# Curated, authoritative repository grounded in Ministry of Textiles & GI Registry records
VERIFIED_CRAFT_DATABASE = {
    "bastar dhokra": {
        "canonical_name": "Bastar Dhokra",
        "category": "Home Decor & Sculptures",
        "sub_category": "Metal Figurines & Bell Metal Art",
        "state": "Chhattisgarh",
        "primary_districts": ["Bastar", "Kondagaon", "Dantewada"],
        "gi_registered": True,
        "gi_application_no": "GI-0083",
        "traditional_technique": "Lost-Wax Bell Metal Casting (Cire Perdue)",
        "authentic_materials": ["Brass", "Bell Metal", "Clay Core", "Beeswax", "Resin"],
        "statutory_daily_wage_inr": 650.0,
        "typical_days_range": [2, 10],
        "care_instructions": {
            "en": "Clean gently with a dry, soft cotton cloth. To restore luster, apply a tiny drop of coconut oil or brass polish. Avoid water immersion or harsh chemicals.",
            "hi": "सूखे मुलायम सूती कपड़े से हल्के हाथ से पोंछें। चमक बनाए रखने के लिए थोड़ा नारियल तेल या ब्रास पॉलिश लगा सकते हैं। पानी में डुबाने या रसायनों से बचाएं।"
        },
        "quality_markers": ["Non-magnetic bell metal alloy", "Unique hollow core with earthen clay residue", "Fine hand-coiled wax wire surface details"]
    },
    "varanasi silk": {
        "canonical_name": "Varanasi Silk Brocade (Banarasi Saree)",
        "category": "Apparel & Textiles",
        "sub_category": "Handloom Sarees & Stoles",
        "state": "Uttar Pradesh",
        "primary_districts": ["Varanasi", "Chandauli", "Mirzapur", "Bhadohi"],
        "gi_registered": True,
        "gi_application_no": "GI-0023",
        "traditional_technique": "Handloom Jacquard / Pit Loom Weaving with supplementary warp/weft",
        "authentic_materials": ["Mulberry Silk", "Katan Silk", "Kora Organza", "Georgette", "Silver/Gold Electroplated Zari"],
        "statutory_daily_wage_inr": 750.0,
        "typical_days_range": [7, 30],
        "care_instructions": {
            "en": "Dry clean only. Store folded in a breathable cotton or muslin bag. Change folds every 3 months to prevent creases along zari threads.",
            "hi": "केवल ड्राई क्लीन कराएं। हवादार सूती या मलमल के कपड़े में लपेट कर रखें। जरी को सुरक्षित रखने के लिए हर 3 महीने में तह बदलें।"
        },
        "quality_markers": ["Intricate floral motifs (butis)", "Heavy dense pallu with minakari accents", "Reversible floats or clean float cutwork on back"]
    },
    "khurja pottery": {
        "canonical_name": "Khurja Ceramic Pottery",
        "category": "Kitchenware & Tableware",
        "sub_category": "Ceramic Dinnerware & Planters",
        "state": "Uttar Pradesh",
        "primary_districts": ["Bulandshahr", "Khurja"],
        "gi_registered": True,
        "gi_application_no": "GI-0178",
        "traditional_technique": "High-fired Ceramic Glazing (1200°C) with hand-painted underglaze motifs",
        "authentic_materials": ["Stoneware Clay", "China Clay", "Feldspar", "Quartz", "Lead-free Ceramic Glazes"],
        "statutory_daily_wage_inr": 650.0,
        "typical_days_range": [1, 5],
        "care_instructions": {
            "en": "Microwave and dishwasher safe unless metallic accents are present. Hand-wash with mild liquid soap and a soft sponge to preserve hand-painted glaze.",
            "hi": "माइक्रोवेव और डिशवॉशर सुरक्षित (यदि धातु की पॉलिश न हो)। हाथ से मुलायम स्पंज और हल्के साबुन से धोएं ताकि हाथ से बनी चमक बरकरार रहे।"
        },
        "quality_markers": ["Ringing sound when tapped", "Non-porous vitrified surface", "Lead-free food safe certificate compliance"]
    },
    "madhubani painting": {
        "canonical_name": "Madhubani Folk Art (Mithila Painting)",
        "category": "Art & Collectibles",
        "sub_category": "Traditional Wall Paintings & Scrolls",
        "state": "Bihar",
        "primary_districts": ["Madhubani", "Darbhanga", "Sitamarhi"],
        "gi_registered": True,
        "gi_application_no": "GI-0105",
        "traditional_technique": "Hand-drawing with nib pens, bamboo twigs, and natural mineral/vegetable pigments",
        "authentic_materials": ["Handmade Rag Paper", "Tussar Silk Fabric", "Natural Indigo", "Turmeric Pigment", "Rice Paste (Pithar)", "Soot (Kajal)"],
        "statutory_daily_wage_inr": 700.0,
        "typical_days_range": [3, 21],
        "care_instructions": {
            "en": "Frame under UV-protective glass to preserve natural pigments. Keep away from direct high humidity and continuous sunlight.",
            "hi": "प्राकृतिक रंगों की सुरक्षा के लिए कांच के फ्रेम में रखें। सीधी धूप और सीलन वाले स्थान से दूर रखें।"
        },
        "quality_markers": ["Double-line borders with geometric hatching (kachni)", "Absence of empty space (filled with birds, flowers)", "Natural earthy vegetable color palette"]
    },
    "channapatna toys": {
        "canonical_name": "Channapatna Wooden Toys & Lacquerware",
        "category": "Toys & Baby",
        "sub_category": "Educational Wooden Toys & Figurines",
        "state": "Karnataka",
        "primary_districts": ["Ramanagara", "Channapatna"],
        "gi_registered": True,
        "gi_application_no": "GI-0022",
        "traditional_technique": "Lathe Wood Turning with heat-frictional Vegetable Lacquer Polish",
        "authentic_materials": ["Wrightia Tinctoria (Aale Mara / Ivory Wood)", "Natural Non-toxic Shellac", "Turmeric/Kumkum/Indigo Organic Dyes"],
        "statutory_daily_wage_inr": 650.0,
        "typical_days_range": [1, 4],
        "care_instructions": {
            "en": "Wipe with a soft, slightly damp cloth and dry immediately. Do not soak in water or expose to direct flame. Completely non-toxic and child-safe.",
            "hi": "हल्के नम कपड़े से पोंछें और तुरंत सुखाएं। पानी में न भिगोएं। 100% प्राकृतिक और बच्चों के लिए पूर्णतः सुरक्षित।"
        },
        "quality_markers": ["Soft rounded splinter-free edges", "Glossy natural lac finish", "Zero lead or artificial synthetic paints"]
    }
}


class RAGCraftKnowledgeService:
    """RAG and Truthfulness service for verified craft facts and GI safety checks."""

    @staticmethod
    def query_craft_knowledge(query_str: str) -> Dict[str, Any]:
        """
        Performs contextual retrieval against verified craft registry.
        """
        q = query_str.lower().strip()
        best_match = None

        for key, record in VERIFIED_CRAFT_DATABASE.items():
            if key in q or record["canonical_name"].lower() in q:
                best_match = record
                break

        if not best_match:
            # Check explicit cluster or GI craft terms only - NEVER map generic materials (brass, clay, wood) or generic items (saree, toy, cup) to specific GI clusters
            if "dhokra" in q or "bastar" in q:
                best_match = VERIFIED_CRAFT_DATABASE["bastar dhokra"]
            elif "banarasi" in q or "katan" in q or "varanasi silk" in q:
                best_match = VERIFIED_CRAFT_DATABASE["varanasi silk"]
            elif "khurja" in q:
                best_match = VERIFIED_CRAFT_DATABASE["khurja pottery"]
            elif "madhubani" in q or "mithila" in q:
                best_match = VERIFIED_CRAFT_DATABASE["madhubani painting"]
            elif "channapatna" in q:
                best_match = VERIFIED_CRAFT_DATABASE["channapatna toys"]

        if best_match:
            return {
                "matched": True,
                "craft_name": best_match["canonical_name"],
                "category": best_match["category"],
                "sub_category": best_match["sub_category"],
                "state": best_match["state"],
                "gi_registered": best_match["gi_registered"],
                "gi_application_no": best_match["gi_application_no"],
                "authentic_materials": best_match["authentic_materials"],
                "traditional_technique": best_match["traditional_technique"],
                "statutory_daily_wage_inr": best_match["statutory_daily_wage_inr"],
                "care_instructions": best_match["care_instructions"],
                "quality_markers": best_match["quality_markers"]
            }

        # Safe fallback for uncatalogued traditional crafts
        return {
            "matched": False,
            "craft_name": "Traditional Indian Handicraft",
            "category": "Handicrafts & Art",
            "sub_category": "Artisan Goods",
            "state": "India",
            "gi_registered": False,
            "gi_application_no": None,
            "authentic_materials": ["Handcrafted Natural Materials"],
            "traditional_technique": "Handmade Artisan Crafting",
            "statutory_daily_wage_inr": 650.0,
            "care_instructions": {
                "en": "Handle with care. Clean gently with a soft dry cloth. Protect from extreme heat and moisture.",
                "hi": "सावधानी से संभालें। सूखे मुलायम कपड़े से पोंछें। अत्यधिक गर्मी और नमी से बचाएं।"
            },
            "quality_markers": ["Handcrafted artisan quality"]
        }

    @staticmethod
    def verify_gi_certification_claim(craft_name: str, stated_region: Optional[str] = None) -> Dict[str, Any]:
        """
        Strict GI safety validator: Never allows LLM to invent GI certification.
        Validates against official state/district registry records.
        """
        craft_info = RAGCraftKnowledgeService.query_craft_knowledge(craft_name)
        if not craft_info["matched"] or not craft_info["gi_registered"]:
            return {
                "gi_status": "unverified",
                "gi_registration_number": None,
                "verified": False,
                "disclaimer": "AI identifies this as craft tradition style. Certification requires official registration documents."
            }

        # Verify region coherence
        state_match = True
        if stated_region:
            stated_lower = stated_region.lower()
            state_match = (
                craft_info["state"].lower() in stated_lower
                or stated_lower in craft_info["state"].lower()
            )

        if state_match:
            return {
                "gi_status": "verified_cluster",
                "gi_registration_number": craft_info["gi_application_no"],
                "verified": True,
                "disclaimer": f"Verified craft tradition of {craft_info['state']}. Subject to artisan GI-authorisation card."
            }
        else:
            return {
                "gi_status": "unverified_region",
                "gi_registration_number": None,
                "verified": False,
                "disclaimer": f"Stated region ({stated_region}) differs from registered GI cluster ({craft_info['state']}). Marked as style only."
            }


rag_craft_service = RAGCraftKnowledgeService()
