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

// Required tables and their expected columns
const REQUIRED_SCHEMA = {
    users: ['id', 'email', 'role', 'created_at', 'updated_at'],
    agent_brands: ['id', 'agent_id', 'has_custom_branding', 'brand_tier'],
    properties: ['id', 'agent_id', 'address', 'price', 'property_type'],
    property_images: ['id', 'property_id', 'storage_path'],
    social_posts: ['id', 'property_id', 'platform', 'content', 'status'],
    social_stats: ['id', 'social_post_id', 'views', 'likes'],
    chat_sessions: ['id', 'user_id', 'title', 'messages']
};

// Required functions
const REQUIRED_FUNCTIONS = [
    'check_user_exists',
    'get_user_role',
    'create_user_profile'
];

async function checkTableExists(tableName) {
    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
        
        return !error;
    } catch (e) {
        return false;
    }
}

async function checkFunctionExists(functionName) {
    try {
        // Try to call the function with a test parameter
        if (functionName === 'check_user_exists') {
            const { error } = await supabase.rpc(functionName, { user_email: 'test@example.com' });
            return !error;
        } else if (functionName === 'get_user_role') {
            const { error } = await supabase.rpc(functionName, { user_email: 'test@example.com' });
            return !error;
        }
        return false;
    } catch (e) {
        return false;
    }
}

async function validateSchema() {
    console.log('🔍 Validating Database Schema');
    console.log('==================================================');
    
    const results = {
        tables: {},
        functions: {},
        isComplete: true
    };
    
    // Check tables
    for (const tableName of Object.keys(REQUIRED_SCHEMA)) {
        const exists = await checkTableExists(tableName);
        results.tables[tableName] = exists;
        if (!exists) {
            results.isComplete = false;
            console.log(`❌ Table '${tableName}' is missing`);
        } else {
            console.log(`✅ Table '${tableName}' exists`);
        }
    }
    
    // Check functions
    for (const functionName of REQUIRED_FUNCTIONS) {
        const exists = await checkFunctionExists(functionName);
        results.functions[functionName] = exists;
        if (!exists) {
            results.isComplete = false;
            console.log(`❌ Function '${functionName}' is missing`);
        } else {
            console.log(`✅ Function '${functionName}' exists`);
        }
    }
    
    console.log('');
    return results;
}

