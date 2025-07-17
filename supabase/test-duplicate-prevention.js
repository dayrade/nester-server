// Load environment variables
require('dotenv').config();

const { supabase, supabaseAdmin } = require('../config/supabaseClient');
const fetch = require('node-fetch');

async function testDuplicatePrevention() {
    console.log('=== TESTING DUPLICATE SIGNUP PREVENTION ===\n');
    
    const testEmail = `testdup${Date.now()}@gmail.com`;
    const testPassword = 'TestPassword123!';
    const backendUrl = 'http://localhost:3001';
    
    console.log(`Testing with email: ${testEmail}`);
    console.log(`Backend URL: ${backendUrl}\n`);
    
    try {
        // Test 1: First signup attempt (should succeed)
        console.log('🧪 Test 1: First signup attempt (should succeed)');
        const firstSignupResponse = await fetch(`${backendUrl}/api/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword
            })
        });
        
        const firstSignupResult = await firstSignupResponse.json();
        
        if (firstSignupResponse.ok) {
            console.log('✅ First signup successful');
            console.log('Response:', JSON.stringify(firstSignupResult, null, 2));
        } else {
            console.log('❌ First signup failed unexpectedly');
            console.log('Status:', firstSignupResponse.status);
            console.log('Response:', JSON.stringify(firstSignupResult, null, 2));
            return;
        }
        
        // Wait a moment for the user to be fully created
        console.log('\n⏳ Waiting 2 seconds for user creation to complete...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 2: Verify user exists in Supabase
        console.log('\n🧪 Test 2: Verify user exists in Supabase');
        const { data: usersList, error: checkError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (checkError) {
            console.log('❌ Error checking user existence:', checkError.message);
        } else {
            const existingUser = usersList.users?.find(user => user.email === testEmail);
            if (existingUser) {
                console.log('✅ User found in Supabase');
                console.log('User ID:', existingUser.id);
                console.log('Email confirmed:', !!existingUser.email_confirmed_at);
            } else {
                console.log('❌ User not found in Supabase');
            }
        }
        
        // Test 3: Second signup attempt with same email (should fail)
        console.log('\n🧪 Test 3: Second signup attempt with same email (should fail)');
        const secondSignupResponse = await fetch(`${backendUrl}/api/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword
            })
        });
        
        const secondSignupResult = await secondSignupResponse.json();
        
        if (secondSignupResponse.status === 409) {
            console.log('✅ Duplicate signup correctly prevented');
            console.log('Status:', secondSignupResponse.status);
            console.log('Response:', JSON.stringify(secondSignupResult, null, 2));
        } else {
            console.log('❌ Duplicate signup was not prevented');
            console.log('Status:', secondSignupResponse.status);
            console.log('Response:', JSON.stringify(secondSignupResult, null, 2));
        }
        
        // Test 4: Third signup attempt with different password (should still fail)
        console.log('\n🧪 Test 4: Third signup attempt with different password (should still fail)');
        const thirdSignupResponse = await fetch(`${backendUrl}/api/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: testEmail,
                password: 'DifferentPassword456!'
            })
        });
        
        const thirdSignupResult = await thirdSignupResponse.json();
        
        if (thirdSignupResponse.status === 409) {
            console.log('✅ Duplicate signup with different password correctly prevented');
            console.log('Status:', thirdSignupResponse.status);
            console.log('Response:', JSON.stringify(thirdSignupResult, null, 2));
        } else {
            console.log('❌ Duplicate signup with different password was not prevented');
            console.log('Status:', thirdSignupResponse.status);
            console.log('Response:', JSON.stringify(thirdSignupResult, null, 2));
        }
        
        // Test 5: Cleanup - Delete the test user
        console.log('\n🧪 Test 5: Cleanup - Delete test user');
        const { data: usersListForCleanup, error: cleanupCheckError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (!cleanupCheckError) {
            const userToDelete = usersListForCleanup.users?.find(user => user.email === testEmail);
            if (userToDelete) {
                const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);
                
                if (deleteError) {
                    console.log('❌ Error deleting test user:', deleteError.message);
                    console.log('⚠️  Please manually delete user with email:', testEmail);
                } else {
                    console.log('✅ Test user deleted successfully');
                }
            }
        }
        
        console.log('\n=== DUPLICATE PREVENTION TEST COMPLETED ===');
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testDuplicatePrevention()
        .then(() => {
            console.log('\n✅ All tests completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test suite failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testDuplicatePrevention };