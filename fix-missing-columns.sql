-- Add missing columns to properties table

-- Create listing_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('active', 'pending', 'sold', 'withdrawn', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add missing columns
ALTER TABLE properties ADD COLUMN IF NOT EXISTS listing_status listing_status DEFAULT 'active';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS content_generation_status TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS content_generation_job_id TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS content_generation_started_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS content_generation_completed_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS google_place_id TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS formatted_address TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS title TEXT;

-- Update existing properties to have default listing_status if null
UPDATE properties SET listing_status = 'active' WHERE listing_status IS NULL;

SELECT 'Missing columns added successfully!' as message;