const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixSchema() {
  try {
    console.log('Checking current schema...');
    
    // Test if we can query the properties table
    const { data: testQuery, error: testError } = await supabase
      .from('properties')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('Cannot access properties table:', testError);
      return;
    }
    
    console.log('Properties table accessible');
    
    // Check if we have any users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    let testUserId;
    if (usersError || !users || users.length === 0) {
      console.log('No users found. Creating test user...');
      
      // Create a test user
      testUserId = '00000000-0000-0000-0000-000000000001';
      
      const { data: newUser, error: createUserError } = await supabase
        .from('users')
        .upsert({
          id: testUserId,
          email: 'test@example.com',
          role: 'agent'
        })
        .select('id')
        .single();
      
      if (createUserError) {
        console.error('Failed to create test user:', createUserError);
        // Try to use existing user or continue with hardcoded ID
        console.log('Continuing with hardcoded user ID...');
      } else {
        console.log('Test user created:', newUser.id);
        testUserId = newUser.id;
      }
    } else {
      testUserId = users[0].id;
      console.log('Using existing user:', testUserId);
    }
    
    // Test property creation with minimal data
    console.log('Testing property creation...');
    
    const testProperty = {
      agent_id: testUserId,
      address: '123 Test Street, Test City, TS 12345'
    };
    
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .insert(testProperty)
      .select('id')
      .single();
    
    if (propertyError) {
      console.error('Property creation failed:', propertyError);
      
      // Check if it's a missing column error
      if (propertyError.message && propertyError.message.includes('column')) {
        console.log('\nMissing column detected. Please run the following SQL in your Supabase SQL Editor:');
        console.log('\n--- Copy and paste this SQL into Supabase SQL Editor ---');
        
        const sqlContent = fs.readFileSync(path.join(__dirname, 'fix-missing-columns.sql'), 'utf8');
        console.log(sqlContent);
        console.log('--- End of SQL ---\n');
        
        console.log('After running the SQL, restart your server and try again.');
      }
    } else {
      console.log('Property creation successful:', property.id);
      
      // Test updating with content generation status
      const { data: updatedProperty, error: updateError } = await supabase
        .from('properties')
        .update({ 
          content_generation_status: 'pending',
          listing_status: 'active'
        })
        .eq('id', property.id)
        .select('*')
        .single();
      
      if (updateError) {
        console.error('Property update failed:', updateError);
        
        if (updateError.message && updateError.message.includes('column')) {
          console.log('\nMissing column detected during update. Please run the following SQL in your Supabase SQL Editor:');
          console.log('\n--- Copy and paste this SQL into Supabase SQL Editor ---');
          
          const sqlContent = fs.readFileSync(path.join(__dirname, 'fix-missing-columns.sql'), 'utf8');
          console.log(sqlContent);
          console.log('--- End of SQL ---\n');
          
          console.log('After running the SQL, restart your server and try again.');
        }
      } else {
        console.log('Property update successful. Schema appears to be working correctly.');
      }
      
      // Clean up test property
      await supabase
        .from('properties')
        .delete()
        .eq('id', property.id);
      
      console.log('Test property cleaned up');
    }
    
    console.log('Schema check completed!');
    
  } catch (error) {
    console.error('Schema check failed:', error);
  }
}

fixSchema();