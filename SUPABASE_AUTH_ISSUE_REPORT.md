# Supabase Authentication Trigger Issue: Complete Analysis and Solutions

## Current Status

**CRITICAL**: The `create_user_profile()` function and its trigger are missing from the Supabase database, causing all user signups to fail with "Database error saving new user".

**UPDATE**: After running `NOTIFY pgrst, 'reload schema';` in the SQL Editor (which returned "0 rows affected" as expected), the function is still not found. This confirms that the SQL fix from `fix-missing-trigger.sql` has **NOT been applied yet**.

**VERIFICATION RESULTS**:
- ✅ NOTIFY command executed successfully (0 rows affected is normal)
- ❌ `create_user_profile` function still not found (PGRST202 error)
- ❌ User signup still fails with "Database error saving new user"
- ❌ Schema cache reload did not resolve the issue

**CONCLUSION**: The SQL script needs to be manually executed in the Supabase SQL Editor.

## IMMEDIATE ACTION REQUIRED

**Step 1: Apply the SQL Fix**
1. Open your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the entire contents of `fix-missing-trigger.sql` (located in the server directory)
4. Paste and execute the SQL script
5. Verify execution completed without errors

**Step 2: Test the Fix**
After applying the SQL script, run this test command:
```bash
node -e "require('dotenv').config(); const { createClient } = require('@supabase/supabase-js'); const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY); supabase.auth.signUp({ email: 'test' + Date.now() + '@example.com', password: 'testpassword123' }).then(result => console.log('Signup test:', result.error ? 'FAILED: ' + result.error.message : 'SUCCESS')).catch(err => console.error('Test error:', err));"
```

**Expected Result**: Signup should succeed without "Database error saving new user".

## Root Cause Analysis

The **primary issue** is that the `create_user_profile()` function is **missing from your Supabase database**. This is confirmed by the **PGRST202 error** which specifically states that the function cannot be found in the schema cache[1][2]. The trigger itself may also be missing, but the function is the core component that's absent.

## Why This Happens

### 1. **Function and Trigger Are Not Automatically Created**
Unlike some database objects, the `create_user_profile()` function and associated trigger are **not automatically generated** by Supabase. They must be explicitly created via SQL[3][4].

### 2. **SQL Execution Order Issues**
Database triggers must be created **after** the function they reference exists. If the SQL was run out of order or partially failed, the trigger might reference a non-existent function[5][6].

### 3. **Schema Cache Staleness**
When database objects are created or modified, PostgREST's schema cache may become stale, causing the API to not recognize newly created functions[7][8].

## Required Solutions

### Solution 1: Create the Missing Function and Trigger

Execute this SQL in your Supabase SQL Editor:

```sql
-- Create the missing function with proper security definer
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into users table
    INSERT INTO public.users (
        id, email, role, created_at, updated_at
    ) VALUES (
        NEW.id, NEW.email, 'agent'::user_role, NOW(), NOW()
    );
    
    -- Insert into agent_brands table
    INSERT INTO public.agent_brands (
        agent_id, brand_tier, has_custom_branding, created_at, updated_at
    ) VALUES (
        NEW.id, 'starter'::brand_tier, false, NOW(), NOW()
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create user profile: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_user_profile();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile() TO anon;
```

### Solution 2: Reload the Schema Cache

After creating the function, reload PostgREST's schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

This ensures the API recognizes the newly created function[7][8].

## Key Technical Requirements

### 1. **Security Definer is Essential**
The function **must** use `SECURITY DEFINER` because:
- Triggers on `auth.users` run as the `supabase_auth_admin` role
- This role has limited permissions outside the `auth` schema
- `SECURITY DEFINER` elevates privileges to the function owner's level[9][10]

### 2. **Proper Error Handling**
Include exception handling to prevent trigger failures from breaking authentication:

```sql
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create user profile: %', SQLERRM;
        RETURN NEW;
```

### 3. **Correct Trigger Timing**
Use `AFTER INSERT` to ensure the user record is fully created before attempting profile creation[11][12].

## Alternative Approaches

### Option 1: Application-Level Profile Creation

Instead of database triggers, handle profile creation in your application:

```javascript
// In your signup handler
const { data: authData, error: authError } = await supabase.auth.signUp({
  email,
  password
});

if (authData.user && !authError) {
  // Create profile manually
  const { error: profileError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email: authData.user.email,
      role: 'agent'
    });
    
  if (!profileError) {
    await supabase
      .from('agent_brands')
      .insert({
        agent_id: authData.user.id,
        brand_tier: 'starter',
        has_custom_branding: false
      });
  }
}
```

### Option 2: Database Function Called via RPC

Create a function that can be called directly after signup:

