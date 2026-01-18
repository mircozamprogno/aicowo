-- Add resource_type column to services table
ALTER TABLE services 
ADD COLUMN resource_type text;

-- Make location_resource_id nullable as we're moving to type-based definition
ALTER TABLE services 
ALTER COLUMN location_resource_id DROP NOT NULL;

-- Optional: If you want to backfill resource_type from existing location_resources (best effort)
-- UPDATE services s
-- SET resource_type = lr.resource_type
-- FROM location_resources lr
-- WHERE s.location_resource_id = lr.id;
