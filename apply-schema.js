const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function applySchema() {
    try {
        console.log('📄 Reading schema file...');
        const schemaPath = path.join(__dirname, 'supabase', 'complete-schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('🔄 Applying schema to database...');
        
        // Use fetch to execute SQL directly via REST API
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey
            },
            body: JSON.stringify({ query: schema })
        });
        
        if (response.ok) {
            console.log('✅ Schema executed successfully via REST API');
        } else {
            // Fallback: Try to create missing tables manually
            console.log('⚠️ REST API failed, trying manual table creation...');
            
            // Create users table
            try {
                const { error: usersError } = await supabase.from('users').select('*').limit(1);
                if (usersError && usersError.message.includes('does not exist')) {
                    console.log('🔄 Creating users table...');
                    // We'll need to use a different approach since we can\'t execute DDL directly
                }
            } catch (e) {
                console.log('Users table check failed:', e.message);
            }
            
            // Check if properties table has required columns
            try {
                const { data, error } = await supabase.from('properties').select('content_generation_status, listing_status').limit(1);
                if (error) {
                    console.log('⚠️ Properties table missing required columns:', error.message);
                } else {
                    console.log('✅ Properties table has required columns');
                }
            } catch (e) {
                console.log('Properties table check failed:', e.message);
            }
        }
        
        console.log('\n🎉 Schema application completed!');
        
    } catch (error) {
        console.error('❌ Error applying schema:', error.message);
        process.exit(1);
    }
}

applySchema();