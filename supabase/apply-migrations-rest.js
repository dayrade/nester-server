const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function executeSQL(sql) {
    try {
        // Use the PostgREST API to execute SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ query: sql })
        });

        if (!response.ok) {
            // Try alternative approach using the SQL editor endpoint
            const altResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'apikey': supabaseServiceKey
                },
                body: JSON.stringify({ query: sql })
            });

            if (!altResponse.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            return await altResponse.json();
        }
        
        return await response.json();
    } catch (error) {
        throw new Error(`SQL execution failed: ${error.message}`);
    }
}

async function applyMigrations() {
    console.log('🔧 Applying Database Migrations (REST API)');
    console.log('==================================================');
    console.log(`📍 Supabase URL: ${supabaseUrl}`);
    console.log(`🔑 Using Service Role Key: ${supabaseServiceKey.substring(0, 20)}...`);
    console.log('');
    
    try {
        const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Apply in order
        
        console.log(`📁 Found ${migrationFiles.length} migration files:`);
        migrationFiles.forEach(file => console.log(`   - ${file}`));
        console.log('');
        
        for (const file of migrationFiles) {
            console.log(`🔄 Applying migration: ${file}`);
            
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');
            
            try {
                // Split into individual statements and execute them
                const statements = sql
                    .split(';')
                    .map(stmt => stmt.trim())
                    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
                
                console.log(`   📝 Executing ${statements.length} SQL statements...`);
                
                for (let i = 0; i < statements.length; i++) {
                    const statement = statements[i];
                    if (statement.trim()) {
                        try {
                            await executeSQL(statement);
                            console.log(`   ✅ Statement ${i + 1}: Success`);
                        } catch (stmtError) {
                            // Some statements might fail if they already exist, which is okay
                            if (stmtError.message.includes('already exists') || 
                                stmtError.message.includes('duplicate')) {
                                console.log(`   ⚠️ Statement ${i + 1}: Already exists (skipping)`);
                            } else {
                                console.log(`   ❌ Statement ${i + 1}: ${stmtError.message}`);
                            }
                        }
                    }
                }
                
                console.log(`   ✅ Migration ${file} completed`);
                
            } catch (migrationError) {
                console.log(`   ❌ Migration ${file} failed:`, migrationError.message);
            }
            
            console.log('');
        }
        
        // Test the applied migrations using Supabase client
        console.log('🧪 Testing Applied Migrations');
        console.log('==================================================');
        
        // Test 1: Check if users table exists
        try {
            const { data, error } = await supabase.from('users').select('count').limit(1);
            if (error) {
                console.log('❌ Users table test failed:', error.message);
            } else {
                console.log('✅ Users table is accessible');
            }
        } catch (testError) {
            console.log('❌ Users table test exception:', testError.message);
        }
        
        // Test 2: Check if properties table exists
        try {
            const { data, error } = await supabase.from('properties').select('count').limit(1);
            if (error) {
                console.log('❌ Properties table test failed:', error.message);
            } else {
                console.log('✅ Properties table is accessible');
            }
        } catch (testError) {
            console.log('❌ Properties table test exception:', testError.message);
        }
        
        // Test 3: Check if agent_brands table exists
        try {
            const { data, error } = await supabase.from('agent_brands').select('count').limit(1);
            if (error) {
                console.log('❌ Agent brands table test failed:', error.message);
            } else {
                console.log('✅ Agent brands table is accessible');
            }
        } catch (testError) {
            console.log('❌ Agent brands table test exception:', testError.message);
        }
        
        // Test 4: Check if check_user_exists function exists
        try {
            const { data, error } = await supabase.rpc('check_user_exists', { user_email: 'test@example.com' });
            if (error) {
                console.log('❌ check_user_exists function test failed:', error.message);
            } else {
                console.log('✅ check_user_exists function is working');
                console.log(`   📊 Test result: ${data}`);
            }
        } catch (testError) {
            console.log('❌ check_user_exists function test exception:', testError.message);
        }
        
        console.log('');
        console.log('🏁 Migration process completed!');
        console.log('📋 Note: Some errors are expected if tables already exist.');
        console.log('📋 If tables still don\'t exist, you may need to apply migrations manually in the Supabase dashboard.');
        
    } catch (error) {
        console.error('❌ Migration process failed:', error.message);
        console.error('🔍 Error stack:', error.stack);
        process.exit(1);
    }
}

// Run the migration
applyMigrations().catch(console.error);
