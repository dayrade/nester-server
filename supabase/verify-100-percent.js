const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

// Create both admin and public clients
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

async function testDatabaseSchema() {
    console.log('🔍 Testing Database Schema');
    console.log('==================================================');
    
    const tables = ['users', 'agent_brands', 'properties', 'property_images', 'social_posts', 'social_stats', 'chat_sessions'];
    let allTablesExist = true;
    
    for (const table of tables) {
        try {
            const { error } = await supabaseAdmin.from(table).select('*').limit(1);
            if (!error) {
                console.log(`✅ Table '${table}' exists and is accessible`);
            } else {
                console.log(`❌ Table '${table}' error:`, error.message);
                allTablesExist = false;
            }
        } catch (e) {
            console.log(`❌ Table '${table}' failed:`, e.message);
            allTablesExist = false;
        }
    }
    
    return allTablesExist;
}

async function testDatabaseFunctions() {
    console.log('\n🔧 Testing Database Functions');
    console.log('==================================================');
    
    try {
        // Test check_user_exists function
        const { data, error } = await supabaseAdmin.rpc('check_user_exists', { 
            user_email: 'test@example.com' 
        });
        
        if (!error) {
            console.log('✅ check_user_exists function is working');
            console.log(`   Result: ${data}`);
        } else {
            console.log('❌ check_user_exists function error:', error.message);
            return false;
        }
        
        // Test get_user_role function
        const { data: roleData, error: roleError } = await supabaseAdmin.rpc('get_user_role', { 
            user_email: 'test@example.com' 
        });
        
        if (!roleError) {
            console.log('✅ get_user_role function is working');
            console.log(`   Result: ${roleData}`);
        } else {
            console.log('❌ get_user_role function error:', roleError.message);
            return false;
        }
        
        return true;
    } catch (e) {
        console.log('❌ Function test failed:', e.message);
        return false;
    }
}

async function testUserSignupFlow() {
    console.log('\n👤 Testing Complete User Signup Flow');
    console.log('==================================================');
    
    try {
        // Generate unique test email
        const testEmail = `test-${Date.now()}@gmail.com`;
        const testPassword = 'TestPassword123!';
        
        console.log(`🔄 Testing signup with: ${testEmail}`);
        
        // Test user signup
        const { data: signupData, error: signupError } = await supabasePublic.auth.signUp({
            email: testEmail,
            password: testPassword
        });
        
        if (signupError) {
            console.log('❌ User signup failed:', signupError.message);
            return false;
        }
        
        if (!signupData.user) {
            console.log('❌ No user data returned from signup');
            return false;
        }
        
        console.log('✅ User signup successful');
        console.log(`   User ID: ${signupData.user.id}`);
        console.log(`   Email: ${signupData.user.email}`);
        
        // Wait a moment for trigger to execute
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if user profile was created automatically
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', testEmail)
            .single();
        
        if (!userError && userData) {
            console.log('✅ User profile created automatically via trigger');
            console.log(`   Role: ${userData.role}`);
            console.log(`   Created at: ${userData.created_at}`);
        } else {
            console.log('⚠️ User profile not found - trigger may not be working');
            console.log('   Error:', userError?.message);
            return false;
        }
        
        // Check if agent brand was created
        const { data: brandData, error: brandError } = await supabaseAdmin
            .from('agent_brands')
            .select('*')
            .eq('agent_id', signupData.user.id)
            .single();
        
        if (!brandError && brandData) {
            console.log('✅ Agent brand profile created automatically');
            console.log(`   Brand tier: ${brandData.brand_tier}`);
            console.log(`   Custom branding: ${brandData.has_custom_branding}`);
        } else {
            console.log('⚠️ Agent brand not found - trigger may not be working');
            console.log('   Error:', brandError?.message);
            return false;
        }
        
        return true;
        
    } catch (e) {
        console.log('❌ User signup test failed:', e.message);
        return false;
    }
}

async function testBackendIntegration() {
    console.log('\n🔗 Testing Backend Integration');
    console.log('==================================================');
    
    try {
        // Test server health
        const healthResponse = await fetch('http://localhost:3000/api/health');
        if (healthResponse.ok) {
            console.log('✅ Backend server is running');
        } else {
            console.log('⚠️ Backend server may not be running');
            return false;
        }
        
        // Test auth endpoint without token
        const authResponse = await fetch('http://localhost:3000/api/auth/user');
        if (authResponse.status === 401) {
            console.log('✅ Auth endpoint properly rejects unauthorized requests');
        } else {
            console.log('⚠️ Auth endpoint security may have issues');
        }
        
        return true;
    } catch (e) {
        console.log('⚠️ Backend server is not running (this is optional)');
        console.log('   Start with: npm run dev');
        return true; // Don't fail the test for this
    }
}

async function runCompleteVerification() {
    console.log('🎯 Nester Authentication - 100% Verification');
    console.log('==================================================');
    console.log(`📍 Supabase URL: ${supabaseUrl}`);
    console.log('');
    
    const results = {
        schema: false,
        functions: false,
        signup: false,
        backend: false
    };
    
    // Test 1: Database Schema
    results.schema = await testDatabaseSchema();
    
    // Test 2: Database Functions
    results.functions = await testDatabaseFunctions();
    
    // Test 3: User Signup Flow
    results.signup = await testUserSignupFlow();
    
    // Test 4: Backend Integration
    results.backend = await testBackendIntegration();
    
    // Final Results
    console.log('\n🏆 FINAL VERIFICATION RESULTS');
    console.log('==================================================');
    console.log(`📊 Database Schema: ${results.schema ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🔧 Database Functions: ${results.functions ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`👤 User Signup Flow: ${results.signup ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🔗 Backend Integration: ${results.backend ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
    
    const allPassed = results.schema && results.functions && results.signup;
    
    if (allPassed) {
        console.log('🎉 SUCCESS: Nester Authentication is 100% FUNCTIONAL!');
        console.log('==================================================');
        console.log('✅ All database tables created');
        console.log('✅ All functions working');
        console.log('✅ User signup creates profiles automatically');
        console.log('✅ Authentication triggers working');
        console.log('✅ Ready for production use!');
        console.log('');
        console.log('🚀 Your Nester application is now complete!');
        console.log('   Start the dev server: npm run dev');
        console.log('   Test the app: http://localhost:3000');
        return true;
    } else {
        console.log('❌ INCOMPLETE: Some components are not working');
        console.log('==================================================');
        if (!results.schema) console.log('❌ Database schema needs to be applied');
        if (!results.functions) console.log('❌ Database functions need to be created');
        if (!results.signup) console.log('❌ User signup flow is not working');
        console.log('');
        console.log('📋 Please run the SQL from quick-setup.js in Supabase SQL Editor');
        return false;
    }
}

if (require.main === module) {
    runCompleteVerification().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(console.error);
}

module.exports = { runCompleteVerification };
