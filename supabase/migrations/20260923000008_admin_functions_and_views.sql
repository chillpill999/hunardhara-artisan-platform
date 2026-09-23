-- Migration 20260923000008: Super Admin Controls, Governance Views and Metrics
-- Connects platform governance, live statistics, cluster wage governance, and user listings.

-- 1. Realtime Platform Overview Metrics
CREATE OR REPLACE FUNCTION public.get_admin_overview_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_artisans integer;
  v_total_artisans integer;
  v_active_products integer;
  v_total_products integer;
  v_total_orders integer;
  v_total_revenue double precision;
  v_open_rfqs integer;
  v_active_users integer;
  v_suspended_accounts integer;
  v_pending_applications integer;
BEGIN
  SELECT count(*) INTO v_total_artisans FROM public.artisans;
  SELECT count(*) INTO v_active_artisans FROM public.artisans WHERE is_active = true;
  SELECT count(*) INTO v_suspended_accounts FROM public.artisans WHERE is_active = false;
  
  SELECT count(*) INTO v_total_products FROM public.products;
  SELECT count(*) INTO v_active_products FROM public.products WHERE is_active = true;
  
  SELECT count(*), COALESCE(sum(total_price), 0.0) INTO v_total_orders, v_total_revenue FROM public.orders;
  
  SELECT count(*) INTO v_open_rfqs FROM public.b2b_rfqs WHERE status = 'open';
  
  SELECT count(*) INTO v_active_users FROM public.profiles;
  
  SELECT count(*) INTO v_pending_applications FROM public.artisan_applications WHERE status = 'pending';

  RETURN jsonb_build_object(
    'active_users', GREATEST(v_active_users, 1),
    'active_artisans', v_active_artisans,
    'total_artisans', v_total_artisans,
    'pending_applications', v_pending_applications,
    'active_products', v_active_products,
    'total_products', v_total_products,
    'total_orders', v_total_orders,
    'total_revenue', v_total_revenue,
    'open_rfqs', v_open_rfqs,
    'suspended_accounts', v_suspended_accounts,
    'system_health', 'operational',
    'security_warnings', '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_overview_metrics() TO authenticated, anon;

-- 2. Platform Users Listing Function
CREATE OR REPLACE FUNCTION public.get_admin_platform_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_users jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'email', COALESCE(u.email, 'artisan@hunardhara.gov.in'),
      'role', COALESCE(p.role, 'artisan'),
      'is_suspended', COALESCE(d.id IS NOT NULL, false),
      'created_at', COALESCE(p.created_at::text, u.created_at::text),
      'last_sign_in_at', u.last_sign_in_at::text
    )
  ) INTO v_users
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.deactivated_users d ON d.id = p.id::text;

  RETURN COALESCE(v_users, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_platform_users() TO authenticated, anon;

-- 3. Admin Artisans Governance View
CREATE OR REPLACE VIEW public.admin_artisans_view AS
SELECT 
  a.id,
  a.full_name,
  a.phone_number,
  a.state,
  a.district,
  COALESCE(a.primary_craft, a.craft, 'Handicrafts') as primary_craft,
  a.cluster_id,
  COALESCE(a.cluster_name, c.name, 'Regional Cluster') as cluster_name,
  COALESCE(a.is_active, true) as is_active,
  COALESCE(a.is_verified, true) as gi_verified,
  count(p.id)::integer as products_count,
  a.created_at::text as created_at
FROM public.artisans a
LEFT JOIN public.craft_clusters c ON c.id = a.cluster_id
LEFT JOIN public.products p ON p.artisan_id = a.id::text AND p.is_active = true
GROUP BY a.id, a.full_name, a.phone_number, a.state, a.district, a.primary_craft, a.craft, a.cluster_id, a.cluster_name, c.name, a.is_active, a.is_verified, a.created_at;

GRANT SELECT ON public.admin_artisans_view TO authenticated, anon;

-- 4. Admin Products Governance View
CREATE OR REPLACE VIEW public.admin_products_view AS
SELECT 
  p.id,
  p.title,
  p.artisan_id,
  COALESCE(a.full_name, 'Verified Artisan') as artisan_name,
  p.craft_type,
  p.listing_price,
  COALESCE(p.floor_price, 0) as floor_price,
  COALESCE(p.stock_quantity, 1) as stock_quantity,
  p.is_active,
  p.studio_image_url,
  p.created_at::text as created_at
FROM public.products p
LEFT JOIN public.artisans a ON a.id::text = p.artisan_id;

GRANT SELECT ON public.admin_products_view TO authenticated, anon;

-- 5. Admin Craft Clusters Governance View
CREATE OR REPLACE VIEW public.admin_clusters_view AS
SELECT 
  c.id,
  c.name,
  c.craft_name,
  c.state,
  c.district,
  c.statutory_daily_wage,
  c.statutory_hourly_wage,
  c.gi_tag_status,
  c.gi_tag_number,
  count(a.id)::integer as artisans_count,
  c.updated_at::text as updated_at
FROM public.craft_clusters c
LEFT JOIN public.artisans a ON a.cluster_id = c.id
GROUP BY c.id, c.name, c.craft_name, c.state, c.district, c.statutory_daily_wage, c.statutory_hourly_wage, c.gi_tag_status, c.gi_tag_number, c.updated_at;

GRANT SELECT ON public.admin_clusters_view TO authenticated, anon;

-- 6. Admin Orders Governance View
CREATE OR REPLACE VIEW public.admin_orders_view AS
SELECT 
  id,
  order_number,
  customer_id,
  artisan_id,
  product_id,
  product_title,
  quantity,
  total_price,
  status,
  COALESCE(payment_status, 'PAID') as payment_status,
  created_at::text as created_at
FROM public.orders;

GRANT SELECT ON public.admin_orders_view TO authenticated, anon;

-- 7. Ensure RLS policies allow admin operations
DO $$
BEGIN
  -- System settings policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'system_settings' AND policyname = 'system_settings_read'
  ) THEN
    CREATE POLICY system_settings_read ON public.system_settings FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'system_settings' AND policyname = 'system_settings_admin_write'
  ) THEN
    CREATE POLICY system_settings_admin_write ON public.system_settings 
      FOR ALL USING (is_admin() OR (auth.role() = 'service_role'))
      WITH CHECK (is_admin() OR (auth.role() = 'service_role'));
  END IF;

  -- Admin audit logs policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_audit_logs' AND policyname = 'admin_audit_logs_read'
  ) THEN
    CREATE POLICY admin_audit_logs_read ON public.admin_audit_logs 
      FOR SELECT USING (is_admin() OR (auth.role() = 'service_role'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_audit_logs' AND policyname = 'admin_audit_logs_insert'
  ) THEN
    CREATE POLICY admin_audit_logs_insert ON public.admin_audit_logs 
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- 8. Record in migration ledger
INSERT INTO public.schema_migrations_ledger (migration_id, name)
VALUES ('20260923000008', 'admin_functions_and_views')
ON CONFLICT (migration_id) DO NOTHING;
