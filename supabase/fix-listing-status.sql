-- Fix for missing listing_status enum and column
-- Run this script in Supabase SQL Editor

-- First, create the listing_status enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('active', 'pending', 'sold', 'withdrawn', 'processing', 'error');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'listing_status enum type already exists, skipping creation';
END $$;

-- Check if the properties table exists and if listing_status column is missing
DO $$
BEGIN
    -- Check if the column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'properties' 
        AND column_name = 'listing_status'
    ) THEN
        -- Add the listing_status column if it doesn't exist
        ALTER TABLE public.properties 
        ADD COLUMN listing_status listing_status DEFAULT 'active';
        
        RAISE NOTICE 'Added listing_status column to properties table';
    ELSE
        RAISE NOTICE 'listing_status column already exists in properties table';
    END IF;
    
    -- Check if processing_status column exists and has the right type
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'properties' 
        AND column_name = 'processing_status'
    ) THEN
        -- Add the processing_status column if it doesn't exist
        ALTER TABLE public.properties 
        ADD COLUMN processing_status listing_status DEFAULT 'processing';
        
        RAISE NOTICE 'Added processing_status column to properties table';
    ELSE
        RAISE NOTICE 'processing_status column already exists in properties table';
    END IF;
END $$;

-- Create index for listing_status if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_properties_listing_status ON public.properties(listing_status);

-- Verify the fix
SELECT 
    column_name, 
    data_type, 
    udt_name,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'properties' 
AND column_name IN ('listing_status', 'processing_status')
ORDER BY column_name;

-- Also check if the enum type exists
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'listing_status'
ORDER BY e.enumsortorder;