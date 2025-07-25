-- Corrected User Profile Creation Fix
-- This script fixes the missing create_user_profile function and trigger
-- Compatible with Supabase PostgreSQL

-- First, drop existing trigger if it exists
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.create_user_profile();

-- Create the create_user_profile function with proper error handling
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into users table with conflict resolution
    INSERT INTO public.users (
        id,
        email,
        role,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        'agent'::user_role,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();
    
    -- Insert into agent_brands table with conflict resolution
    INSERT INTO public.agent_brands (
        agent_id,
        brand_tier,
        has_custom_branding,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        'starter'::brand_tier,
        false,
        NOW(),
        NOW()
    )
    ON CONFLICT (agent_id) DO UPDATE SET
        updated_at = NOW();
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the auth.users insert
        RAISE WARNING 'Failed to create user profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_user_profile();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile() TO anon;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Verification query (optional - comment out if not needed)
-- SELECT 'User profile function and trigger created successfully' as status;