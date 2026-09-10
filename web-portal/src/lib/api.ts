import { CraftCluster, Product, B2BRFQRequest, B2BMatchResponse, ArtisanEarnings, ArtisanStudioDraft } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Fallback seed products for zero-downtime offline presentation
export const SEED_PRODUCTS: Product[] = [
  {
    id: "prod-001",
    artisan_id: "art-varanasi-01",
    cluster_id: "cluster-varanasi-silk",
    title_en: "Varanasi Pure Katan Silk Brocade Saree",
    title_hi: "वाराणसी शुद्ध कतान सिल्क बनारसी ब्रोकेड साड़ी",
    craft_type: "Varanasi Silk",
    materials: ["Pure Katan Silk", "Gold Zari Thread"],
    dimensions: "5.5m x 1.2m",
    production_time_days: 14,
    technique: "Handloom Jacquard Kadwa Weaving",
    color: "Crimson Red with Antique Gold",
    description_en: "Handwoven by Master Weaver Radheshyam Ansari in the sacred looms of Varanasi. Features intricate Kadwa bootis and pure gold zari motifs.",
    description_hi: "वाराणसी के बुनकर राधेश्याम अंसारी द्वारा हथकरघे पर बुनी गई पारंपरिक कतान सिल्क साड़ी।",
    seo_tags: ["Varanasi Silk", "Banarasi Saree", "GI Craft", "Handloom", "Wedding"],
    studio_image_url: "/static/studio/varanasi_silk.jpg",
    floor_price: 6500,
    recommended_retail_d2c: 12500,
    wholesale_b2b: 8500,
    available_stock: 6,
    is_published: true,
    created_at: "2026-09-08T10:00:00Z",
    artisan_name: "Radheshyam Ansari",
    artisan_state: "Uttar Pradesh",
    gi_certified: true
  },
  {
    id: "prod-002",
    artisan_id: "art-bastar-01",
    cluster_id: "cluster-bastar-dhokra",
    title_en: "Bastar Dhokra Tribal Bell Metal Nandi Figurine",
    title_hi: "बस्तर ढोकरा जनजातीय बेल मेटल नंदी प्रतिमा",
    craft_type: "Bastar Dhokra",
    materials: ["Bell Metal", "Brass", "Natural Beeswax"],
    dimensions: "18cm x 14cm x 8cm",
    production_time_days: 5,
    technique: "4000-Year-Old Lost-Wax Bell Metal Casting",
    color: "Antique Brass Patina",
    description_en: "Authentic non-ferrous tribal casting hand-modeled in the forested heart of Bastar, Chhattisgarh by master artisan Sukhdev Baghel.",
    description_hi: "बस्तर के शिल्पकार सुखदेव बघेल द्वारा 4000 वर्ष पुरानी लॉस्ट-वैक्स तकनीक से निर्मित पारंपरिक नंदी।",
    seo_tags: ["Bastar Dhokra", "Tribal Art", "Bell Metal", "GI Tagged", "MoSJE Certified"],
    studio_image_url: "/static/studio/bastar_dhokra.jpg",
    floor_price: 1674,
    recommended_retail_d2c: 2950,
    wholesale_b2b: 2150,
    available_stock: 12,
    is_published: true,
    created_at: "2026-09-08T11:00:00Z",
    artisan_name: "Sukhdev Baghel",
    artisan_state: "Chhattisgarh",
    gi_certified: true
  },
  {
    id: "prod-003",
    artisan_id: "art-khurja-01",
    cluster_id: "cluster-khurja-pottery",
    title_en: "Khurja Hand-Glazed Ceramic Water Dispenser with Stand",
    title_hi: "खुर्जा हस्तनिर्मित ग्लेज्ड सिरेमिक वाटर पॉट",
    craft_type: "Khurja Pottery",
    materials: ["Terracotta Clay", "Lead-Free Cobalt Glaze", "Feldspar"],
    dimensions: "32cm x 22cm x 22cm",
    production_time_days: 3,
    technique: "Wheel Throwing & 1200°C High-Fire Kiln Vitrification",
    color: "Cobalt Blue & Floral Ivory",
    description_en: "Artisanal food-safe ceramic vessel crafted by master potter Mohammad Aslam in Khurja's historic ceramic district.",
    description_hi: "खुर्जा के कुम्हार मोहम्मद असलम द्वारा चाक पर निर्मित और 1200 डिग्री पर पकाया गया सिरेमिक बर्तन।",
    seo_tags: ["Khurja Pottery", "Ceramic Art", "Handmade Glaze", "GI Certified"],
    studio_image_url: "/static/studio/khurja_pottery.jpg",
    floor_price: 850,
    recommended_retail_d2c: 1850,
    wholesale_b2b: 1200,
    available_stock: 25,
    is_published: true,
    created_at: "2026-09-09T09:00:00Z",
    artisan_name: "Mohammad Aslam",
    artisan_state: "Uttar Pradesh",
    gi_certified: true
  },
  {
    id: "prod-004",
    artisan_id: "art-madhubani-01",
    cluster_id: "cluster-madhubani-painting",
    title_en: "Madhubani Tree of Life Hand-Painted Tussar Silk Scroll",
    title_hi: "मधुबनी जीवन वृक्ष हस्तचित्रित तुषार सिल्क स्क्रॉल",
    craft_type: "Madhubani Painting",
    materials: ["Handspun Tussar Silk", "Organic Plant & Mineral Dyes", "Bamboo Twig Nib"],
    dimensions: "90cm x 60cm",
    production_time_days: 8,
    technique: "Mithila Kachni & Bharni Line Work with Bamboo Nib",
    color: "Natural Ochre, Indigo & Forest Green",
    description_en: "Painted by award-winning artisan Devi Bai in Madhubani, Bihar depicting the eternal cycle of nature using natural indigo, turmeric, and soot dyes.",
    description_hi: "बिहार के मधुबनी की लोक कलाकार देवी बाई द्वारा प्राकृतिक रंगों और बांस की कलम से चित्रित 'ट्री ऑफ लाइफ'।",
    seo_tags: ["Madhubani Art", "Mithila Painting", "Tussar Silk", "GI Bihar", "Folk Art"],
    studio_image_url: "/static/studio/madhubani_art.jpg",
    floor_price: 2200,
    recommended_retail_d2c: 4800,
    wholesale_b2b: 3100,
    available_stock: 8,
    is_published: true,
    created_at: "2026-09-09T14:30:00Z",
    artisan_name: "Devi Bai",
    artisan_state: "Bihar",
    gi_certified: true
  },
  {
    id: "prod-005",
    artisan_id: "art-channapatna-01",
    cluster_id: "cluster-channapatna-toys",
    title_en: "Channapatna Eco-Friendly Lacquer Wooden Stacking Tower",
    title_hi: "चन्नापटना पर्यावरण-अनुकूल लाख पॉलिश लकड़ी का खिलौना",
    craft_type: "Channapatna Wooden Toys",
    materials: ["Hale Wood (Wrightia Tinctoria)", "Natural Non-Toxic Vegetable Lac"],
    dimensions: "24cm x 10cm x 10cm",
    production_time_days: 2,
    technique: "Hand Lathe Turning & Friction Lacquering",
    color: "Vibrant Turmeric Yellow, Vermilion & Leaf Green",
    description_en: "100% child-safe Montessori wooden toy turned on traditional power lathes and polished with natural vegetable dyes by artisan B. Venkatesh.",
    description_hi: "कर्नाटक के चन्नापटना में सुरक्षित आले की लकड़ी और प्राकृतिक लाख से बना हस्तनिर्मित खिलौना।",
    seo_tags: ["Channapatna Toys", "Wooden Toy", "Non-Toxic", "GI Karnataka", "Montessori"],
    studio_image_url: "/static/studio/channapatna_toy.jpg",
    floor_price: 450,
    recommended_retail_d2c: 1100,
    wholesale_b2b: 680,
    available_stock: 40,
    is_published: true,
    created_at: "2026-09-10T08:00:00Z",
    artisan_name: "B. Venkatesh",
    artisan_state: "Karnataka",
    gi_certified: true
  }
];

