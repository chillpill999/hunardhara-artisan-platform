-- Migration 20260923000005: Atomic Checkout Function and Order Management
-- Implements row-level locking (FOR UPDATE) for race-condition-safe inventory decrement,
-- order record creation, and enriched customer/artisan order retrieval.

-- 1. Ensure RLS UPDATE policies exist on public.orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_artisan_update'
  ) THEN
    CREATE POLICY orders_artisan_update ON public.orders
      FOR UPDATE TO public
      USING (((artisan_id)::text = (auth.uid())::text) OR is_admin())
      WITH CHECK (((artisan_id)::text = (auth.uid())::text) OR is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_customer_update'
  ) THEN
    CREATE POLICY orders_customer_update ON public.orders
      FOR UPDATE TO public
      USING ((((customer_id)::text = (auth.uid())::text) AND status = 'pending') OR is_admin())
      WITH CHECK ((((customer_id)::text = (auth.uid())::text) AND status IN ('pending', 'cancelled')) OR is_admin());
  END IF;
END $$;

-- 2. Atomic Cart Checkout Procedure
CREATE OR REPLACE FUNCTION public.process_cart_checkout(
  p_items jsonb,
  p_customer_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id text;
  v_item jsonb;
  v_product_id text;
  v_quantity integer;
  v_product record;
  v_artisan record;
  v_cluster_name text;
  v_item_total double precision;
  v_statutory_wage double precision;
  v_total_amount double precision := 0.0;
  v_total_items integer := 0;
  v_order_id text;
  v_order_number text;
  v_created_orders jsonb := '[]'::jsonb;
  v_single_order jsonb;
BEGIN
  -- Determine customer ID (from parameter or auth context)
  v_customer_id := COALESCE(NULLIF(p_customer_id, ''), auth.uid()::text);
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Customer must be authenticated to checkout.';
  END IF;

  -- Validate cart items presence
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART: Cart must contain at least one item.';
  END IF;

  -- Process each item inside the single transaction
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := v_item->>'product_id';
    v_quantity := COALESCE((v_item->>'quantity')::integer, 1);

    IF v_quantity < 1 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY: Quantity for each item must be at least 1.';
    END IF;

    -- Concurrency safeguard: Row-level lock FOR UPDATE
    SELECT id, title, listing_price, stock_quantity, is_active, artisan_id, studio_image_url, raw_photo_url, craft_type, hourly_wage_rate, labor_hours
    INTO v_product
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND: Product with ID "%" does not exist.', v_product_id;
    END IF;

    IF NOT v_product.is_active THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE: Product "%" is currently inactive.', v_product.title;
    END IF;

    IF v_product.listing_price <= 0 THEN
      RAISE EXCEPTION 'INVALID_PRICE: Product "%" listing price is invalid.', v_product.title;
    END IF;

    IF v_product.stock_quantity < v_quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: Requested % units of "%", but only % available in inventory.',
        v_quantity, v_product.title, v_product.stock_quantity;
    END IF;

    -- Deduct stock atomically
    UPDATE public.products
    SET stock_quantity = stock_quantity - v_quantity,
        updated_at = NOW()
    WHERE id = v_product.id;

    -- Artisan and cluster metadata lookup
    SELECT a.full_name, c.name as cluster_name
    INTO v_artisan
    FROM public.artisans a
    LEFT JOIN public.craft_clusters c ON c.id = a.cluster_id
    WHERE a.id = v_product.artisan_id;

    v_cluster_name := COALESCE(v_artisan.cluster_name, '');

    -- Calculations
    v_item_total := ROUND((v_product.listing_price * v_quantity)::numeric, 2);
    v_statutory_wage := ROUND((COALESCE(v_product.hourly_wage_rate, 50.0) * COALESCE(v_product.labor_hours, 5.0) * v_quantity)::numeric, 2);

    v_total_amount := v_total_amount + v_item_total;
    v_total_items := v_total_items + v_quantity;

    -- Identifiers
    v_order_id := 'ord-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
    v_order_number := 'HN-' || to_char(NOW(), 'YYYYMM') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

    -- Insert Order
    INSERT INTO public.orders (
      id,
      order_number,
      customer_id,
      artisan_id,
      product_id,
      product_title,
      quantity,
      total_price,
      status,
      payment_status,
      created_at
    ) VALUES (
      v_order_id,
      v_order_number,
      v_customer_id,
      v_product.artisan_id,
      v_product.id,
      v_product.title,
      v_quantity,
      v_item_total,
      'pending',
      'unpaid',
      NOW()
    );

    -- Build Enriched Order JSON for client response
    v_single_order := jsonb_build_object(
      'id', v_order_id,
      'order_number', v_order_number,
      'customer_id', v_customer_id,
      'artisan_id', v_product.artisan_id,
      'product_id', v_product.id,
      'product_title', v_product.title,
      'quantity', v_quantity,
      'total_price', v_item_total,
      'status', 'pending',
      'payment_status', 'unpaid',
      'created_at', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'product_image_url', COALESCE(v_product.studio_image_url, v_product.raw_photo_url),
      'craft_type', v_product.craft_type,
      'artisan_name', v_artisan.full_name,
      'cluster_name', v_cluster_name,
      'statutory_wage', v_statutory_wage
    );

    v_created_orders := v_created_orders || jsonb_build_array(v_single_order);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'orders', v_created_orders,
    'total_amount', v_total_amount,
    'total_items', v_total_items
  );
