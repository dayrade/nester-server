-- Enhanced User Profile Creation Fix
-- This script provides both automatic trigger and manual RPC functions

-- 1. Create the trigger function with duplicate handling (no parameters, uses NEW from trigger context)
CREATE OR REPLACE FUNCTION public.create_user_profile_trigger()
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
        RAISE WARNING 'Failed to create user profile: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create an RPC-callable function for manual profile creation with duplicate handling
CREATE OR REPLACE FUNCTION public.create_user_profile_manual(
    user_id UUID,
    user_email TEXT
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    user_existed BOOLEAN := false;
    brand_existed BOOLEAN := false;
BEGIN
    -- Check if user already exists
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = user_id) INTO user_existed;
    SELECT EXISTS(SELECT 1 FROM public.agent_brands WHERE agent_id = user_id) INTO brand_existed;
    
    -- Insert into users table with conflict resolution
    INSERT INTO public.users (
        id,
        email,
        role,
        created_at,
        updated_at
    ) VALUES (
        user_id,
        user_email,
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
        user_id,
        'starter'::brand_tier,
        false,
        NOW(),
        NOW()
    )
    ON CONFLICT (agent_id) DO UPDATE SET
        updated_at = NOW();
    
    result := json_build_object(
        'success', true,
        'user_id', user_id,
        'user_existed', user_existed,
        'brand_existed', brand_existed,
        'message', CASE 
            WHEN user_existed AND brand_existed THEN 'User profile updated successfully'
            WHEN user_existed OR brand_existed THEN 'User profile partially created/updated'
            ELSE 'User profile created successfully'
        END
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        result := json_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create/update user profile'
        );
        RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_user_profile_trigger();

-- 4. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_user_profile_trigger() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile_trigger() TO anon;
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(UUID, TEXT) TO anon;

-- 5. Reload schema cache
NOTIFY pgrst, 'reload schema';