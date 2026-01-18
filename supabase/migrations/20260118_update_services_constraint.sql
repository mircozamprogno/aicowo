-- Drop the old constraint that references target_resource_type
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_linking_check;

-- Add the new constraint that references resource_type (the new text column)
ALTER TABLE services 
ADD CONSTRAINT services_linking_check 
CHECK (
  (location_resource_id IS NOT NULL) 
  OR 
  ((location_id IS NOT NULL) AND (resource_type IS NOT NULL))
);