END;
$$;

-- 3. Enriched Customer Orders Query Procedure
CREATE OR REPLACE FUNCTION public.get_customer_orders(p_customer_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id text;
  v_is_adm boolean;
  v_result jsonb;
BEGIN
  v_customer_id := COALESCE(NULLIF(p_customer_id, ''), auth.uid()::text);
  v_is_adm := public.is_admin();

  IF v_customer_id IS NULL AND NOT v_is_adm THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'customer_id', o.customer_id,
      'artisan_id', o.artisan_id,
      'product_id', o.product_id,
      'product_title', o.product_title,
      'quantity', o.quantity,
      'total_price', o.total_price,
      'status', o.status,
      'payment_status', o.payment_status,
      'payment_id', o.payment_id,
      'payment_provider', o.payment_provider,
      'paid_at', o.paid_at,
      'created_at', to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'product_image_url', COALESCE(p.studio_image_url, p.raw_photo_url),
      'craft_type', p.craft_type,
      'artisan_name', a.full_name,
      'cluster_name', c.name,
      'statutory_wage', ROUND((COALESCE(p.hourly_wage_rate, 50.0) * COALESCE(p.labor_hours, 5.0) * o.quantity)::numeric, 2)
    ) ORDER BY o.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM public.orders o
  LEFT JOIN public.products p ON p.id = o.product_id
  LEFT JOIN public.artisans a ON a.id = o.artisan_id
  LEFT JOIN public.craft_clusters c ON c.id = a.cluster_id
  WHERE (v_is_adm OR o.customer_id = v_customer_id);

  RETURN v_result;
END;
$$;

-- 4. Enriched Artisan Orders Query Procedure
CREATE OR REPLACE FUNCTION public.get_artisan_orders(p_artisan_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_artisan_id text;
  v_is_adm boolean;
  v_result jsonb;
BEGIN
  v_artisan_id := COALESCE(NULLIF(p_artisan_id, ''), auth.uid()::text);
  v_is_adm := public.is_admin();

  IF v_artisan_id IS NULL AND NOT v_is_adm THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'customer_id', o.customer_id,
      'artisan_id', o.artisan_id,
      'product_id', o.product_id,
      'product_title', o.product_title,
      'quantity', o.quantity,
      'total_price', o.total_price,
      'status', o.status,
      'payment_status', o.payment_status,
      'payment_id', o.payment_id,
      'payment_provider', o.payment_provider,
      'paid_at', o.paid_at,
      'created_at', to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'product_image_url', COALESCE(p.studio_image_url, p.raw_photo_url),
      'craft_type', p.craft_type,
      'artisan_name', a.full_name,
      'cluster_name', c.name,
      'statutory_wage', ROUND((COALESCE(p.hourly_wage_rate, 50.0) * COALESCE(p.labor_hours, 5.0) * o.quantity)::numeric, 2)
    ) ORDER BY o.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM public.orders o
  LEFT JOIN public.products p ON p.id = o.product_id
  LEFT JOIN public.artisans a ON a.id = o.artisan_id
  LEFT JOIN public.craft_clusters c ON c.id = a.cluster_id
  WHERE (v_is_adm OR o.artisan_id = v_artisan_id);

  RETURN v_result;
END;
$$;

-- 5. Permissions
GRANT EXECUTE ON FUNCTION public.process_cart_checkout(jsonb, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_orders(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_artisan_orders(text) TO authenticated, anon;

-- Record in migration ledger
INSERT INTO public.schema_migrations_ledger (migration_id, name)
VALUES ('20260923000005', 'atomic_checkout_function')
ON CONFLICT (migration_id) DO NOTHING;