async function createMissingTables() {
    console.log('🔧 Creating Missing Tables via Supabase Client');
    console.log('==================================================');
    
    // Since we can't execute DDL directly, we'll create a comprehensive SQL script
    // that the user can copy-paste into Supabase SQL editor
    
    const migrationSQL = `
-- Nester Database Schema Setup
-- Copy and paste this entire script into Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('agent', 'admin', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE property_type AS ENUM ('house', 'condo', 'townhouse', 'apartment', 'land', 'commercial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('active', 'pending', 'sold', 'withdrawn', 'processing', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE social_platform AS ENUM ('instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'published', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE brand_tier AS ENUM ('nester_default', 'nester_plus', 'white_label');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role user_role DEFAULT 'agent',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent brands table
CREATE TABLE IF NOT EXISTS agent_brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    has_custom_branding BOOLEAN DEFAULT FALSE,
    brand_tier brand_tier DEFAULT 'nester_default',
    logo_storage_path TEXT,
    company_name TEXT,
    primary_color TEXT DEFAULT '#2563eb',
    secondary_color TEXT DEFAULT '#64748b',
    font_family TEXT DEFAULT 'Inter',
    nester_logo_path TEXT DEFAULT '/assets/nester-logo.svg',
    nester_primary_color TEXT DEFAULT '#2563eb',
    nester_secondary_color TEXT DEFAULT '#64748b',
    nester_font_family TEXT DEFAULT 'Inter',
    persona_tone TEXT DEFAULT 'Professional & Authoritative',
    persona_style TEXT DEFAULT 'Concise & Factual',
    persona_key_phrases TEXT[] DEFAULT ARRAY['Discover your dream home', 'Premium real estate marketing'],
    persona_phrases_to_avoid TEXT[] DEFAULT ARRAY['cheap', 'deal', 'bargain'],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id)
);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    price INTEGER,
    bedrooms INTEGER,
    bathrooms DECIMAL(3,1),
    square_feet INTEGER,
    property_type property_type DEFAULT 'house',
    description TEXT,
    features TEXT[],
    neighborhood_info TEXT,
    year_built INTEGER,
    lot_size INTEGER,
    garage_spaces INTEGER,
    heating_type TEXT,
    cooling_type TEXT,
    flooring_types TEXT[],
    listing_url TEXT,
    listing_platform TEXT,
    listing_status listing_status DEFAULT 'active',
    listing_agent_name TEXT,
    listing_agent_phone TEXT,
    listing_agent_email TEXT,
    scraping_job_id TEXT,
    scraping_completed_at TIMESTAMPTZ,
    scraping_error TEXT,
    content_generation_job_id TEXT,
    content_generation_status TEXT,
    content_generation_started_at TIMESTAMPTZ,
    content_generation_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property images table
CREATE TABLE IF NOT EXISTS property_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    original_url TEXT,
    alt_text TEXT,
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social media posts table
CREATE TABLE IF NOT EXISTS social_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    platform social_platform NOT NULL,
    content TEXT NOT NULL,
    hashtags TEXT[],
    archetype TEXT,
    image_paths TEXT[],
    video_path TEXT,
    status post_status DEFAULT 'draft',
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    platform_post_id TEXT,
    platform_url TEXT,
    generation_prompt TEXT,
    generation_model TEXT,
    generation_job_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social media statistics table
CREATE TABLE IF NOT EXISTS social_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    social_post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    platform_metrics JSONB,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    title TEXT,
    messages JSONB NOT NULL DEFAULT '[]',
    session_type TEXT DEFAULT 'general',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_properties_agent_id ON properties(agent_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(listing_status);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);
CREATE INDEX IF NOT EXISTS idx_property_images_primary ON property_images(property_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_social_posts_property_id ON social_posts(property_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_stats_post_id ON social_stats(social_post_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_brands_agent_id ON agent_brands(agent_id);

-- Functions
CREATE OR REPLACE FUNCTION check_user_exists(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users WHERE email = user_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
    user_role_result TEXT;
BEGIN
    SELECT role INTO user_role_result FROM users WHERE email = user_email;
    RETURN COALESCE(user_role_result, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email, role) VALUES (NEW.id, NEW.email, 'agent');
    INSERT INTO agent_brands (agent_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- Success message
SELECT 'Database schema setup completed successfully!' as message;
`;
    
    // Write the SQL to a file for easy access
    const sqlFilePath = path.join(__dirname, 'complete-schema.sql');
    fs.writeFileSync(sqlFilePath, migrationSQL);
    
    console.log('📝 Complete SQL schema written to: complete-schema.sql');
    console.log('📋 Copy the contents of this file and paste into Supabase SQL Editor');
    console.log('');
    
    return sqlFilePath;
}

async function setupDatabase() {
    console.log('🚀 Nester Database Setup');
    console.log('==================================================');
    console.log(`📍 Supabase URL: ${supabaseUrl}`);
    console.log('');
    
    try {
        // Step 1: Validate current schema
        const validation = await validateSchema();
        
        if (validation.isComplete) {
            console.log('🎉 Database schema is already complete!');
            console.log('✅ All required tables and functions exist.');
            return true;
        }
        
        // Step 2: Create SQL file for manual execution
        const sqlFilePath = await createMissingTables();
        
        console.log('⚠️ Manual Setup Required');
        console.log('==================================================');
        console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Create a new query');
        console.log(`4. Copy contents from: ${sqlFilePath}`);
        console.log('5. Run the query');
        console.log('6. Run this script again to verify setup');
        console.log('');
        
        return false;
        
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        return false;
    }
}

// Run setup if called directly
if (require.main === module) {
    setupDatabase().then(success => {
        if (success) {
            console.log('🏁 Database setup completed successfully!');
            process.exit(0);
        } else {
            console.log('🔄 Please complete manual setup and run again.');
            process.exit(1);
        }
    }).catch(console.error);
}

module.exports = { setupDatabase, validateSchema };
