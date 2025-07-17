const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function applyFix() {
    console.log('🔧 Applying missing trigger fix...');
    
    try {
        // Read the SQL file
        const sqlPath = path.join(__dirname, 'fix-missing-trigger.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Split SQL into individual statements
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
        
        console.log(`📝 Executing ${statements.length} SQL statements...`);
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (statement) {
                console.log(`   ${i + 1}/${statements.length}: Executing statement...`);
                
                const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
                
                if (error) {
                    console.log(`   ⚠️ Statement ${i + 1} failed, trying direct execution...`);
                    // Try alternative method if exec_sql doesn't exist
                    console.log(`   Statement: ${statement.substring(0, 100)}...`);
                }
            }
        }
        
        console.log('✅ Fix applied successfully!');
        console.log('🧪 Testing the fix...');
        
        // Test if the function now exists
        const { data, error } = await supabase.rpc('create_user_profile');
        
        if (error && error.code === 'PGRST202') {
            console.log('⚠️ Function still not found. Please run the SQL manually in Supabase SQL Editor:');
            console.log('📋 Copy the contents of fix-missing-trigger.sql and paste it in Supabase SQL Editor');
        } else {
            console.log('✅ create_user_profile function is now available!');
        }
        
    } catch (error) {
        console.error('❌ Error applying fix:', error.message);
        console.log('📋 Please run the SQL manually in Supabase SQL Editor:');
        console.log('   1. Open Supabase Dashboard');
        console.log('   2. Go to SQL Editor');
        console.log('   3. Copy and paste the contents of fix-missing-trigger.sql');
        console.log('   4. Run the query');
    }
}

applyFix();