export async function fetchProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_BASE}/products`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {
    // Graceful fallback to rich seed catalog if server is not booted
  }
  return SEED_PRODUCTS;
}

export async function fetchProductById(id: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_BASE}/products/${id}`);
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return SEED_PRODUCTS.find((p) => p.id === id) || null;
}

export async function fetchClusters(): Promise<CraftCluster[]> {
  try {
    const res = await fetch(`${API_BASE}/clusters`);
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return [
    {
      id: "varanasi",
      name: "Varanasi Silk Cluster",
      craft_type: "Varanasi Silk",
      state: "Uttar Pradesh",
      district: "Varanasi",
      latitude: 25.3176,
      longitude: 82.9739,
      gi_certified: true,
      statutory_minimum_daily_wage: 650,
      active_artisans_count: 4200,
      description: "Centuries-old jacquard handloom brocade weaving cluster."
    },
    {
      id: "bastar",
      name: "Bastar Dhokra Cluster",
      craft_type: "Bastar Dhokra",
      state: "Chhattisgarh",
      district: "Bastar",
      latitude: 19.0744,
      longitude: 82.0073,
      gi_certified: true,
      statutory_minimum_daily_wage: 520,
      active_artisans_count: 1850,
      description: "Ancient lost-wax bell metal casting cluster."
    },
    {
      id: "khurja",
      name: "Khurja Pottery Cluster",
      craft_type: "Khurja Pottery",
      state: "Uttar Pradesh",
      district: "Bulandshahr",
      latitude: 28.2561,
      longitude: 77.8549,
      gi_certified: true,
      statutory_minimum_daily_wage: 480,
      active_artisans_count: 3100,
      description: "Historic ceramic and high-fire glazed pottery cluster."
    },
    {
      id: "madhubani",
      name: "Madhubani Painting Cluster",
      craft_type: "Madhubani Painting",
      state: "Bihar",
      district: "Madhubani",
      latitude: 26.3542,
      longitude: 86.0718,
      gi_certified: true,
      statutory_minimum_daily_wage: 450,
      active_artisans_count: 5600,
      description: "Mithila folk art cluster preserving sacred geometric motifs."
    },
    {
      id: "channapatna",
      name: "Channapatna Wooden Toys Cluster",
      craft_type: "Channapatna Wooden Toys",
      state: "Karnataka",
      district: "Ramanagara",
      latitude: 12.6518,
      longitude: 77.2089,
      gi_certified: true,
      statutory_minimum_daily_wage: 540,
      active_artisans_count: 2400,
      description: "Eco-friendly vegetable lacquered wooden toy cluster."
    }
  ];
}

export async function matchB2BRFQ(rfq: B2BRFQRequest): Promise<B2BMatchResponse> {
  try {
    const res = await fetch(`${API_BASE}/b2b/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rfq)
    });
    if (res.ok) return await res.json();
  } catch {
    // Offline heuristic fallback for live pitch demonstration
  }
  
  // Return simulated high-fidelity match for demo
  const isBastar = rfq.required_craft_type.toLowerCase().includes("dhokra") || rfq.required_craft_type.toLowerCase().includes("brass");
  return {
    required_craft: rfq.required_craft_type,
    quantity: rfq.quantity,
    buyer_budget: rfq.budget_per_unit,
    total_matches_found: 3,
    cluster_consortium_recommended: rfq.quantity > 50,
    matched_artisans: [
      {
        artisan_id: isBastar ? "art-bastar-01" : "art-varanasi-01",
        artisan_name: isBastar ? "Sukhdev Baghel" : "Radheshyam Ansari",
        cluster_name: isBastar ? "Bastar Dhokra Cluster" : "Varanasi Silk Cluster",
        state: isBastar ? "Chhattisgarh" : "Uttar Pradesh",
        overall_match_percentage: 86.5,
        craft_compatibility_score: 95.0,
        price_compatibility_score: 88.0,
        capacity_feasibility_score: rfq.quantity <= 30 ? 90.0 : 65.0,
        location_proximity_score: 80.0,
        solo_capacity_feasible: rfq.quantity <= 30,
        cluster_consortium_feasible: true,
        artisan_monthly_capacity: isBastar ? 30 : 20,
        artisan_wholesale_rate: isBastar ? 2150 : 8500,
        match_rationale: `Verified Master Artisan in ${isBastar ? "Bastar" : "Varanasi"}. Wholesale rate is within your target budget. ${rfq.quantity > 30 ? "Can fulfill this order via MoSJE Self-Help Group (SHG) cluster consortium pooling 4 artisans." : "Single workshop has sufficient inventory capacity to fulfill within your deadline."}`
      }
    ]
  };
}

export const SEED_ARTISAN_EARNINGS: ArtisanEarnings = {
  artisan_id: "art-varanasi-01",
  artisan_name: "Radheshyam Ansari",
  craft_tradition: "Varanasi Pure Katan Silk & Brocade",
  cluster_name: "Varanasi Silk Cluster",
  state: "Uttar Pradesh",
  total_revenue_earned: 248500,
  middleman_margin_saved: 164200,
  effective_daily_wage: 1180,
  statutory_minimum_wage: 650,
  total_orders_completed: 48,
  pending_orders_count: 3,
  total_items_sold: 64,
  recent_payouts: [
    {
      id: "pay-101",
      order_id: "ORD-2026-9041",
      order_date: "2026-09-09",
      craft_title: "Varanasi Pure Katan Silk Brocade Saree",
      buyer_name: "Aarav Mehra (Direct Retail)",
      order_type: "D2C Retail",
      quantity: 1,
      gross_amount: 12500,
      artisan_net_payout: 11875,
      middleman_cut_prevented: 7500,
      payment_status: "Settled",
      payout_reference: "UPI/DBT-992014-VNS",
      disbursed_at: "2026-09-09 16:45 IST"
    },
    {
      id: "pay-102",
      order_id: "ORD-2026-8832",
      order_date: "2026-09-06",
      craft_title: "Kadwa Zari Dupatta Set (Custom Batch)",
      buyer_name: "Taj Heritage Hotels & Resorts",
      order_type: "B2B Bulk",
      quantity: 8,
      gross_amount: 68000,
      artisan_net_payout: 65280,
      middleman_cut_prevented: 40800,
      payment_status: "Settled",
      payout_reference: "NEFT/SBIN00291-MOSJE",
      disbursed_at: "2026-09-07 11:20 IST"
    },
    {
      id: "pay-103",
      order_id: "ORD-2026-8719",
      order_date: "2026-09-03",
      craft_title: "Traditional Floral Kadwa Brocade Fabric",
      buyer_name: "Sanskriti Couture (Delhi)",
      order_type: "B2B Bulk",
      quantity: 4,
      gross_amount: 34000,
      artisan_net_payout: 32640,
      middleman_cut_prevented: 20400,
      payment_status: "Settled",
      payout_reference: "RTGS/HDFC9912048-DIR",
      disbursed_at: "2026-09-04 14:15 IST"
    },
    {
      id: "pay-104",
      order_id: "ORD-2026-9099",
      order_date: "2026-09-10",
      craft_title: "Bridal Banarasi Silk Saree",
      buyer_name: "Priyanka Deshmukh",
      order_type: "D2C Retail",
      quantity: 1,
      gross_amount: 14500,
      artisan_net_payout: 13775,
      middleman_cut_prevented: 8700,
      payment_status: "Escrow Verified",
      payout_reference: "ESCROW-HOLD-MOSJE",
      disbursed_at: "Estimated Dispatch 2026-09-12"
    }
  ],
  monthly_revenue_history: [
    { month: "May", artisan_net: 34000, conventional_trader_cut: 12000 },
    { month: "Jun", artisan_net: 42500, conventional_trader_cut: 15500 },
    { month: "Jul", artisan_net: 51200, conventional_trader_cut: 18000 },
    { month: "Aug", artisan_net: 58800, conventional_trader_cut: 21000 },
    { month: "Sep (MTD)", artisan_net: 62000, conventional_trader_cut: 23500 }
  ]
};

export async function fetchArtisanEarnings(): Promise<ArtisanEarnings> {
  return SEED_ARTISAN_EARNINGS;
}

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

