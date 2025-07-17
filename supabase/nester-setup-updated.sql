-- 🚀 Enhanced Nester Database Schema - Complete Implementation
-- This builds upon your existing schema with PRD requirements

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enhanced custom types (updated to match PRD)
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
    CREATE TYPE social_platform AS ENUM ('instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube', 'bluesky', 'threads');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'published', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE brand_tier AS ENUM ('nester_default', 'nester_plus', 'white_label');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE image_style AS ENUM ('original', 'contemporary', 'bohemian', 'traditional', 'scandinavian');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE content_archetype AS ENUM ('feature_spotlight', 'before_after', 'local_gem', 'data_insight', 'poll_question', 'lifestyle_story', 'meet_expert');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Core tables (your existing structure enhanced)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role user_role DEFAULT 'agent',
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced agent brands table with PRD requirements
CREATE TABLE IF NOT EXISTS agent_brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Brand Identity Flags
    has_custom_branding BOOLEAN DEFAULT FALSE,
    brand_tier brand_tier DEFAULT 'nester_default',
    
    -- White-Label Assets (NULL = use Nester defaults)
    company_name TEXT,
    logo_storage_path TEXT,
    primary_color TEXT DEFAULT '#2563eb',
    secondary_color TEXT DEFAULT '#64748b',
    font_family TEXT DEFAULT 'Inter',
    
    -- AI Persona (can be customized even with Nester branding)
    persona_tone TEXT DEFAULT 'Professional & Authoritative',
    persona_style TEXT DEFAULT 'Concise & Factual',
    persona_key_phrases TEXT[],
    persona_phrases_to_avoid TEXT[],
    
    -- Nester Brand Assets (system defaults)
    nester_logo_path TEXT DEFAULT '/assets/nester-logo.svg',
    nester_primary_color TEXT DEFAULT '#2563eb',
    nester_secondary_color TEXT DEFAULT '#64748b',
    nester_font_family TEXT DEFAULT 'Inter',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id)
);

-- Properties table (enhanced with PRD requirements)
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Property Details
    address TEXT NOT NULL,
    price INTEGER,
    bedrooms INTEGER,
    bathrooms DECIMAL(3,1),
    square_feet INTEGER,
    property_type property_type DEFAULT 'house',
    description TEXT,
    features TEXT[],
    
    -- Source & Processing
    source_url TEXT,
    input_method TEXT DEFAULT 'form', -- 'url' or 'form'
    processing_status listing_status DEFAULT 'processing',
    
    -- Microsite
    microsite_slug TEXT UNIQUE, -- for nester.com/agent-name/property-address
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property images table (enhanced with style support)
CREATE TABLE IF NOT EXISTS property_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Image Details
    storage_path TEXT NOT NULL,
    original_url TEXT,
    room_type TEXT, -- kitchen, bedroom, bathroom, living_room, exterior
    style image_style DEFAULT 'original',
    aspect_ratio TEXT, -- 1:1, 9:16, 16:9
    
    -- Organization
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    alt_text TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social media posts table (enhanced with PRD requirements)
CREATE TABLE IF NOT EXISTS social_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Content Details
    platform social_platform NOT NULL,
    content TEXT NOT NULL,
    hashtags TEXT[],
    
    -- Campaign Context
    week_theme TEXT, -- "Grand Unveiling", "Home Features", etc.
    content_archetype content_archetype,
    
    -- Visual Assets
    image_paths TEXT[], -- support for multiple images/slideshow
    
    -- Scheduling
    status post_status DEFAULT 'draft',
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    
    -- External References
    external_post_id TEXT, -- ID from social platform
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social media statistics table (enhanced analytics)
CREATE TABLE IF NOT EXISTS social_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    social_post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    
    -- Performance Metrics
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    
    -- Engagement Rate Calculation
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: Property performance analytics (from PRD)
CREATE TABLE IF NOT EXISTS property_stats (
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Website Metrics
    website_impressions INTEGER DEFAULT 0,
    website_clicks INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    
    -- Conversion Metrics
    pdf_downloads INTEGER DEFAULT 0,
    chat_sessions INTEGER DEFAULT 0,
    leads_captured INTEGER DEFAULT 0,
    
    -- Social Aggregate
    total_social_impressions INTEGER DEFAULT 0,
    total_social_engagements INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (property_id, date)
);

-- Chat sessions table (enhanced with PRD requirements)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    
    -- Session Details
    title TEXT,
    messages JSONB NOT NULL DEFAULT '[]',
    session_type TEXT DEFAULT 'general',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Lead Intelligence (from PRD)
    visitor_email TEXT,
    questions_asked TEXT[],
    interests_detected TEXT[],
    session_duration INTEGER, -- seconds
    
    -- GDPR Compliance
    retention_expires_at TIMESTAMPTZ, -- 30 days after property sold
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: Lead management (from PRD)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    
    -- Contact Information
    email TEXT NOT NULL,
    phone TEXT,
    name TEXT,
    
    -- Lead Intelligence
    source TEXT, -- 'chat', 'pdf_download', 'contact_form'
    interests TEXT[],
    buyer_persona TEXT,
    quality_score INTEGER DEFAULT 0, -- 1-10 scale
    
    -- Follow-up
    contacted_at TIMESTAMPTZ,
    follow_up_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: Error logging and monitoring (from PRD)
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Error Context
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    
    -- Associated Records
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- System Context
    workflow_name TEXT,
    api_endpoint TEXT,
    request_data JSONB,
    
    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: Campaign templates and content library
