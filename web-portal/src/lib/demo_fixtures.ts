/**
 * DEVELOPMENT AND TEST FIXTURES ONLY.
 * 
 * IMPORTANT:
 * These fixtures are strictly isolated for local development mockups, unit testing,
 * or offline demonstrator mode.
 * PRODUCTION RUNTIMES MUST NEVER IMPORT OR SERVE THESE AS REAL LIVE DATA.
 */

import { ArtisanEarnings } from './types';

export const SEED_ARTISAN_EARNINGS: ArtisanEarnings = {
  artisan_id: "demo-artisan-fixture",
  artisan_name: "Demo Artisan (Test Fixture)",
  craft_tradition: "Handicrafts",
  cluster_name: "Indian Craft Cluster",
  state: "India",
  total_revenue_earned: 0,
  middleman_margin_saved: 0,
  effective_daily_wage: 0,
  statutory_minimum_wage: 650,
  total_orders_completed: 0,
  pending_orders_count: 0,
  total_items_sold: 0,
  recent_payouts: [],
  monthly_revenue_history: []
};

export const STUDIO_PRESETS = [
  {
    id: "preset-silk",
    name: "Katan Silk Brocade Saree",
    craft_type: "Varanasi Silk",
    state: "Uttar Pradesh",
    voice_transcript_hi: "यह शुद्ध कतान सिल्क साड़ी है। इसे बनाने में 14 दिन का समय लगा और असली सोने के ज़री धागों का उपयोग किया गया है। कदवा तकनीक से हाथ से बुनी गई है।",
    voice_transcript_en: "This is a pure Katan silk saree. It took 14 days to craft using real gold zari threads, handwoven using traditional Kadwa jacquard technique.",
    audio_duration: "0:24",
    materials: ["Pure Katan Silk", "Gold Zari Thread"],
    production_days: 14,
    dimensions: "5.5m x 1.2m",
    technique: "Handloom Jacquard Kadwa Weaving",
    color: "Crimson Red with Antique Gold",
    material_cost: 3200,
    icon: "🥻"
  },
  {
    id: "preset-dhokra",
    name: "Tribal Bell Metal Nandi",
    craft_type: "Bastar Dhokra",
    state: "Chhattisgarh",
    voice_transcript_hi: "बस्तर के जंगल में 4000 साल पुरानी लॉस्ट-वैक्स पद्धति से यह नंदी बनाया है। पीतल और मधुमक्खी के मोम से पांच दिन में तैयार हुआ।",
    voice_transcript_en: "Crafted in the forests of Bastar using the 4000-year-old lost-wax method. Hand-modeled in brass and natural beeswax over five days.",
    audio_duration: "0:18",
    materials: ["Bell Metal", "Brass", "Natural Beeswax"],
    production_days: 5,
    dimensions: "18cm x 14cm x 8cm",
    technique: "Lost-Wax Bell Metal Casting",
    color: "Antique Brass Patina",
    material_cost: 580,
    icon: "🐂"
  },
  {
    id: "preset-toy",
    name: "Lacquer Wooden Stacking Tower",
    craft_type: "Channapatna Toys",
    state: "Karnataka",
    voice_transcript_hi: "यह बच्चों के लिए सुरक्षित चन्नापटना खिलौना है। हले की लकड़ी और प्राकृतिक सब्जियों के रंगों से दो दिन में खराद पर बना है।",
    voice_transcript_en: "Child-safe Channapatna toy turned on traditional wood lathes from Wrightia tinctoria wood and polished with natural vegetable lacquer.",
    audio_duration: "0:15",
    materials: ["Ivory Wood (Aale Mara)", "Natural Vegetable Dyes", "Shellac Polish"],
    production_days: 2,
    dimensions: "22cm Height x 12cm Base",
    technique: "Traditional Lathe Turning & Friction Lacquering",
    color: "Multi-color Amber, Scarlet & Forest Green",
    material_cost: 210,
    icon: "🪵"
  }
];
