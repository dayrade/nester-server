-- Add Storage Policies for Property Images
-- This script adds the necessary storage policies for the property-images bucket
-- Copy and paste this into Supabase SQL Editor and run it

-- Create the property-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload property images
CREATE POLICY "Authenticated users can upload property images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'property-images');

-- Allow authenticated users to update their own property images
CREATE POLICY "Users can update their property images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'property-images')
WITH CHECK (bucket_id = 'property-images');

-- Allow authenticated users to delete their own property images
CREATE POLICY "Users can delete their property images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'property-images');

-- Allow public access to view property images
CREATE POLICY "Public can view property images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'property-images');

-- Success message
SELECT 'Property images storage policies created successfully!' as message;