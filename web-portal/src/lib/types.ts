export interface CraftCluster {
  id: string;
  name: string;
  craft_type: string;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  gi_tag_number?: string;
  gi_certified: boolean;
  statutory_minimum_daily_wage: number;
  active_artisans_count: number;
  description: string;
}

export interface Product {
  id: string;
  artisan_id: string;
  cluster_id?: string;
  title_en: string;
  title_hi: string;
  craft_type: string;
  materials: string[];
  dimensions?: string;
  production_time_days?: number;
  technique?: string;
  color?: string;
  description_en: string;
  description_hi: string;
  seo_tags: string[];
  studio_image_url: string;
  raw_image_url?: string;
  floor_price: number;
  recommended_retail_d2c: number;
  wholesale_b2b: number;
  available_stock: number;
  is_published: boolean;
  created_at: string;
  artisan_name?: string;
  artisan_state?: string;
  gi_certified?: boolean;
}

export interface B2BRFQRequest {
  required_craft_type: string;
  quantity: number;
  budget_per_unit: number;
  delivery_days_deadline: number;
  delivery_state?: string;
  buyer_company_name?: string;
  buyer_contact_email?: string;
}

export interface B2BMatchRecordItem {
  artisan_id: string;
  artisan_name: string;
  cluster_name: string;
  state: string;
  overall_match_percentage: number;
  craft_compatibility_score: number;
  price_compatibility_score: number;
  capacity_feasibility_score: number;
  location_proximity_score: number;
  solo_capacity_feasible: boolean;
  cluster_consortium_feasible: boolean;
  artisan_monthly_capacity: number;
  artisan_wholesale_rate: number;
  match_rationale: string;
}

export interface B2BMatchResponse {
  rfq_id?: string;
  required_craft: string;
  quantity: number;
  buyer_budget: number;
  matched_artisans: B2BMatchRecordItem[];
  total_matches_found: number;
  cluster_consortium_recommended: boolean;
}

export interface ArtisanPayoutRecord {
  id: string;
  order_id: string;
  order_date: string;
  craft_title: string;
  buyer_name: string;
  order_type: "D2C Retail" | "B2B Bulk";
  quantity: number;
  gross_amount: number;
  artisan_net_payout: number;
  middleman_cut_prevented: number;
  payment_status: "Settled" | "Processing" | "Escrow Verified";
  payout_reference: string;
  disbursed_at: string;
}

export interface ArtisanEarnings {
  artisan_id: string;
  artisan_name: string;
  craft_tradition: string;
  cluster_name: string;
  state: string;
  total_revenue_earned: number;
  middleman_margin_saved: number;
  effective_daily_wage: number;
  statutory_minimum_wage: number;
  total_orders_completed: number;
  pending_orders_count: number;
  total_items_sold: number;
  recent_payouts: ArtisanPayoutRecord[];
  monthly_revenue_history: {
    month: string;
    artisan_net: number;
    conventional_trader_cut: number;
  }[];
}

export interface ArtisanStudioDraft {
  product_name: string;
  product_name_hi: string;
  craft_type: string;
  materials: string[];
  dimensions: string;
  production_time_days: number;
  technique: string;
  color: string;
  raw_material_cost: number;
  floor_price: number;
  recommended_retail_d2c: number;
  wholesale_b2b: number;
  description_en: string;
  description_hi: string;
  seo_tags: string[];
}
