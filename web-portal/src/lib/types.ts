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
  created_at?: string;
  artisan_name?: string;
  artisan_state?: string;

  // Authoritative Geographical Indication (GI) Separation
  gi_craft_registered?: boolean;
  gi_registration_name?: string;
  gi_registration_reference?: string;
  gi_registered_region?: string;
  gi_artisan_authorization_status?: 'UNVERIFIED' | 'PENDING_REVIEW' | 'AUTHORIZED' | 'NOT_PROVIDED' | 'REJECTED';
  gi_authorization_document_reference?: string;
  gi_product_provenance_status?: 'UNVERIFIED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'FAILED';
  gi_verification_source?: string;
  gi_verification_date?: string;
  is_gi_certified_product?: boolean;

  // Deprecated legacy field: do not rely on for official certification
  gi_certified?: boolean;
  is_alias?: boolean;
}

export interface B2BRFQRequest {
  required_craft_type: string;
  quantity: number;
  budget_per_unit: number;
  delivery_days_deadline: number;
  delivery_state?: string;
  buyer_company_name?: string;
  buyer_contact_email?: string;
  idempotency_key?: string;
}

export interface B2BMatchRecordItem {
  artisan_id: string;
  artisan_name: string;
  cluster_name: string;
  state: string;
  product_id?: string;
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
  consortium_option?: {
    consortium_recommended: boolean;
    cluster_name: string;
    participating_artisans: string[];
    artisan_count: number;
    combined_monthly_capacity: number;
    deliverable_in_deadline: number;
    consortium_feasible: boolean;
    explanation: string;
  };
}

export interface B2BMatchApiResult {
  success: boolean;
  data?: B2BMatchResponse;
  error?: string;
  statusCode?: number;
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

export interface ArtisanInquiry {
  id: string;
  product_id: string;
  product_title: string;
  product_image?: string;
  artisan_id: string;
  artisan_name?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email: string;
  inquiry_type: 'customization' | 'bulk_order' | 'delivery_time' | 'price' | 'general';
  message: string;
  quantity?: number;
  status: 'new' | 'replied' | 'in_progress' | 'closed';
  created_at: string;
}

export interface CartStorageItem {
  id: string;
  quantity: number;
}

export interface EnrichedCartItem {
  id: string;
  title: string;
  craft: string;
  artisan: string;
  price: number;
  statutoryWage: number;
  quantity: number;
  image: string;
  stock: number;
  isActive: boolean;
}

export interface CustomerOrder {
  id: string;
  order_number: string;
  customer_id: string;
  artisan_id: string;
  product_id: string;
  product_title: string;
  quantity: number;
  total_price: number;
  status: 'pending' | 'paid' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  payment_id?: string | null;
  payment_provider?: string | null;
  paid_at?: string | null;
  created_at: string;
  product_image_url?: string | null;
  craft_type?: string | null;
  artisan_name?: string | null;
  cluster_name?: string | null;
  statutory_wage?: number | null;
}

export interface CartCheckoutResult {
  success: boolean;
  status: number;
  orders?: CustomerOrder[];
  totalAmount?: number;
  totalItems?: number;
  error?: string;
}

export interface PlatformSettings {
  marketplace_enabled: boolean;
  artisan_onboarding_enabled: boolean;
  product_publishing_enabled: boolean;
  b2b_enabled: boolean;
  orders_enabled: boolean;
  ai_catalog_enabled: boolean;
  voice_catalog_enabled: boolean;
  maintenance_mode: boolean;
  maintenance_message: string;
}

export interface PlatformOverviewMetrics {
  active_users: number;
  active_artisans: number;
  total_artisans: number;
  pending_applications: number;
  active_products: number;
  total_products: number;
  total_orders: number;
  total_revenue: number;
  open_rfqs: number;
  suspended_accounts: number;
  system_health: 'operational' | 'maintenance';
  switches: PlatformSettings;
  security_warnings: string[];
}

export interface AdminArtisanItem {
  id: string;
  full_name: string;
  phone_number: string;
  state: string;
  district: string;
  primary_craft: string;
  cluster_id?: string;
  cluster_name?: string;
  is_active: boolean;
  products_count: number;
  gi_verified: boolean;
  created_at?: string;
}

export interface AdminProductItem {
  id: string;
  title: string;
  artisan_id: string;
  artisan_name?: string;
  craft_type: string;
  listing_price: number;
  floor_price: number;
  stock_quantity: number;
  is_active: boolean;
  studio_image_url?: string;
  created_at?: string;
}

export interface AdminClusterItem {
  id: string;
  name: string;
  craft_name: string;
  state: string;
  district: string;
  statutory_daily_wage: number;
  statutory_hourly_wage: number;
  gi_tag_status?: string;
  gi_tag_number?: string;
  artisans_count?: number;
  updated_at?: string;
}

export interface AdminOrderItem {
  id: string;
  order_number: string;
  customer_id: string;
  artisan_id: string;
  product_id: string;
  product_title: string;
  quantity: number;
  total_price: number;
  status: string;
  payment_status: string;
  created_at?: string;
}

export interface AdminB2BRFQItem {
  id: string;
  buyer_name: string;
  buyer_organization?: string;
  buyer_email: string;
  craft_type: string;
  required_quantity: number;
  unit_budget: number;
  total_budget: number;
  deadline_days: number;
  delivery_state?: string;
  status: string;
  matches_count: number;
  created_at?: string;
}

export interface AdminPlatformUserItem {
  id: string;
  email?: string;
  role: string;
  is_suspended: boolean;
  created_at?: string;
  last_sign_in_at?: string;
}

export interface AdminAuditLogItem {
  id: string;
  action: string;
  actor_id: string;
  actor_email?: string | null;
  target_user_id?: string | null;
  details?: string | null;
  created_at: string;
}

export interface ArtisanApplicationItem {
  id: string;
  user_id: string;
  full_name?: string | null;
  phone?: string | null;
  craft_category: string;
  experience_years: number;
  state?: string | null;
  district?: string | null;
  workshop_info?: string | null;
  craft_description?: string | null;
  sample_images?: string | null;
  document_references?: string | null;
  status: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AdminUserItem {
  id: string;
  email: string | null;
  role: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
}


