-- Drop the restrictive resource_type constraint on contracts table
-- This allows contracts to be created with any resource type defined in the system,
-- matching the flexibility already introduced in the services table.

ALTER TABLE public.contracts 
DROP CONSTRAINT IF EXISTS chk_resource_type;
