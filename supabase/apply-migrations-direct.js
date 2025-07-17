const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '../.env' });

// Extract database connection details from Supabase URL
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databasePassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey || !databasePassword) {
    console.error('❌ Missing required environment variables');
    console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD');
    console.error('Note: You need to add SUPABASE_DB_PASSWORD to your .env file');
    process.exit(1);
}

// Parse Supabase URL to get database connection details
const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!urlMatch) {
    console.error('❌ Invalid Supabase URL format');
    process.exit(1);
}

const projectRef = urlMatch[1];
const connectionConfig = {
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: databasePassword,
    ssl: {
        rejectUnauthorized: false
    }
};

async function applyMigrations() {
    console.log('🔧 Applying Database Migrations (Direct Connection)');
    console.log('==================================================');
    console.log(`📍 Database Host: ${connectionConfig.host}`);
    console.log(`🔑 Database User: ${connectionConfig.user}`);
    console.log('');
    
    const client = new Client(connectionConfig);
    
    try {
        // Connect to database
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Database connection established');
        console.log('');
        
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
                // Execute the entire SQL file
                await client.query(sql);
                console.log(`   ✅ Migration ${file} completed successfully`);
                
            } catch (migrationError) {
                console.log(`   ❌ Migration ${file} failed:`, migrationError.message);
                // Continue with other migrations
            }
            
            console.log('');
        }
        
        // Test the applied migrations
        console.log('🧪 Testing Applied Migrations');
        console.log('==================================================');
        
        // Test 1: Check if users table exists
        try {
            const result = await client.query('SELECT COUNT(*) FROM users LIMIT 1');
            console.log('✅ Users table is accessible');
        } catch (testError) {
            console.log('❌ Users table test failed:', testError.message);
        }
        
        // Test 2: Check if properties table exists
        try {
            const result = await client.query('SELECT COUNT(*) FROM properties LIMIT 1');
            console.log('✅ Properties table is accessible');
        } catch (testError) {
            console.log('❌ Properties table test failed:', testError.message);
        }
        
        // Test 3: Check if check_user_exists function exists
        try {
            const result = await client.query("SELECT check_user_exists('test@example.com')");
            console.log('✅ check_user_exists function is working');
            console.log(`   📊 Test result: ${result.rows[0].check_user_exists}`);
        } catch (testError) {
            console.log('❌ check_user_exists function test failed:', testError.message);
        }
        
        console.log('');
        console.log('🏁 Migration process completed!');
        
    } catch (error) {
        console.error('❌ Migration process failed:', error.message);
        console.error('🔍 Error details:', error);
        process.exit(1);
    } finally {
        // Close database connection
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

// Run the migration
applyMigrations().catch(console.error);
