-- 20260923000004_auth_triggers_and_roles.sql
-- HunarDhara Single-Source-of-Truth Migration: Open Artisan Access, Auto-Provisioning & Role Synchronization

-- 1. Function to ensure an artisan row exists for a profile (idempotent, auto-verified)
CREATE OR REPLACE FUNCTION public.ensure_artisan_record(p_user_id uuid)
RETURNS public.artisans
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_artisan public.artisans%ROWTYPE;
    v_full_name text;
    v_craft text;
    v_cluster text;
    v_state text;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_NOT_FOUND: Profile % does not exist', p_user_id;
    END IF;

    -- Check if artisan row already exists
    SELECT * INTO v_artisan FROM public.artisans WHERE id = p_user_id;
    IF FOUND THEN
        -- Ensure active and verified per open-access directive
        UPDATE public.artisans
        SET is_active = true,
            is_verified = true,
            updated_at = now()
        WHERE id = p_user_id
        RETURNING * INTO v_artisan;
        
        RETURN v_artisan;
    END IF;

    -- Populate initial attributes
    v_full_name := COALESCE(v_profile.full_name, 'Verified Artisan');
    v_craft := COALESCE(v_profile.craft_category, 'Traditional Handicrafts');
    v_state := COALESCE(v_profile.state, 'Uttar Pradesh');
    v_cluster := 'cluster-varanasi-silk';

    INSERT INTO public.artisans (
        id,
        full_name,
        craft,
        primary_craft,
        cluster_id,
        cluster_name,
        state,
        district,
        village,
        experience_years,
        bio,
        is_verified,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        p_user_id,
        v_full_name,
        v_craft,
        v_craft,
        v_cluster,
        'Varanasi Silk Handloom Cluster',
        v_state,
        'Varanasi',
        'Craft Artisan Hub',
        5,
        'Authentic Indian Heritage Artisan verified through HunarDhara platform.',
        true,
        true,
        now(),
        now()
    )
    RETURNING * INTO v_artisan;

    -- Also ensure role in profiles is updated to artisan
    UPDATE public.profiles
    SET role = 'artisan',
        updated_at = now()
    WHERE id = p_user_id;

    RETURN v_artisan;
END;
$$;

-- 2. Trigger on artisan_applications: Immediate auto-approval
CREATE OR REPLACE FUNCTION public.handle_artisan_application_auto_approve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Auto-approve application immediately
    NEW.status := 'approved';
    NEW.reviewed_at := now();
    NEW.reviewed_by := 'SYSTEM_AUTO_APPROVE';

    -- Ensure artisan profile is provisioned and active
    PERFORM public.ensure_artisan_record(NEW.user_id);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_artisan_application_auto_approve ON public.artisan_applications;
CREATE TRIGGER tr_artisan_application_auto_approve
    BEFORE INSERT ON public.artisan_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_artisan_application_auto_approve();

-- 3. Enhance handle_new_user to auto-provision artisan record if user signs up with artisan role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  extracted_role text;
  is_admin_email boolean;
  is_completed boolean;
BEGIN
  -- Immediately confirm email for friction-free login
  UPDATE auth.users 
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = NEW.id;

  is_admin_email := LOWER(NEW.email) IN ('aryanrockstar2007@gmail.com', 'admin@hunardhara.gov.in');
  extracted_role := NEW.raw_user_meta_data->>'role';

  IF is_admin_email THEN
    extracted_role := 'admin';
    is_completed := true;
  ELSIF extracted_role IN ('artisan', 'customer') THEN
    is_completed := true;
  ELSE
    extracted_role := 'artisan'; -- Open-access default
    is_completed := true;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    avatar_url,
    phone,
    state,
    craft_category,
    preferred_language,
    onboarding_completed,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    CASE 
      WHEN is_admin_email THEN 'Lead Administrator'
      ELSE COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Hunardhara Artisan')
    END,
    extracted_role,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'state', 'India'),
    COALESCE(NEW.raw_user_meta_data->>'craft_category', 'Traditional Handicrafts'),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'hi'),
    is_completed,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
      avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
      role = COALESCE(public.profiles.role, EXCLUDED.role),
      updated_at = now();

  -- If artisan, auto-provision in artisans table
  IF extracted_role = 'artisan' THEN
    INSERT INTO public.artisans (
        id,
        full_name,
        craft,
        primary_craft,
        cluster_id,
        cluster_name,
        state,
        district,
        experience_years,
        bio,
        is_verified,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Hunardhara Artisan'),
        COALESCE(NEW.raw_user_meta_data->>'craft_category', 'Traditional Handicrafts'),
        COALESCE(NEW.raw_user_meta_data->>'craft_category', 'Traditional Handicrafts'),
        'cluster-varanasi-silk',
        'Varanasi Silk Handloom Cluster',
        COALESCE(NEW.raw_user_meta_data->>'state', 'India'),
        'Varanasi',
        5,
        'Authentic Indian Heritage Artisan verified through HunarDhara platform.',
        true,
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE
    SET is_active = true,
        is_verified = true,
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Record migration in ledger
INSERT INTO public.schema_migrations_ledger (migration_id, name, execution_time_ms)
VALUES ('20260923000004', 'auth_triggers_and_roles', 0)
ON CONFLICT (migration_id) DO NOTHING;
