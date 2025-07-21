-- Add Content Generation Columns to Properties Table
-- Copy and paste this into Supabase SQL Editor and run it

-- Add content generation columns if they don't exist
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS content_generation_job_id TEXT,
ADD COLUMN IF NOT EXISTS content_generation_status TEXT,
ADD COLUMN IF NOT EXISTS content_generation_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS content_generation_completed_at TIMESTAMPTZ;

-- Create index for content generation status
CREATE INDEX IF NOT EXISTS idx_properties_content_generation_status 
ON properties(content_generation_status);

-- Success message
SELECT 'Content generation columns added successfully!' as message;