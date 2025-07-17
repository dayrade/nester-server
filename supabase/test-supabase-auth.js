const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '../.env' });

const baseURL = 'http://localhost:3001';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Create Supabase client for testing
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseAuthentication() {
    console.log('🔐 Testing Supabase Authentication');
    console.log('==================================================');
    console.log(`📍 Supabase URL: ${supabaseUrl}`);
    console.log(`🔑 Using API Key: ${supabaseKey.substring(0, 20)}...`);
    console.log('');
    
    try {
        // Test 1: Check Supabase connection and users table
        console.log('📝 Test 1: Database Connection Test');
        try {
            const { data, error } = await supabase.from('users').select('count').limit(1);
            if (error) {
                console.log('❌ Users table query failed:', error.message);
                console.log('🔍 Error details:', error);
            } else {
                console.log('✅ Users table accessible');
                console.log('📊 Query result:', data);
            }
        } catch (connectionError) {
            console.log('❌ Database connection exception:', connectionError.message);
        }
        
        // Test 2: Check auth.users table directly
        console.log('\n📝 Test 2: Auth Users Table Test');
        try {
            const { data: authUsers, error: authError } = await supabase
                .from('auth.users')
                .select('id, email')
                .limit(5);
                
            if (authError) {
                console.log('❌ Auth users query failed:', authError.message);
            } else {
                console.log('✅ Auth users table accessible');
                console.log('👥 Found users:', authUsers?.length || 0);
                if (authUsers && authUsers.length > 0) {
                    console.log('📧 Sample emails:', authUsers.map(u => u.email));
                }
            }
        } catch (authError) {
            console.log('❌ Auth users exception:', authError.message);
        }
        
        // Test 3: Test user signup with a valid email format
        console.log('\n📝 Test 3: User Signup Test');
        const testEmail = `testuser${Date.now()}@gmail.com`; // Use gmail.com for better validation
        const testPassword = 'TestPassword123!';
        
        try {
            const { data: signupData, error: signupError } = await supabase.auth.signUp({
                email: testEmail,
                password: testPassword,
                options: {
                    emailRedirectTo: 'http://localhost:3000/auth/callback'
                }
            });
            
            if (signupError) {
                console.log('❌ Signup failed:', signupError.message);
                console.log('🔍 Error code:', signupError.code);
            } else {
                console.log('✅ Signup successful');
                console.log('👤 User ID:', signupData.user?.id);
                console.log('📧 Email:', signupData.user?.email);
                console.log('✉️ Email confirmed:', signupData.user?.email_confirmed_at ? 'Yes' : 'No');
                console.log('🔐 Session created:', !!signupData.session);
                
                // Test 4: Test backend signin API if we have a session
                if (signupData.session) {
                    console.log('\n📝 Test 4: Backend Signin API Test');
                    const token = signupData.session.access_token;
                    
                    try {
                        const response = await axios.post(`${baseURL}/api/auth/signin`, {
                            email: testEmail,
                            password: testPassword
                        }, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        console.log('✅ Backend signin successful');
                        console.log('📋 Response:', response.data);
                        
                    } catch (signinError) {
                        console.log('❌ Backend signin failed:', signinError.response?.data?.error || signinError.message);
                        console.log('🆔 Request ID:', signinError.response?.data?.requestId);
                        console.log('📊 Status:', signinError.response?.status);
                    }
                } else {
                    console.log('⚠️ No session created - email confirmation may be required');
                }
            }
        } catch (signupException) {
            console.log('❌ Signup exception:', signupException.message);
        }
        
        // Test 5: Test authentication state
        console.log('\n📝 Test 5: Authentication State Test');
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
                console.log('❌ Session check failed:', sessionError.message);
            } else if (session) {
                console.log('✅ Active session found');
                console.log('👤 User ID:', session.user?.id);
                console.log('📧 Email:', session.user?.email);
                console.log('⏰ Expires at:', new Date(session.expires_at * 1000).toISOString());
            } else {
                console.log('ℹ️ No active session');
            }
        } catch (sessionException) {
            console.log('❌ Session check exception:', sessionException.message);
        }
        
        // Test 6: Server health check
        console.log('\n📝 Test 6: Server Health Check');
        try {
            const healthResponse = await axios.get(`${baseURL}/health`);
            console.log('✅ Server health:', healthResponse.data.status);
            console.log('📊 Database status:', healthResponse.data.database);
        } catch (healthError) {
            console.log('❌ Health check failed:', healthError.message);
        }
        
        // Test 7: Test backend auth endpoints without token (should fail gracefully)
        console.log('\n📝 Test 7: Backend Auth Validation Test');
        try {
            const response = await axios.post(`${baseURL}/api/auth/signin`, {
                email: 'test@example.com',
                password: 'password123'
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } catch (authError) {
            console.log('✅ Auth validation working:', authError.response?.data?.error);
            console.log('🆔 Request ID:', authError.response?.data?.requestId);
            console.log('📊 Status Code:', authError.response?.status);
        }
        
    } catch (error) {
        console.log('❌ Test suite failed:', error.message);
        console.log('🔍 Error stack:', error.stack);
    }
    
    console.log('\n🏁 Supabase authentication test completed!');
    console.log('📋 Check server logs for detailed debugging information');
}

// Run the test
testSupabaseAuthentication().catch(console.error);
