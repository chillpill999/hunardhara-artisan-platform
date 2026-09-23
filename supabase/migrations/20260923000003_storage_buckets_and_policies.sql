-- 20260923000003_storage_buckets_and_policies.sql
-- HunarDhara Single-Source-of-Truth Migration: Storage Buckets & Policies

-- 1. Ensure 'craft-images' bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'craft-images',
    'craft-images',
    true,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Ensure 'artisan-private-docs' bucket exists and is private
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'artisan-private-docs',
    'artisan-private-docs',
    false,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

-- 3. Create 'voice-inputs' bucket for artisan audio recordings (private, up to 25MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'voice-inputs',
    'voice-inputs',
    false,
    26214400, -- 25MB
    ARRAY['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/x-m4a', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/x-m4a', 'video/webm'];

-- 4. Voice Inputs Storage Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Artisan Voice Inputs Read" ON storage.objects;
    DROP POLICY IF EXISTS "Artisan Voice Inputs Upload" ON storage.objects;
    DROP POLICY IF EXISTS "Artisan Voice Inputs Delete" ON storage.objects;
END $$;

CREATE POLICY "Artisan Voice Inputs Read"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'voice-inputs' AND (
            (storage.foldername(name))[1] = auth.uid()::text 
            OR name LIKE auth.uid()::text || '/%'
            OR public.is_admin()
            OR auth.role() = 'service_role'
        )
    );

CREATE POLICY "Artisan Voice Inputs Upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'voice-inputs' AND (
            auth.role() = 'authenticated'
            OR auth.role() = 'service_role'
        )
    );

CREATE POLICY "Artisan Voice Inputs Delete"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'voice-inputs' AND (
            (storage.foldername(name))[1] = auth.uid()::text 
            OR name LIKE auth.uid()::text || '/%'
            OR public.is_admin()
            OR auth.role() = 'service_role'
        )
    );

-- 5. Enhanced Craft Images Upload Policy (Supports prefix or authenticated artisan uploads)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Artisan Flexible Craft Images Upload" ON storage.objects;
END $$;

CREATE POLICY "Artisan Flexible Craft Images Upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'craft-images' AND (
            auth.role() = 'authenticated'
            OR auth.role() = 'service_role'
        )
    );

-- 6. Record Migration in Ledger
INSERT INTO public.schema_migrations_ledger (migration_id, name, execution_time_ms)
VALUES ('20260923000003', 'storage_buckets_and_policies', 0)
ON CONFLICT (migration_id) DO NOTHING;
