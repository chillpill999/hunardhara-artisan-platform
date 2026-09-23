-- 20260923000002_consolidate_schema_and_rls.sql
-- HunarDhara Single-Source-of-Truth Migration: Schema Consolidation & Comprehensive RLS Policies

-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.craft_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_match_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpdp_consent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deactivated_users ENABLE ROW LEVEL SECURITY;

-- 2. HELPER FUNCTIONS FOR SECURITY DEFINER CHECKS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT coalesce(public.current_user_role() = 'admin', false);
$$;

-- 3. POLICIES: CRAFT CLUSTERS (Public Read, Admin Write)
DO $$
BEGIN
    DROP POLICY IF EXISTS "craft_clusters_select_public" ON public.craft_clusters;
    DROP POLICY IF EXISTS "craft_clusters_admin_all" ON public.craft_clusters;
END $$;

CREATE POLICY "craft_clusters_select_public"
    ON public.craft_clusters FOR SELECT
    USING (true);

CREATE POLICY "craft_clusters_admin_all"
    ON public.craft_clusters FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. POLICIES: PRODUCTS (Public Read Active, Artisan/Admin Write)
DO $$
BEGIN
    DROP POLICY IF EXISTS "products_select_active" ON public.products;
    DROP POLICY IF EXISTS "products_artisan_insert" ON public.products;
    DROP POLICY IF EXISTS "products_artisan_update" ON public.products;
    DROP POLICY IF EXISTS "products_artisan_delete" ON public.products;
    DROP POLICY IF EXISTS "products_admin_all" ON public.products;
END $$;

CREATE POLICY "products_select_active"
    ON public.products FOR SELECT
    USING (is_active = true OR (artisan_id = auth.uid()::text) OR public.is_admin());

CREATE POLICY "products_artisan_insert"
    ON public.products FOR INSERT
    WITH CHECK ((artisan_id = auth.uid()::text) OR public.is_admin());

CREATE POLICY "products_artisan_update"
    ON public.products FOR UPDATE
    USING ((artisan_id = auth.uid()::text) OR public.is_admin())
    WITH CHECK ((artisan_id = auth.uid()::text) OR public.is_admin());

CREATE POLICY "products_artisan_delete"
    ON public.products FOR DELETE
    USING ((artisan_id = auth.uid()::text) OR public.is_admin());

-- 5. POLICIES: ARTISANS (Public Read Active, Artisan/Admin Write)
DO $$
BEGIN
    DROP POLICY IF EXISTS "artisans_select_public" ON public.artisans;
END $$;

CREATE POLICY "artisans_select_public"
    ON public.artisans FOR SELECT
    USING (is_active = true OR (id = auth.uid()) OR public.is_admin());

-- 6. POLICIES: ORDERS (Customer/Artisan Read, Safe Insert, Admin All)
DO $$
BEGIN
    DROP POLICY IF EXISTS "orders_buyer_artisan_select" ON public.orders;
    DROP POLICY IF EXISTS "orders_customer_insert" ON public.orders;
    DROP POLICY IF EXISTS "orders_admin_all" ON public.orders;
END $$;

CREATE POLICY "orders_buyer_artisan_select"
    ON public.orders FOR SELECT
    USING ((customer_id = auth.uid()::text) OR (artisan_id = auth.uid()::text) OR public.is_admin());

CREATE POLICY "orders_customer_insert"
    ON public.orders FOR INSERT
    WITH CHECK ((customer_id = auth.uid()::text) OR public.is_admin());

CREATE POLICY "orders_admin_all"
    ON public.orders FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 7. POLICIES: PRICING BENCHMARKS (Public Read, Admin Write)
DO $$
BEGIN
    DROP POLICY IF EXISTS "pricing_benchmarks_select_public" ON public.pricing_benchmarks;
    DROP POLICY IF EXISTS "pricing_benchmarks_admin_all" ON public.pricing_benchmarks;
END $$;

CREATE POLICY "pricing_benchmarks_select_public"
    ON public.pricing_benchmarks FOR SELECT
    USING (true);

CREATE POLICY "pricing_benchmarks_admin_all"
    ON public.pricing_benchmarks FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 8. POLICIES: B2B MATCH RECORDS (Artisan/Buyer/Admin Access)
DO $$
BEGIN
    DROP POLICY IF EXISTS "b2b_match_records_select" ON public.b2b_match_records;
    DROP POLICY IF EXISTS "b2b_match_records_admin_all" ON public.b2b_match_records;