CREATE TABLE IF NOT EXISTS content_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Template Details
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'social_post', 'email', 'microsite'
    template_type TEXT NOT NULL, -- 'html', 'text', 'json'
    content TEXT NOT NULL,
    
    -- Customization
    variables JSONB DEFAULT '{}', -- template variables
    brand_customizable BOOLEAN DEFAULT TRUE,
    
    -- Usage
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_agent_id ON properties(agent_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(processing_status);
CREATE INDEX IF NOT EXISTS idx_properties_microsite_slug ON properties(microsite_slug);
CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);
CREATE INDEX IF NOT EXISTS idx_property_images_style ON property_images(style);
CREATE INDEX IF NOT EXISTS idx_social_posts_property_id ON social_posts(property_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_social_stats_post_id ON social_stats(social_post_id);
CREATE INDEX IF NOT EXISTS idx_property_stats_property_date ON property_stats(property_id, date);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_property_id ON chat_sessions(property_id);
CREATE INDEX IF NOT EXISTS idx_leads_property_id ON leads(property_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_brands_agent_id ON agent_brands(agent_id);

-- Enhanced functions
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

-- Enhanced user profile creation with brand setup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email, role) VALUES (NEW.id, NEW.email, 'agent');
    INSERT INTO agent_brands (agent_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NEW: Automatic microsite slug generation
CREATE OR REPLACE FUNCTION generate_microsite_slug()
RETURNS TRIGGER AS $$
DECLARE
    agent_name TEXT;
    clean_address TEXT;
    slug_base TEXT;
    slug_final TEXT;
    counter INTEGER := 0;
BEGIN
    -- Get agent company name or email prefix
    SELECT COALESCE(ab.company_name, split_part(u.email, '@', 1))
    INTO agent_name
    FROM users u
    LEFT JOIN agent_brands ab ON ab.agent_id = u.id
    WHERE u.id = NEW.agent_id;
    
    -- Clean address for URL
    clean_address := lower(regexp_replace(NEW.address, '[^a-zA-Z0-9\s]', '', 'g'));
    clean_address := regexp_replace(clean_address, '\s+', '-', 'g');
    
    -- Create base slug
    slug_base := lower(agent_name) || '/' || clean_address;
    slug_final := slug_base;
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM properties WHERE microsite_slug = slug_final) LOOP
        counter := counter + 1;
        slug_final := slug_base || '-' || counter;
    END LOOP;
    
    NEW.microsite_slug := slug_final;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- NEW: GDPR compliance - automatic chat session cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_chats()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM chat_sessions 
    WHERE retention_expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

CREATE TRIGGER generate_microsite_slug_trigger
    BEFORE INSERT ON properties
    FOR EACH ROW
    EXECUTE FUNCTION generate_microsite_slug();

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can access their own profile" ON users
    FOR ALL TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can access their own brand" ON agent_brands
    FOR ALL TO authenticated
    USING (agent_id = auth.uid());

CREATE POLICY "Users can access their own properties" ON properties
    FOR ALL TO authenticated
    USING (agent_id = auth.uid());

CREATE POLICY "Users can access their property images" ON property_images
    FOR ALL TO authenticated
    USING (property_id IN (SELECT id FROM properties WHERE agent_id = auth.uid()));

CREATE POLICY "Users can access their social posts" ON social_posts
    FOR ALL TO authenticated
    USING (property_id IN (SELECT id FROM properties WHERE agent_id = auth.uid()));

CREATE POLICY "Users can access their social stats" ON social_stats
    FOR ALL TO authenticated
    USING (social_post_id IN (
        SELECT sp.id FROM social_posts sp
        JOIN properties p ON sp.property_id = p.id
        WHERE p.agent_id = auth.uid()
    ));

CREATE POLICY "Users can access their property stats" ON property_stats
    FOR ALL TO authenticated
    USING (property_id IN (SELECT id FROM properties WHERE agent_id = auth.uid()));

CREATE POLICY "Users can access their chat sessions" ON chat_sessions
    FOR ALL TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can access their leads" ON leads
    FOR ALL TO authenticated
    USING (property_id IN (SELECT id FROM properties WHERE agent_id = auth.uid()));

-- Admin can access error logs
CREATE POLICY "Admins can access error logs" ON error_logs
    FOR ALL TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- Public access for content templates
CREATE POLICY "Public can read content templates" ON content_templates
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Success message
SELECT '🎉 Enhanced Nester database setup completed successfully!' as message;