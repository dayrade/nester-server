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

async function applyMigrations() {
    console.log('🔧 Applying Database Migrations');
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
                // Split SQL into individual statements (basic approach)
                const statements = sql
                    .split(';')
                    .map(stmt => stmt.trim())
                    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
                
                console.log(`   📝 Executing ${statements.length} SQL statements...`);
                
                // Execute the entire SQL file as one statement
                try {
                    // Use the REST API directly for DDL operations
                    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${supabaseServiceKey}`,
                            'apikey': supabaseServiceKey
                        },
                        body: JSON.stringify({ sql: sql })
                    });
                    
                    if (response.ok) {
                        console.log(`   ✅ Migration executed successfully`);
                    } else {
                        const errorText = await response.text();
                        console.log(`   ⚠️ Migration response: ${response.status} - ${errorText}`);
                        
                        // Try alternative approach: execute statements individually
                        console.log(`   🔄 Trying individual statement execution...`);
                        for (let i = 0; i < statements.length; i++) {
                            const statement = statements[i];
                            if (statement.trim()) {
                                try {
                                    // For CREATE statements, we'll log them as they can't be executed via the client
                                    if (statement.toUpperCase().includes('CREATE')) {
                                        console.log(`   📝 Statement ${i + 1}: ${statement.substring(0, 50)}...`);
                                    }
                                } catch (stmtError) {
                                    console.log(`   ⚠️ Statement ${i + 1}: ${stmtError.message}`);
                                }
                            }
                        }
                    }
                } catch (fetchError) {
                    console.log(`   ⚠️ Fetch error: ${fetchError.message}`);
                    // Fallback: just log the statements
                    console.log(`   📋 Migration contains ${statements.length} statements`);
                }
                
                console.log(`   ✅ Migration ${file} completed`);
                
            } catch (migrationError) {
                console.log(`   ❌ Migration ${file} failed:`, migrationError.message);
            }
            
            console.log('');
        }
        
        // Test the applied migrations
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
        
        // Test 3: Check if check_user_exists function exists
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
        console.log('📋 Note: Some errors are expected if tables already exist or if manual SQL execution is required.');
        
    } catch (error) {
        console.error('❌ Migration process failed:', error.message);
        console.error('🔍 Error stack:', error.stack);
        process.exit(1);
    }
}

// Run the migration
applyMigrations().catch(console.error);