```sql
CREATE OR REPLACE FUNCTION create_user_profile_rpc(user_id UUID, user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO public.users (id, email, role, created_at, updated_at)
    VALUES (user_id, user_email, 'agent'::user_role, NOW(), NOW());
    
    INSERT INTO public.agent_brands (agent_id, brand_tier, has_custom_branding, created_at, updated_at)
    VALUES (user_id, 'starter'::brand_tier, false, NOW(), NOW());
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Verification Steps

After implementing the solution:

1. **Check Function Exists**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'create_user_profile';
   ```

2. **Check Trigger Exists**:
   ```sql
   SELECT trigger_name FROM information_schema.triggers 
   WHERE event_object_table = 'users' 
   AND trigger_schema = 'auth';
   ```

3. **Test Signup Flow**:
   ```bash
   curl -X POST http://localhost:3001/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123"}'
   ```

4. **Verify Profile Creation**:
   ```sql
   SELECT * FROM public.users WHERE email = 'test@example.com';
   SELECT * FROM public.agent_brands WHERE agent_id = (SELECT id FROM public.users WHERE email = 'test@example.com');
   ```

## Best Practices

1. **Always use `SECURITY DEFINER`** for auth triggers[9][10]
2. **Include comprehensive error handling** to prevent auth failures
3. **Test thoroughly** in development before production deployment
4. **Monitor trigger performance** as it affects signup latency
5. **Consider rate limiting** to prevent abuse during profile creation

The trigger-based approach is the **most robust solution** as it ensures profile creation happens atomically with user creation, preventing orphaned auth records without corresponding profiles[11][12].

