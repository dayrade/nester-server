const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;

if (!supabaseUrl) {
    console.error('❌ Missing SUPABASE_URL in .env file');
    process.exit(1);
}

// Extract project ID from Supabase URL
const projectId = supabaseUrl.replace('https://', '').split('.')[0];
const dashboardUrl = `https://supabase.com/dashboard/project/${projectId}/sql/new`;

const setupSQL = `-- 🚀 Nester Complete Database Setup
-- Copy this entire script and paste it into Supabase SQL Editor
-- Then click "Run" to create all tables, functions, and triggers

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('agent', 'admin', 'viewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE property_type AS ENUM ('house', 'condo', 'townhouse', 'apartment', 'land', 'commercial');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('active', 'pending', 'sold', 'withdrawn', 'processing', 'error');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE social_platform AS ENUM ('instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'published', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE brand_tier AS ENUM ('nester_default', 'nester_plus', 'white_label');
EXCEPTION WHEN duplicate_object THEN null; END $$;

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
    listing_status listing_status DEFAULT 'active',
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
    status post_status DEFAULT 'draft',
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_agent_id ON properties(agent_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(listing_status);
CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_property_id ON social_posts(property_id);
CREATE INDEX IF NOT EXISTS idx_social_stats_post_id ON social_stats(social_post_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_brands_agent_id ON agent_brands(agent_id);

-- Essential functions
CREATE OR REPLACE FUNCTION check_user_exists(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM users WHERE email = user_email);
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

-- Auto-create user profile when auth user is created
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email, role) VALUES (NEW.id, NEW.email, 'agent');
    INSERT INTO agent_brands (agent_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profiles
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- Success message
SELECT '🎉 Nester database setup completed successfully!' as message;
`;

function openSupabaseDashboard() {
    console.log('🚀 Opening Supabase SQL Editor...');
    
    // Try to open the browser
    const command = process.platform === 'win32' ? 'start' : 
                   process.platform === 'darwin' ? 'open' : 'xdg-open';
    
    exec(`${command} "${dashboardUrl}"`, (error) => {
        if (error) {
            console.log('⚠️ Could not auto-open browser. Please manually open:');
            console.log(`   ${dashboardUrl}`);
        } else {
            console.log('✅ Supabase SQL Editor opened in browser');
        }
    });
}

function main() {
    console.log('🎯 Nester Quick Setup - Make it 100% Functional!');
    console.log('==================================================');
    console.log('');
    
    // Save SQL to file for easy access
    const sqlFile = path.join(__dirname, 'nester-setup.sql');
    fs.writeFileSync(sqlFile, setupSQL);
    
    console.log('📝 Setup SQL saved to: nester-setup.sql');
    console.log('');
    
    console.log('🔥 QUICK SETUP STEPS:');
    console.log('==================================================');
    console.log('1. 🌐 Opening Supabase SQL Editor...');
    console.log('2. 📋 Copy the SQL below');
    console.log('3. 📝 Paste it into the SQL Editor');
    console.log('4. ▶️  Click "Run" button');
    console.log('5. ✅ Run: node complete-setup.js (to verify)');
    console.log('');
    
    // Open browser
    openSupabaseDashboard();
    
    console.log('📋 COPY THIS SQL:');
    console.log('==================================================');
    console.log(setupSQL);
    console.log('==================================================');
    console.log('');
    console.log('⚡ After running the SQL, execute: node complete-setup.js');
    console.log('🎯 This will verify your setup is 100% complete!');
}

if (require.main === module) {
    main();
}

module.exports = { setupSQL, dashboardUrl };
