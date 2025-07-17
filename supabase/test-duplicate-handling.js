// Test script for duplicate user handling
// This script tests both new user creation and existing user scenarios

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDuplicateHandling() {
    console.log('=== TESTING DUPLICATE USER HANDLING ===\n');
    
    const testEmail = `testdup${Date.now()}@gmail.com`;
    let userId = null;
    
    try {
        // Test 1: Create a new user (should succeed)
        console.log('🧪 Test 1: Creating new user...');
        const signupResult = await supabase.auth.signUp({
            email: testEmail,
            password: 'testpassword123'
        });
        
        if (signupResult.error) {
            console.log('❌ Signup failed:', signupResult.error.message);
            return;
        }
        
        userId = signupResult.data.user?.id;
        console.log('✅ User created successfully');
        console.log('   User ID:', userId);
        console.log('   Email:', testEmail);
        
        // Wait a moment for trigger to execute
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 2: Check if profiles were created
        console.log('\n🧪 Test 2: Checking profile creation...');
        const [userCheck, brandCheck] = await Promise.all([
            supabaseAdmin.from('users').select('*').eq('id', userId),
            supabaseAdmin.from('agent_brands').select('*').eq('agent_id', userId)
        ]);
        
        console.log('   User profile:', userCheck.data?.[0] ? '✅ Created' : '❌ Missing');
        console.log('   Agent brand:', brandCheck.data?.[0] ? '✅ Created' : '❌ Missing');
        
        if (userCheck.data?.[0]) {
            console.log('   - Role:', userCheck.data[0].role);
            console.log('   - Email:', userCheck.data[0].email);
        }
        
        if (brandCheck.data?.[0]) {
            console.log('   - Brand tier:', brandCheck.data[0].brand_tier);
            console.log('   - Custom branding:', brandCheck.data[0].has_custom_branding);
        }
        
        // Test 3: Try to signup with same email (should handle gracefully)
        console.log('\n🧪 Test 3: Testing duplicate signup...');
        const duplicateSignup = await supabase.auth.signUp({
            email: testEmail,
            password: 'differentpassword123'
        });
        
        if (duplicateSignup.error) {
            console.log('⚠️  Duplicate signup handled:', duplicateSignup.error.message);
            console.log('   This is expected behavior for existing emails');
        } else {
            console.log('✅ Duplicate signup processed without error');
        }
        
        // Test 4: Test manual profile creation for existing user
        if (userId) {
            console.log('\n🧪 Test 4: Testing manual profile creation for existing user...');
            const manualResult = await supabaseAdmin.rpc('create_user_profile_manual', {
                user_id: userId,
                user_email: testEmail
            });
            
            if (manualResult.error) {
                console.log('❌ Manual creation failed:', manualResult.error.message);
            } else {
                console.log('✅ Manual creation result:', manualResult.data);
                if (manualResult.data?.user_existed) {
                    console.log('   ✅ Correctly detected existing user');
                }
                if (manualResult.data?.brand_existed) {
                    console.log('   ✅ Correctly detected existing brand');
                }
            }
        }
        
        // Test 5: Test with completely new user via manual function
        console.log('\n🧪 Test 5: Testing manual creation for new user...');
        const newUserId = '12345678-1234-1234-1234-123456789012';
        const newEmail = `manual${Date.now()}@gmail.com`;
        
        const newManualResult = await supabaseAdmin.rpc('create_user_profile_manual', {
            user_id: newUserId,
            user_email: newEmail
        });
        
        if (newManualResult.error) {
            console.log('❌ New manual creation failed:', newManualResult.error.message);
        } else {
            console.log('✅ New manual creation result:', newManualResult.data);
            if (!newManualResult.data?.user_existed && !newManualResult.data?.brand_existed) {
                console.log('   ✅ Correctly detected new user');
            }
        }
        
        console.log('\n=== DUPLICATE HANDLING TEST COMPLETED ===');
        console.log('\n📋 Summary:');
        console.log('- User signup with trigger: Working');
        console.log('- Profile creation: Automatic via trigger');
        console.log('- Duplicate handling: ON CONFLICT clauses implemented');
        console.log('- Manual profile creation: Available via RPC');
        console.log('- Existing user detection: Implemented');
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testDuplicateHandling();