END $$;

CREATE POLICY "b2b_match_records_select"
    ON public.b2b_match_records FOR SELECT
    USING (
        (artisan_id = auth.uid()::text) 
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.b2b_rfqs r 
            WHERE r.id::text = b2b_match_records.rfq_id AND r.buyer_id = auth.uid()
        )
    );

CREATE POLICY "b2b_match_records_admin_all"
    ON public.b2b_match_records FOR ALL
    USING (public.is_admin() OR auth.role() = 'service_role')
    WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- 9. POLICIES: SYSTEM SETTINGS (Public Read, Admin Write)
DO $$
BEGIN
    DROP POLICY IF EXISTS "system_settings_select_public" ON public.system_settings;
    DROP POLICY IF EXISTS "system_settings_admin_all" ON public.system_settings;
END $$;

CREATE POLICY "system_settings_select_public"
    ON public.system_settings FOR SELECT
    USING (true);

CREATE POLICY "system_settings_admin_all"
    ON public.system_settings FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 10. POLICIES: ADMIN AUDIT LOGS (Admin Read, Trigger/Admin Insert)
DO $$
BEGIN
    DROP POLICY IF EXISTS "admin_audit_logs_select_admin" ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "admin_audit_logs_insert" ON public.admin_audit_logs;
END $$;

CREATE POLICY "admin_audit_logs_select_admin"
    ON public.admin_audit_logs FOR SELECT
    USING (public.is_admin());

CREATE POLICY "admin_audit_logs_insert"
    ON public.admin_audit_logs FOR INSERT
    WITH CHECK (true);

-- 11. POLICIES: DPDP CONSENT LOGS (User Own & Admin Access)
DO $$
BEGIN
    DROP POLICY IF EXISTS "dpdp_consent_logs_select_own" ON public.dpdp_consent_logs;
    DROP POLICY IF EXISTS "dpdp_consent_logs_insert" ON public.dpdp_consent_logs;
END $$;

CREATE POLICY "dpdp_consent_logs_select_own"
    ON public.dpdp_consent_logs FOR SELECT
    USING ((user_id = auth.uid()::text) OR (artisan_id = auth.uid()::text) OR public.is_admin());

CREATE POLICY "dpdp_consent_logs_insert"
    ON public.dpdp_consent_logs FOR INSERT
    WITH CHECK (true);

-- 12. POLICIES: DEACTIVATED USERS (Admin Only)
DO $$
BEGIN
    DROP POLICY IF EXISTS "deactivated_users_admin_all" ON public.deactivated_users;
END $$;

CREATE POLICY "deactivated_users_admin_all"
    ON public.deactivated_users FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 13. SEED STATUTORY PRICING BENCHMARKS
