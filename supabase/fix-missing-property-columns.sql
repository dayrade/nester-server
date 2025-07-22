-- Fix Missing Property Columns Migration
-- This script adds missing columns that are causing 500 errors during property insertion
-- Copy and paste this into Supabase SQL Editor and run it

-- Add missing columns to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS content_generation_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS content_generation_job_id TEXT,
ADD COLUMN IF NOT EXISTS content_generation_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS content_generation_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scraping_job_id TEXT,
ADD COLUMN IF NOT EXISTS scraping_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scraping_error TEXT,
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS input_method TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS microsite_slug TEXT UNIQUE;

-- Update existing properties to have default values
UPDATE properties 
SET 
    content_generation_status = 'pending',
    input_method = 'manual'
WHERE 
    content_generation_status IS NULL 
    OR input_method IS NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_content_generation_status ON properties(content_generation_status);
CREATE INDEX IF NOT EXISTS idx_properties_input_method ON properties(input_method);
CREATE INDEX IF NOT EXISTS idx_properties_microsite_slug ON properties(microsite_slug);

-- Add comment for documentation
COMMENT ON COLUMN properties.content_generation_status IS 'Status of AI content generation: pending, processing, completed, failed';
COMMENT ON COLUMN properties.input_method IS 'How the property was created: manual, scraping, api';
COMMENT ON COLUMN properties.microsite_slug IS 'Unique slug for property microsite URL';

SELECT 'Missing property columns added successfully!' as message;