[1] https://github.com/orgs/supabase/discussions/33069
[2] https://huggingface.co/spaces/fisherman611/gaia-agent/discussions/2
[3] https://github.com/orgs/supabase/discussions/306
[4] https://dev.to/erickson24/how-to-automatically-add-authenticated-users-to-your-supabase-database-4006
[5] https://github.com/orgs/supabase/discussions/6518
[6] https://www.youtube.com/watch?v=tNhg-DhvyC8
[7] https://github.com/orgs/supabase/discussions/2935
[8] https://docs.postgrest.org/en/v12/references/schema_cache.html
[9] https://stackoverflow.com/questions/77600776/trigger-function-permissions-issue-in-supabase-access-denied-for-function-calle
[10] https://stackoverflow.com/questions/78996250/supabase-cannot-add-users-use-a-signup-form-when-a-trigger-function-is-lis
[11] https://daily-dev-tips.com/posts/supabase-automatically-create-user-profiles-on-sign-up/
[12] https://www.sandromaglione.com/articles/supabase-database-user-sign-up-and-row-level-security
[13] https://www.reddit.com/r/Supabase/comments/16uiokd/why_cant_i_create_a_trigger_on_authusers_table/
[14] https://dantedecodes.vercel.app/articles/automate-database-processes-supabase-triggers-2dla/
[15] https://stackoverflow.com/questions/78916806/how-to-access-auth-users-table-for-functions-trigger
[16] https://supabase.com/docs/guides/auth
[17] https://stackoverflow.com/questions/79540983/why-isn-t-this-supabase-trigger-working
[18] https://www.youtube.com/watch?v=4A4KFdanCb4
[19] https://trigger.dev/blog/supabase-and-trigger-dev
[20] https://github.com/orgs/supabase/discussions/34518
[21] https://stackoverflow.com/questions/75945719/add-user-metadata-in-flutter
[22] https://supabase.com/docs/guides/troubleshooting/dashboard-errors-when-managing-users-N1ls4A
[23] https://www.reddit.com/r/Supabase/comments/1jhkks7/signinwithotp_creates_users_without_verifying_the/
[24] https://www.youtube.com/watch?v=mcrqn77lUmM
[25] https://www.ojaswiat.com/blog/2334752
[26] https://supabase.com/docs/guides/database/postgres/triggers
[27] https://supabase.com/docs/guides/auth/managing-user-data
[28] https://stackoverflow.com/questions/78717845/how-to-check-if-user-is-currently-logged-in-and-redirect-him-to-homescreen-or-el
[29] https://supabase.com/docs/guides/troubleshooting/resolving-500-status-authentication-errors-7bU5U8
[30] https://github.com/hwchase17/langchainjs/issues/1795
[31] https://supabase.com/blog/event-triggers-wo-superuser
[32] https://www.reddit.com/r/Supabase/comments/17nf3gv/supabase_postgis_function_not_found/
[33] https://github.com/orgs/supabase/discussions/3614
[34] https://stackoverflow.com/questions/76747152/pgrst202-error-when-calling-rpc-with-passed-in-parameter
[35] https://dev.to/kalama_ayubu_920a009aeba9/supabase-triggers-6g5
[36] https://docs.postgrest.org/en/v10/schema_cache.html
[37] https://community.n8n.io/t/error-with-supabase-vector-stores/71652
[38] https://supabase.com/docs/guides/database/postgres/row-level-security
[39] https://community.flutterflow.io/community-tutorials/post/introduction-to-supabase-sql-trigger-functions-and-custom-sql-queries-j8vj2x7wpDBwu1l
[40] https://supabase.com/docs/guides/database/postgres/timeouts
[41] https://www.youtube.com/watch?v=4uUZ8nq0ePs
[42] https://auth0.com/docs/customize/actions/explore-triggers/signup-and-login-triggers/post-user-registration-trigger
[43] https://code.build/p/creating-a-user-profile-on-supabase-sign-up-gvCrKG
[44] https://firebase.google.com/docs/functions/auth-events
[45] https://www.draxlr.com/blogs/supabase-sql-query-cheat-sheet/
[46] https://github.com/orgs/supabase/discussions/3491
[47] https://stackoverflow.com/questions/42857641/execute-a-stored-procedure-through-a-trigger-right-after-a-user-was-created-on-t
[48] https://supabase.com/docs/guides/database/functions
[49] https://supabase.com/docs/reference/javascript/auth-signup
[50] https://learn.microsoft.com/en-us/sql/relational-databases/triggers/logon-triggers?view=sql-server-ver17
[51] https://supabase.com/docs/guides/database/webhooks
[52] https://www.youtube.com/watch?v=efNX5x7O0cY
[53] https://www.mydbops.com/blog/security-invoker-views-in-postgresql-15
[54] https://www.reddit.com/r/Supabase/comments/1aw1jqo/docs_confusing_me_about_security_definer_functions/
[55] https://github.com/orgs/supabase/discussions/19777
[56] https://www.cybertec-postgresql.com/en/abusing-security-definer-functions/
[57] https://www.percona.com/blog/using-security-definer-to-monitor-postgresql-9-6-or-earlier-using-percona-monitoring-and-management/
[58] https://stackoverflow.com/questions/31712286/recording-the-invoker-of-a-postgres-function-that-is-set-to-security-definer
[59] https://www.postgresql.org/docs/current/sql-createprocedure.html
[60] https://dev.to/sruhleder/creating-user-profiles-on-sign-up-in-supabase-5037
[61] https://www.postgresql.org/docs/current/sql-createfunction.html
[62] https://supabase.com/blog/postgrest-11-1-release
[63] https://stackoverflow.com/questions/75453366/rpc-function-tell-me-to-reload-the-schema-cache
[64] https://www.reddit.com/r/Supabase/comments/t0o6sj/dealing_with_timeouts_from_rest_api/
[65] https://postgrest.org/en/v11/references/schema_cache.html
[66] https://www.reddit.com/r/Supabase/comments/z49k9g/error_could_not_find_a_relationship_between_posts/
[67] https://supabase.com/docs/guides/database/debugging-performance
[68] https://docs.postgrest.org/en/latest/references/schema_cache.html
[69] https://github.com/PostgREST/postgrest/issues/3704
[70] https://github.com/orgs/supabase/discussions/6461
[71] https://supabase.com/docs/guides/api/securing-your-api
[72] https://stackoverflow.com/questions/48793114/postgrest-function-response-schema-is-randomly-inconsistent
[73] https://stackoverflow.com/questions/76011758/could-not-find-the-function-in-the-schema-cache-rpc-supabase
[74] https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
[75] https://docs.postgrest.org/en/v13/references/api/functions.html
[76] https://supabase.com/docs/reference/cli/start
[77] https://supabase.com/blog/postgrest-aggregate-functions
[78] https://stackoverflow.com/questions/78464756/trouble-creating-a-trigger-function-in-supabase-for-updating-a-field-in-another
[79] https://github.com/orgs/supabase/discussions/36206
[80] https://www.reddit.com/r/Supabase/comments/wudsn8/create_record_beforeduring_user_creation/
[81] https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
[82] https://github.com/orgs/supabase/discussions/6966
[83] https://auth0.com/docs/manage-users/user-accounts/user-profiles/user-profile-structure
[84] https://designcode.io/react-native-ai-from-sign-up-to-profile-setup-a-complete-supabase-flow/
[85] https://www.reddit.com/r/Supabase/comments/1h7bnra/it_is_not_possible_to_create_a_trigger_on_the/
[86] https://supabase.com/docs/guides/getting-started/tutorials/with-react
[87] https://community.weweb.io/t/supabase-creating-user-profile/2002
[88] https://supabase.com/blog/supabase-functions-updates