const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

async function executeSql(sql) {
    try {
        // First try using the REST API directly
        const response = await fetch(`${supabaseUrl}/rest/v1/sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey
            },
            body: sql
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            return { error: { message: errorText } };
        }
        
        return { data: await response.json() };
    } catch (error) {
        // If direct REST API fails, try RPC method
        try {
            const { data, error: rpcError } = await supabase.rpc('exec_sql', { sql });
            if (rpcError) return { error: rpcError };
            return { data };
        } catch (rpcError) {
            return { error: rpcError };
        }
    }
}

async function applySchema() {
    try {
        console.log('🔧 Applying Complete Schema from supabasesql.txt');
        console.log('==================================================');
        
        // Read the SQL schema file
        const schemaPath = path.join(__dirname, 'supabasesql.txt');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📄 Schema file loaded successfully');
        console.log(`📊 Schema size: ${schemaSql.length} characters`);
        
        // Execute the schema SQL directly using the REST API
        console.log('🚀 Executing schema SQL directly...');
        
        // Split the SQL into individual statements
        const statements = schemaSql.split(';').filter(stmt => stmt.trim().length > 0);
        console.log(`📊 Found ${statements.length} SQL statements to execute`);
        
        let successCount = 0;
        let errorCount = 0;
        
        // Execute each statement individually
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim() + ';';
            const statementPreview = statement.length > 50 ? 
                statement.substring(0, 47) + '...' : 
                statement;
            
            try {
                console.log(`🔄 Executing statement ${i+1}/${statements.length}: ${statementPreview}`);
                
                // Use our custom executeSql function
                const { data, error } = await executeSql(statement);
                
                if (error) {
                    console.warn(`⚠️ Statement ${i+1} warning:`, error.message || error);
                    errorCount++;
                } else {
                    console.log(`✅ Statement ${i+1} executed successfully`);
                    successCount++;
                }
            } catch (stmtError) {
                console.warn(`⚠️ Statement ${i+1} error:`, stmtError.message || stmtError);
                errorCount++;
            }
        }
        
        console.log(`\n📊 Execution summary: ${successCount} succeeded, ${errorCount} warnings/errors`);
        
        // Refresh schema cache
        console.log('🔄 Refreshing schema cache...');
        try {
            await fetch(`${supabaseUrl}/rest/v1/`, {
                headers: {
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'apikey': supabaseServiceKey
                }
            });
            console.log('✅ Schema cache refreshed');
        } catch (cacheError) {
            console.warn('⚠️ Schema cache refresh failed:', cacheError.message);
        }
        
        // Test if listing_status column exists now
        console.log('\n🧪 Testing listing_status column...');
        const { data: testData, error: testError } = await supabase
            .from('properties')
            .select('listing_status')
            .limit(1);
            
        if (testError) {
            console.error('❌ listing_status column test failed:', testError);
            return false;
        }
        
        console.log('✅ listing_status column is accessible');
        return true;
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
        return false;
    }
}

// Run the schema application
applySchema().then(success => {
    if (success) {
        console.log('\n🎉 Schema application completed successfully!');
        console.log('✅ The listing_status column should now be available');
        process.exit(0);
    } else {
        console.log('\n❌ Schema application failed');
        console.log('\n📋 Alternative solution:');
        console.log('1. Open your Supabase Dashboard');
        console.log('2. Go to the SQL Editor');
        console.log('3. Copy the entire content from supabasesql.txt');
        console.log('4. Paste it into the SQL Editor and click Run');
        process.exit(1);
    }
}).catch(error => {
    console.error('❌ Fatal error:', error);
    console.log('\n📋 Alternative solution:');
    console.log('1. Open your Supabase Dashboard');
    console.log('2. Go to the SQL Editor');
    console.log('3. Copy the entire content from supabasesql.txt');
    console.log('4. Paste it into the SQL Editor and click Run');
    process.exit(1);
});