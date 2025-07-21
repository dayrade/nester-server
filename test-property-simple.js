const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function testPropertyCreation() {
    try {
        console.log('🧪 Testing property creation with current schema...');
        
        // First, let's see what columns exist in the properties table
        const { data: tableInfo, error: tableError } = await supabase
            .from('properties')
            .select('*')
            .limit(1);
        
        if (tableError) {
            console.log('❌ Error accessing properties table:', tableError.message);
            return;
        }
        
        console.log('✅ Properties table is accessible');
        
        // Try to create a simple property with only basic fields
        const testProperty = {
            address: '123 Test Street',
            price: 500000,
            bedrooms: 3,
            bathrooms: 2,
            description: 'A simple test property'
        };
        
        // First, we need a valid agent_id. Let's check if any users exist
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id')
            .limit(1);
        
        if (usersError) {
            console.log('❌ Users table error:', usersError.message);
            console.log('ℹ️ This suggests the users table doesn\'t exist or has issues');
            return;
        }
        
        if (!users || users.length === 0) {
            console.log('⚠️ No users found. Creating a test user first...');
            
            // Try to create a test user via auth
            const testEmail = `test-${Date.now()}@example.com`;
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: testEmail,
                password: 'TestPassword123!'
            });
            
            if (authError) {
                console.log('❌ Auth signup error:', authError.message);
                return;
            }
            
            console.log('✅ Test user created:', authData.user.id);
            testProperty.agent_id = authData.user.id;
        } else {
            testProperty.agent_id = users[0].id;
            console.log('✅ Using existing user:', users[0].id);
        }
        
        // Now try to create the property
        const { data: propertyData, error: propertyError } = await supabase
            .from('properties')
            .insert([testProperty])
            .select()
            .single();
        
        if (propertyError) {
            console.log('❌ Property creation error:', propertyError.message);
            console.log('💡 This error tells us what\'s missing from the schema');
        } else {
            console.log('✅ Property created successfully!');
            console.log('📋 Property ID:', propertyData.id);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testPropertyCreation();