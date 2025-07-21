-- Create only the enum types first
-- Run this before running the main schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create all custom enum types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('agent', 'admin', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'user_role enum already exists';
END $$;

DO $$ BEGIN
    CREATE TYPE property_type AS ENUM ('house', 'condo', 'townhouse', 'apartment', 'land', 'commercial');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'property_type enum already exists';
END $$;

DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('active', 'pending', 'sold', 'withdrawn', 'processing', 'error');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'listing_status enum already exists';
END $$;

DO $$ BEGIN
    CREATE TYPE social_platform AS ENUM ('instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'social_platform enum already exists';
END $$;

DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'published', 'failed');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'post_status enum already exists';
END $$;

DO $$ BEGIN
    CREATE TYPE brand_tier AS ENUM ('nester_default', 'nester_plus', 'white_label');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'brand_tier enum already exists';
END $$;

DO $$ BEGIN
    CREATE TYPE image_style AS ENUM ('original', 'enhanced', 'virtual_staging');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'image_style enum already exists';
END $$;

DO $$ BEGIN
    CREATE TYPE workflow_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'workflow_status enum already exists';
END $$;

DO $$ BEGIN
    CREATE TYPE content_archetype AS ENUM ('lifestyle', 'luxury', 'family', 'investment', 'first_time_buyer');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'content_archetype enum already exists';
END $$;

-- Verify all enums were created
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN (
    'user_role', 'property_type', 'listing_status', 'social_platform', 
    'post_status', 'brand_tier', 'image_style', 'workflow_status', 'content_archetype'
)
GROUP BY t.typname
ORDER BY t.typname;