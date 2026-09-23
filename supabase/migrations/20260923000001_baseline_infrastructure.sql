-- 20260923000001_baseline_infrastructure.sql
-- HunarDhara Single-Source-of-Truth Migration: Baseline Extensions & Infrastructure

-- 1. Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Infrastructure metadata table for version tracking & cutover verification
CREATE TABLE IF NOT EXISTS public.schema_migrations_ledger (
    migration_id VARCHAR(100) PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checksum TEXT,
    execution_time_ms INTEGER
);

ALTER TABLE public.schema_migrations_ledger ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated admins and anon health checks
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schema_migrations_ledger' AND policyname = 'Allow public read of migration ledger'
    ) THEN
        CREATE POLICY "Allow public read of migration ledger"
            ON public.schema_migrations_ledger
            FOR SELECT
            USING (true);
    END IF;
END $$;

INSERT INTO public.schema_migrations_ledger (migration_id, name, execution_time_ms)
VALUES ('20260923000001', 'baseline_infrastructure', 0)
ON CONFLICT (migration_id) DO NOTHING;