INSERT INTO public.pricing_benchmarks (id, cluster_id, craft_type, item_name, category, materials, standard_labor_hours, benchmark_floor_price, benchmark_retail_price, benchmark_wholesale_price, sample_image_url, tags)
VALUES ('bench-vns-001', 'cluster-varanasi-silk', 'Varanasi Silk', 'Authentic Banarasi Katan Silk Brocade Saree', 'Handloom Sarees', '["Mulberry Silk", "Zari Gold Thread"]'::jsonb, 96.0, 7200.0, 12800.0, 9500.0, '/static/benchmarks/banarasi_saree_bench.jpg', '["Banarasi Silk", "Katan Silk", "GI Tagged", "Handloom Saree"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    craft_type = EXCLUDED.craft_type,
    item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    materials = EXCLUDED.materials,
    standard_labor_hours = EXCLUDED.standard_labor_hours,
    benchmark_floor_price = EXCLUDED.benchmark_floor_price,
    benchmark_retail_price = EXCLUDED.benchmark_retail_price,
    benchmark_wholesale_price = EXCLUDED.benchmark_wholesale_price,
    sample_image_url = EXCLUDED.sample_image_url,
    tags = EXCLUDED.tags;

INSERT INTO public.pricing_benchmarks (id, cluster_id, craft_type, item_name, category, materials, standard_labor_hours, benchmark_floor_price, benchmark_retail_price, benchmark_wholesale_price, sample_image_url, tags)
VALUES ('bench-vns-002', 'cluster-varanasi-silk', 'Varanasi Silk', 'Banarasi Pure Tanchoi Silk Stole / Dupatta', 'Scarves & Stoles', '["Pure Silk", "Satin Weave"]'::jsonb, 32.0, 2400.0, 4500.0, 3200.0, '/static/benchmarks/banarasi_stole_bench.jpg', '["Banarasi Silk", "Tanchoi", "Silk Stole", "Dupatta"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    craft_type = EXCLUDED.craft_type,
    item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    materials = EXCLUDED.materials,
    standard_labor_hours = EXCLUDED.standard_labor_hours,
    benchmark_floor_price = EXCLUDED.benchmark_floor_price,
    benchmark_retail_price = EXCLUDED.benchmark_retail_price,
    benchmark_wholesale_price = EXCLUDED.benchmark_wholesale_price,
    sample_image_url = EXCLUDED.sample_image_url,
    tags = EXCLUDED.tags;

INSERT INTO public.pricing_benchmarks (id, cluster_id, craft_type, item_name, category, materials, standard_labor_hours, benchmark_floor_price, benchmark_retail_price, benchmark_wholesale_price, sample_image_url, tags)
VALUES ('bench-bst-001', 'cluster-bastar-dhokra', 'Bastar Dhokra', 'Bastar Tribal Nandi Brass Figurine 15cm', 'Metal Sculptures', '["Recycled Brass", "Natural Beeswax", "Riverbed Clay"]'::jsonb, 24.0, 1650.0, 2900.0, 2100.0, '/static/benchmarks/dhokra_nandi_bench.jpg', '["Bastar Dhokra", "Lost Wax Casting", "Brass Figurine", "GI Tagged"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    craft_type = EXCLUDED.craft_type,
    item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    materials = EXCLUDED.materials,
    standard_labor_hours = EXCLUDED.standard_labor_hours,
    benchmark_floor_price = EXCLUDED.benchmark_floor_price,
    benchmark_retail_price = EXCLUDED.benchmark_retail_price,
    benchmark_wholesale_price = EXCLUDED.benchmark_wholesale_price,
    sample_image_url = EXCLUDED.sample_image_url,
    tags = EXCLUDED.tags;

INSERT INTO public.pricing_benchmarks (id, cluster_id, craft_type, item_name, category, materials, standard_labor_hours, benchmark_floor_price, benchmark_retail_price, benchmark_wholesale_price, sample_image_url, tags)
VALUES ('bench-bst-002', 'cluster-bastar-dhokra', 'Bastar Dhokra', 'Bastar Dhokra Tribal Wall Hanging Lamp / Diya', 'Home Decor & Lighting', '["Bell Metal Brass", "Beeswax", "Clay Core"]'::jsonb, 16.0, 1200.0, 2100.0, 1500.0, '/static/benchmarks/dhokra_lamp_bench.jpg', '["Bastar Dhokra", "Wall Diya", "Tribal Decor"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    craft_type = EXCLUDED.craft_type,
    item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    materials = EXCLUDED.materials,
    standard_labor_hours = EXCLUDED.standard_labor_hours,
    benchmark_floor_price = EXCLUDED.benchmark_floor_price,
    benchmark_retail_price = EXCLUDED.benchmark_retail_price,
    benchmark_wholesale_price = EXCLUDED.benchmark_wholesale_price,
    sample_image_url = EXCLUDED.sample_image_url,
    tags = EXCLUDED.tags;

INSERT INTO public.pricing_benchmarks (id, cluster_id, craft_type, item_name, category, materials, standard_labor_hours, benchmark_floor_price, benchmark_retail_price, benchmark_wholesale_price, sample_image_url, tags)
VALUES ('bench-bst-003', 'cluster-bastar-dhokra', 'Bastar Dhokra', 'Bastar Dhokra Tribal Musician Quintet Set', 'Metal Figurines', '["Bell Metal Brass", "Beeswax", "Clay"]'::jsonb, 40.0, 3100.0, 5400.0, 3900.0, '/static/benchmarks/dhokra_musicians_bench.jpg', '["Bastar Dhokra", "Tribal Musicians", "Bell Metal"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    craft_type = EXCLUDED.craft_type,
    item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    materials = EXCLUDED.materials,
    standard_labor_hours = EXCLUDED.standard_labor_hours,
    benchmark_floor_price = EXCLUDED.benchmark_floor_price,
    benchmark_retail_price = EXCLUDED.benchmark_retail_price,
    benchmark_wholesale_price = EXCLUDED.benchmark_wholesale_price,
    sample_image_url = EXCLUDED.sample_image_url,
    tags = EXCLUDED.tags;

INSERT INTO public.pricing_benchmarks (id, cluster_id, craft_type, item_name, category, materials, standard_labor_hours, benchmark_floor_price, benchmark_retail_price, benchmark_wholesale_price, sample_image_url, tags)
VALUES ('bench-khj-001', 'cluster-khurja-pottery', 'Khurja Pottery', 'Hand-Painted Khurja Ceramic Flower Vase 28cm', 'Ceramics & Vases', '["China Clay", "Cobalt Glaze", "Feldspar"]'::jsonb, 12.0, 920.0, 1700.0, 1200.0, '/static/benchmarks/khurja_vase_bench.jpg', '["Khurja Pottery", "Ceramic Vase", "Cobalt Blue"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    craft_type = EXCLUDED.craft_type,
    item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    materials = EXCLUDED.materials,
    standard_labor_hours = EXCLUDED.standard_labor_hours,
    benchmark_floor_price = EXCLUDED.benchmark_floor_price,
    benchmark_retail_price = EXCLUDED.benchmark_retail_price,
    benchmark_wholesale_price = EXCLUDED.benchmark_wholesale_price,
    sample_image_url = EXCLUDED.sample_image_url,
    tags = EXCLUDED.tags;

INSERT INTO public.pricing_benchmarks (id, cluster_id, craft_type, item_name, category, materials, standard_labor_hours, benchmark_floor_price, benchmark_retail_price, benchmark_wholesale_price, sample_image_url, tags)
VALUES ('bench-khj-002', 'cluster-khurja-pottery', 'Khurja Pottery', 'Khurja Glazed Stoneware Dinner Plate Set (6 Pcs)', 'Tableware', '["Kaolin Clay", "Quartz", "Food-Safe Ceramic Glaze"]'::jsonb, 20.0, 1600.0, 2900.0, 2100.0, '/static/benchmarks/khurja_dinner_bench.jpg', '["Khurja Pottery", "Stoneware Plates", "Tableware", "Ceramic"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    craft_type = EXCLUDED.craft_type,
    item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    materials = EXCLUDED.materials,
    standard_labor_hours = EXCLUDED.standard_labor_hours,
    benchmark_floor_price = EXCLUDED.benchmark_floor_price,
    benchmark_retail_price = EXCLUDED.benchmark_retail_price,
    benchmark_wholesale_price = EXCLUDED.benchmark_wholesale_price,
    sample_image_url = EXCLUDED.sample_image_url,
    tags = EXCLUDED.tags;

INSERT INTO public.pricing_benchmarks (id, cluster_id, craft_type, item_name, category, materials, standard_labor_hours, benchmark_floor_price, benchmark_retail_price, benchmark_wholesale_price, sample_image_url, tags)
VALUES ('bench-mdb-001', 'cluster-madhubani-painting', 'Madhubani Painting', 'Madhubani Tree of Life Painting A3 Framed', 'Folk Paintings', '["Handmade Paper", "Natural Botanical Dyes", "Soot"]'::jsonb, 20.0, 1200.0, 2300.0, 1650.0, '/static/benchmarks/madhubani_tree_bench.jpg', '["Madhubani Painting", "Tree of Life", "Mithila Art", "Natural Dyes"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    craft_type = EXCLUDED.craft_type,
    item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    materials = EXCLUDED.materials,
    standard_labor_hours = EXCLUDED.standard_labor_hours,
    benchmark_floor_price = EXCLUDED.benchmark_floor_price,
    benchmark_retail_price = EXCLUDED.benchmark_retail_price,
    benchmark_wholesale_price = EXCLUDED.benchmark_wholesale_price,
    sample_image_url = EXCLUDED.sample_image_url,
    tags = EXCLUDED.tags;

INSERT INTO public.pricing_benchmarks (id, cluster_id, craft_type, item_name, category, materials, standard_labor_hours, benchmark_floor_price, benchmark_retail_price, benchmark_wholesale_price, sample_image_url, tags)
VALUES ('bench-mdb-002', 'cluster-madhubani-painting', 'Madhubani Painting', 'Madhubani Kohbar Auspicious Wedding Canvas 60x40cm', 'Folk Paintings', '["Tussar Silk Canvas", "Natural Dyes", "Bamboo Stylus"]'::jsonb, 36.0, 2300.0, 4300.0, 3050.0, '/static/benchmarks/madhubani_kohbar_bench.jpg', '["Madhubani Painting", "Kohbar", "Wedding Art", "Mithila"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    craft_type = EXCLUDED.craft_type,
    item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    materials = EXCLUDED.materials,
    standard_labor_hours = EXCLUDED.standard_labor_hours,
    benchmark_floor_price = EXCLUDED.benchmark_floor_price,
    benchmark_retail_price = EXCLUDED.benchmark_retail_price,
    benchmark_wholesale_price = EXCLUDED.benchmark_wholesale_price,
    sample_image_url = EXCLUDED.sample_image_url,
    tags = EXCLUDED.tags;

INSERT INTO public.pricing_benchmarks (id, cluster_id, craft_type, item_name, category, materials, standard_labor_hours, benchmark_floor_price, benchmark_retail_price, benchmark_wholesale_price, sample_image_url, tags)
VALUES ('bench-cpn-001', 'cluster-channapatna-toys', 'Channapatna Toys', 'Channapatna Classic 7-Tier Rainbow Stacking Ring', 'Wooden Toys', '["Ivory Wood", "Natural Vegetable Lacquer", "Organic Pigments"]'::jsonb, 6.0, 570.0, 1100.0, 780.0, '/static/benchmarks/channapatna_stacker_bench.jpg', '["Channapatna Toys", "Stacking Rings", "Wooden Toy", "Baby Safe"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    craft_type = EXCLUDED.craft_type,
    item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    materials = EXCLUDED.materials,
    standard_labor_hours = EXCLUDED.standard_labor_hours,
    benchmark_floor_price = EXCLUDED.benchmark_floor_price,
    benchmark_retail_price = EXCLUDED.benchmark_retail_price,
    benchmark_wholesale_price = EXCLUDED.benchmark_wholesale_price,
    sample_image_url = EXCLUDED.sample_image_url,
    tags = EXCLUDED.tags;

INSERT INTO public.pricing_benchmarks (id, cluster_id, craft_type, item_name, category, materials, standard_labor_hours, benchmark_floor_price, benchmark_retail_price, benchmark_wholesale_price, sample_image_url, tags)
VALUES ('bench-cpn-002', 'cluster-channapatna-toys', 'Channapatna Toys', 'Channapatna Hand-Turned Rocking Horse Wooden Toy', 'Wooden Toys', '["Wrightia Tinctoria Wood", "Lacquer Polish", "Natural Dyes"]'::jsonb, 12.0, 1150.0, 2150.0, 1550.0, '/static/benchmarks/channapatna_horse_bench.jpg', '["Channapatna Toys", "Rocking Horse", "Hand Turned Toy"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    craft_type = EXCLUDED.craft_type,
    item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    materials = EXCLUDED.materials,
    standard_labor_hours = EXCLUDED.standard_labor_hours,
    benchmark_floor_price = EXCLUDED.benchmark_floor_price,
    benchmark_retail_price = EXCLUDED.benchmark_retail_price,
    benchmark_wholesale_price = EXCLUDED.benchmark_wholesale_price,
    sample_image_url = EXCLUDED.sample_image_url,
    tags = EXCLUDED.tags;

-- 14. SEED DEFAULT PLATFORM SETTINGS
INSERT INTO public.system_settings (key, value, updated_at) VALUES
('marketplace_enabled', 'true', now()),
('artisan_onboarding_enabled', 'true', now()),
('product_publishing_enabled', 'true', now()),
('b2b_enabled', 'true', now()),
('orders_enabled', 'true', now()),
('ai_catalog_enabled', 'true', now()),
('voice_catalog_enabled', 'true', now()),
('maintenance_mode', 'false', now()),
('maintenance_message', 'हुनरधारा प्लेटफ़ॉर्म पर तकनीकी रखरखाव चल रहा है। कृपया कुछ समय बाद पुनः प्रयास करें। (Platform maintenance in progress. Please check back shortly.)', now())
ON CONFLICT (key) DO NOTHING;

-- 15. RECORD MIGRATION IN LEDGER
INSERT INTO public.schema_migrations_ledger (migration_id, name, execution_time_ms)
VALUES ('20260923000002', 'consolidate_schema_and_rls', 0)
ON CONFLICT (migration_id) DO NOTHING;
