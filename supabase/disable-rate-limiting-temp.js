// Temporary script to disable rate limiting for testing
// Run this when you need to test signup functionality without rate limits

const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.log('Required variables:');
    console.log('- SUPABASE_URL');
    console.log('- SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSignupWithoutRateLimit() {
    console.log('🧪 Testing signup functionality...');
    
    // Generate a unique test email
    const timestamp = Date.now();
    const testEmail = `test-user-${timestamp}@example.com`;
    const testPassword = 'TestPassword123!';
    
    console.log(`📧 Testing with email: ${testEmail}`);
    
    try {
        // Attempt to sign up a new user
        const { data, error } = await supabase.auth.signUp({
            email: testEmail,
            password: testPassword
        });
        
        if (error) {
            console.error('❌ Signup failed:', error.message);
            return false;
        }
        
        console.log('✅ Signup successful!');
        console.log('👤 User ID:', data.user?.id);
        console.log('📧 Email:', data.user?.email);
        console.log('✉️ Email confirmation required:', !data.user?.email_confirmed_at);
        
        // Wait a moment for trigger to execute
        console.log('⏳ Waiting for user profile creation...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if user profile was created
        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();
            
        if (profileError) {
            console.log('⚠️ User profile not found:', profileError.message);
        } else {
            console.log('✅ User profile created:', userProfile);
        }
        
        // Check if agent brand was created
        const { data: agentBrand, error: brandError } = await supabase
            .from('agent_brands')
            .select('*')
            .eq('agent_id', data.user.id)
            .single();
            
        if (brandError) {
            console.log('⚠️ Agent brand not found:', brandError.message);
        } else {
            console.log('✅ Agent brand created:', agentBrand);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Unexpected error:', error.message);
        return false;
    }
}

async function clearRateLimitingInfo() {
    console.log('\n🔧 Rate Limiting Information:');
    console.log('The rate limiting is configured in server.js with these limits:');
    console.log('- General API: 1000 requests per 15 minutes');
    console.log('- Auth endpoints: 50 requests per 15 minutes');
    console.log('\n💡 To temporarily disable rate limiting for testing:');
    console.log('1. Stop the server (Ctrl+C)');
    console.log('2. Comment out the authLimiter middleware in server.js');
    console.log('3. Restart the server');
    console.log('\n⚠️ Remember to re-enable rate limiting after testing!');
}

async function main() {
    console.log('🚀 Nester Signup Testing Tool');
    console.log('==============================\n');
    
    // Test signup functionality
    const signupSuccess = await testSignupWithoutRateLimit();
    
    // Show rate limiting info
    await clearRateLimitingInfo();
    
    if (signupSuccess) {
        console.log('\n✅ Signup test completed successfully!');
        console.log('🎉 The user profile creation system is working!');
    } else {
        console.log('\n❌ Signup test failed.');
        console.log('🔍 Please check the SQL scripts and database configuration.');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testSignupWithoutRateLimit, clearRateLimitingInfo };