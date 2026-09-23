-- Migration 20260923000006: Enable Supabase Realtime Publication
-- Enables live reactivity on artisan_inquiries, orders, and products tables.

-- 1. Set REPLICA IDENTITY FULL for complete row data on change events
ALTER TABLE public.artisan_inquiries REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;

-- 2. Add tables to supabase_realtime publication (idempotent DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'artisan_inquiries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.artisan_inquiries;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END $$;

-- 3. Record in migration ledger
INSERT INTO public.schema_migrations_ledger (migration_id, name)
VALUES ('20260923000006', 'realtime_publication')
ON CONFLICT (migration_id) DO NOTHING;
