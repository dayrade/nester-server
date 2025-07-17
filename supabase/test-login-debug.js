// Load environment variables
require('dotenv').config({ path: '../.env' });

const axios = require('axios');

// Test script to demonstrate login debugging
async function testLoginDebug() {
    const baseURL = 'http://localhost:3001';
    
    console.log('🔍 Testing Login Process with Debug Logging');
    console.log('=' .repeat(50));
    
    try {
        // Test 1: Invalid credentials
        console.log('\n📝 Test 1: Invalid email format');
        try {
            const response = await axios.post(`${baseURL}/api/auth/signin`, {
                email: 'invalid-email',
                password: 'testpassword'
            });
        } catch (error) {
            console.log('✅ Expected error:', error.response?.data?.error);
            console.log('🆔 Request ID:', error.response?.data?.requestId);
        }
        
        // Test 2: Non-existent user
        console.log('\n📝 Test 2: Non-existent user');
        try {
            const response = await axios.post(`${baseURL}/api/auth/signin`, {
                email: 'nonexistent@example.com',
                password: 'testpassword'
            });
        } catch (error) {
            console.log('✅ Expected error:', error.response?.data?.error);
            console.log('🆔 Request ID:', error.response?.data?.requestId);
        }
        
        // Test 3: Valid email format but wrong password
        console.log('\n📝 Test 3: Valid email, wrong password');
        try {
            const response = await axios.post(`${baseURL}/api/auth/signin`, {
                email: 'test@example.com',
                password: 'wrongpassword'
            });
        } catch (error) {
            console.log('✅ Expected error:', error.response?.data?.error);
            console.log('🆔 Request ID:', error.response?.data?.requestId);
        }
        
        // Test 4: Check health endpoint
        console.log('\n📝 Test 4: Health check');
        try {
            const response = await axios.get(`${baseURL}/health`);
            console.log('✅ Server health:', response.data.status);
            console.log('📊 Database status:', response.data.database?.status);
        } catch (error) {
            console.log('❌ Health check failed:', error.message);
        }
        
    } catch (error) {
        console.error('❌ Test script error:', error.message);
    }
    
    console.log('\n🏁 Debug test completed!');
    console.log('📋 Check server logs for detailed debugging information');
}

// Run the test
testLoginDebug();
