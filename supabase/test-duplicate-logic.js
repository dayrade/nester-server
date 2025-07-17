require('dotenv').config();
const { supabase, supabaseAdmin } = require('../config/supabaseClient');
const { signUp } = require('../services/auth/authService');

async function testDuplicateLogic() {
  console.log('🧪 Testing Duplicate Signup Prevention Logic\n');
  
  const testEmail = `testlogic${Date.now()}@gmail.com`;
  console.log('Testing with email:', testEmail);
  
  try {
    // Test 1: Check that no user exists initially
    console.log('\n🧪 Test 1: Verify no user exists initially');
    const { data: initialUsersList, error: initialCheckError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (initialCheckError) {
      console.log('❌ Error checking initial users:', initialCheckError.message);
      return;
    }
    
    const initialUser = initialUsersList.users?.find(user => user.email === testEmail);
    if (initialUser) {
      console.log('❌ Test email already exists, please use a different email');
      return;
    }
    console.log('✅ No existing user found with test email');
    
    // Test 2: Create a user directly in Supabase (bypassing email confirmation)
    console.log('\n🧪 Test 2: Create user directly in Supabase');
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!',
      email_confirm: true // Skip email confirmation
    });
    
    if (createError) {
      console.log('❌ Error creating user:', createError.message);
      return;
    }
    console.log('✅ User created successfully in Supabase');
    console.log('User ID:', createdUser.user.id);
    
    // Test 3: Try to signup with the same email using our authService
    console.log('\n🧪 Test 3: Attempt duplicate signup using authService');
    const { data: signupData, error: signupError } = await signUp(testEmail, 'AnotherPassword123!');
    
    if (signupError && signupError.message === 'USER_ALREADY_EXISTS') {
      console.log('✅ Duplicate signup correctly prevented');
      console.log('Error message:', signupError.details);
    } else if (signupError) {
      console.log('❌ Unexpected error during signup:', signupError.message);
    } else {
      console.log('❌ Duplicate signup was not prevented - this is a problem!');
    }
    
    // Test 4: Cleanup - Delete the test user
    console.log('\n🧪 Test 4: Cleanup - Delete test user');
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);
    
    if (deleteError) {
      console.log('❌ Error deleting test user:', deleteError.message);
      console.log('⚠️  Please manually delete user with email:', testEmail);
    } else {
      console.log('✅ Test user deleted successfully');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
  
  console.log('\n✅ All tests completed');
}

testDuplicateLogic();