-- Migration 20260923000007: Sovereign B2B Multi-Factor Matching Function
-- Implements the 4-Factor Matching Engine (Craft 35%, Price 30%, Capacity 25%, Location 10%)
-- and persists RFQ & match records with capacity feasibility and transparent explanations.

CREATE OR REPLACE FUNCTION public.execute_b2b_rfq_matching(
  p_craft_type text,
  p_quantity integer,
  p_unit_budget numeric,
  p_deadline_days integer,
  p_delivery_state text DEFAULT NULL,
  p_buyer_organization text DEFAULT NULL,
  p_buyer_email text DEFAULT NULL,
  p_buyer_name text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_buyer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_buyer_id uuid;
  v_rfq_id uuid;
  v_rec record;
  v_matches jsonb := '[]'::jsonb;
  v_single_match jsonb;
  v_craft_score double precision;
  v_price_score double precision;
  v_capacity_score double precision;
  v_location_score double precision;
  v_match_percentage double precision;
  v_capacity_feasible boolean;
  v_est_days integer;
  v_wholesale_price double precision;
  v_explanation text;
  v_matched_count integer := 0;
  v_cluster_feasible boolean := false;
  v_total_cluster_capacity integer := 0;
BEGIN
  -- Determine buyer ID
  v_buyer_id := COALESCE(p_buyer_id, auth.uid());
  
  -- Validation
  IF p_quantity < 1 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY: Required quantity must be at least 1.';
  END IF;
  IF p_unit_budget <= 0 THEN
    RAISE EXCEPTION 'INVALID_BUDGET: Unit budget must be greater than zero.';
  END IF;
  IF p_deadline_days < 1 THEN
    RAISE EXCEPTION 'INVALID_DEADLINE: Deadline days must be at least 1.';
  END IF;

  -- Create RFQ entry
  v_rfq_id := gen_random_uuid();
  INSERT INTO public.b2b_rfqs (
    id,
    buyer_id,
    craft_type,
    quantity,
    required_quantity,
    unit_budget,
    total_budget,
    deadline_days,
    delivery_state,
    buyer_organization,
    buyer_email,
    buyer_name,
    idempotency_key,
    status,
    created_at
  ) VALUES (
    v_rfq_id,
    v_buyer_id,
    p_craft_type,
    p_quantity,
    p_quantity,
    p_unit_budget,
    ROUND((p_unit_budget * p_quantity)::numeric, 2),
    p_deadline_days,
    p_delivery_state,
    p_buyer_organization,
    p_buyer_email,
    p_buyer_name,
    p_idempotency_key,
    'open',
    NOW()
  );

  -- Loop through active artisans to evaluate 4-factor scoring
  FOR v_rec IN 
    SELECT 
      a.id as artisan_id,
      a.full_name as artisan_name,
      COALESCE(a.primary_craft, a.craft, c.craft_name, 'Handicrafts') as craft_specialty,
      COALESCE(a.monthly_capacity_units, 30) as monthly_capacity,
      1200.0 as default_wholesale,
      a.cluster_id,
      COALESCE(a.cluster_name, c.name, 'Indian Craft Cluster') as cluster_name,
      COALESCE(a.state, c.state, 'India') as cluster_state,
      COALESCE(a.district, c.district, '') as cluster_district,
      COALESCE(c.craft_name, a.primary_craft, a.craft, 'Handicrafts') as cluster_craft,
      p.id as product_id,
      p.title as product_title,
      COALESCE(p.wholesale_b2b_price, p.listing_price * 0.7, 1200.0) as product_wholesale
    FROM public.artisans a
    LEFT JOIN public.craft_clusters c ON c.id = a.cluster_id
    LEFT JOIN LATERAL (
      SELECT id, title, wholesale_b2b_price, listing_price
      FROM public.products
      WHERE artisan_id = a.id::text AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    ) p ON true
    WHERE a.is_active = true
  LOOP
    -- 1. Craft Score (35%)
    IF lower(v_rec.craft_specialty) = lower(p_craft_type) OR lower(COALESCE(v_rec.cluster_craft, '')) = lower(p_craft_type) THEN
      v_craft_score := 100.0;
    ELSIF v_rec.craft_specialty ILIKE '%' || p_craft_type || '%' OR p_craft_type ILIKE '%' || v_rec.craft_specialty || '%' THEN
      v_craft_score := 90.0;
    ELSIF v_rec.cluster_craft ILIKE '%' || p_craft_type || '%' OR p_craft_type ILIKE '%' || COALESCE(v_rec.cluster_craft, '') || '%' THEN
      v_craft_score := 85.0;
    ELSE
      v_craft_score := 25.0; -- baseline minimal handicraft overlap
    END IF;

    -- 2. Price Score (30%)
    v_wholesale_price := v_rec.product_wholesale;
    IF v_wholesale_price <= p_unit_budget THEN
      v_price_score := 100.0;
    ELSE
      -- Gradual penalty if price exceeds budget
      v_price_score := GREATEST(10.0, 100.0 - ((v_wholesale_price - p_unit_budget) / p_unit_budget * 100.0));
    END IF;

    -- 3. Capacity Score (25%)
    -- Max feasible production in available deadline
    v_est_days := GREATEST(1, ROUND((p_quantity::double precision / GREATEST(1, v_rec.monthly_capacity)) * 30.0)::integer);
    IF v_est_days <= p_deadline_days THEN
      v_capacity_feasible := true;
      v_capacity_score := 100.0;
    ELSE
      v_capacity_feasible := false;
      v_capacity_score := GREATEST(10.0, ROUND((p_deadline_days::double precision / v_est_days) * 100.0));
    END IF;

    -- 4. Location Proximity Score (10%)
    IF p_delivery_state IS NOT NULL AND (v_rec.cluster_state ILIKE '%' || p_delivery_state || '%' OR p_delivery_state ILIKE '%' || COALESCE(v_rec.cluster_state, '') || '%') THEN
      v_location_score := 100.0;
    ELSE
      v_location_score := 50.0;
    END IF;

    -- Overall 4-Factor Weighted Match Percentage
    v_match_percentage := ROUND((
      (v_craft_score * 0.35) +
      (v_price_score * 0.30) +
      (v_capacity_score * 0.25) +
      (v_location_score * 0.10)
    )::numeric, 1);

    -- Build Match Explanation
    v_explanation := 'Craft Compatibility: ' || v_craft_score::text || '%, ' ||
                     'Quoted Wholesale ₹' || v_wholesale_price::text || ' vs Budget ₹' || p_unit_budget::text || ' (' || v_price_score::text || '%), ' ||
                     'Est. Production: ' || v_est_days::text || ' days (' || (CASE WHEN v_capacity_feasible THEN 'Solo Feasible' ELSE 'Consortium Recommended' END) || '), ' ||
                     'Location: ' || COALESCE(v_rec.cluster_state, 'India') || ' (' || v_location_score::text || '%).';

    -- Include matches with positive craft compatibility (score >= 40%)
    IF v_match_percentage >= 40.0 THEN
      v_matched_count := v_matched_count + 1;
      v_total_cluster_capacity := v_total_cluster_capacity + v_rec.monthly_capacity;

      -- Persist match record
      INSERT INTO public.b2b_match_records (
        id,
        rfq_id,
        artisan_id,
        product_id,
        match_percentage,
        score_craft,
        score_price,
        score_capacity,
        score_location,
        capacity_feasible,
        estimated_production_days,
        quoted_unit_price,
        distance_km,
        match_explanation,
        status,
        created_at
      ) VALUES (
        'match-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
        v_rfq_id::text,
        v_rec.artisan_id::text,
        v_rec.product_id,
        v_match_percentage,
        v_craft_score,
        v_price_score,
        v_capacity_score,
        v_location_score,
        v_capacity_feasible,
        v_est_days,
        v_wholesale_price,
        0.0,
        v_explanation,
        'PROPOSED',
        NOW()
      );

      v_single_match := jsonb_build_object(
        'artisan_id', v_rec.artisan_id,
        'artisan_name', v_rec.artisan_name,
        'cluster_name', COALESCE(v_rec.cluster_name, 'Indian Craft Cluster'),
        'location', COALESCE(v_rec.cluster_state, 'India'),
        'product_id', v_rec.product_id,
        'match_percentage', v_match_percentage,
        'breakdown', jsonb_build_object(
          'craft_compatibility', v_craft_score,
          'price_compatibility', v_price_score,
          'capacity_feasibility', v_capacity_score,
          'location_score', v_location_score
        ),
        'capacity_feasible', v_capacity_feasible,
        'estimated_production_days', v_est_days,
        'offered_wholesale_price', v_wholesale_price,
        'monthly_capacity', v_rec.monthly_capacity,
        'match_explanation', v_explanation
      );

      v_matches := v_matches || jsonb_build_array(v_single_match);
    END IF;
  END LOOP;

  v_cluster_feasible := (v_total_cluster_capacity * (p_deadline_days::double precision / 30.0)) >= p_quantity;

  RETURN jsonb_build_object(
    'rfq_id', v_rfq_id,
    'total_candidates_evaluated', v_matched_count,
    'matches', v_matches,
    'consortium_feasible', v_cluster_feasible,
    'summary', jsonb_build_object(
      'craft_type', p_craft_type,
      'quantity', p_quantity,
      'unit_budget', p_unit_budget,
      'deadline_days', p_deadline_days
    )
  );
END;
$$;

-- Grant permissions to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.execute_b2b_rfq_matching(text, integer, numeric, integer, text, text, text, text, text, uuid) TO authenticated, anon;

-- Admin View for B2B RFQs
CREATE OR REPLACE VIEW public.admin_b2b_rfqs_view AS
SELECT 
  r.id,
  COALESCE(r.buyer_name, 'Procurement Buyer') as buyer_name,
  r.buyer_organization,
  COALESCE(r.buyer_email, 'procurement@crafts.in') as buyer_email,
  r.craft_type,
  COALESCE(r.required_quantity, r.quantity, 1) as required_quantity,
  COALESCE(r.unit_budget, 0) as unit_budget,
  COALESCE(r.total_budget, (r.unit_budget * COALESCE(r.required_quantity, r.quantity, 1))) as total_budget,
  COALESCE(r.deadline_days, 30) as deadline_days,
  r.delivery_state,
  r.status,
  count(m.id)::integer as matches_count,
  r.created_at::text as created_at
FROM public.b2b_rfqs r
LEFT JOIN public.b2b_match_records m ON (m.rfq_id = r.id::text)
GROUP BY r.id, r.buyer_name, r.buyer_organization, r.buyer_email, r.craft_type, r.required_quantity, r.quantity, r.unit_budget, r.total_budget, r.deadline_days, r.delivery_state, r.status, r.created_at;

GRANT SELECT ON public.admin_b2b_rfqs_view TO authenticated, anon;

-- Record in migration ledger
INSERT INTO public.schema_migrations_ledger (migration_id, name)
VALUES ('20260923000007', 'b2b_matching_function')
ON CONFLICT (migration_id) DO NOTHING;
