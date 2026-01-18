-- Migration script to update services table for flexible linking
-- Run this in your Supabase SQL Editor

-- 1. Make location_resource_id nullable and add target_resource_type
ALTER TABLE public.services ALTER COLUMN location_resource_id DROP NOT NULL;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS target_resource_type character varying(50);

-- 2. Add constraint to ensure we have enough info to book
-- Either specific resource OR (Location + Target Type) must be defined
ALTER TABLE public.services ADD CONSTRAINT services_linking_check 
    CHECK ((location_resource_id IS NOT NULL) OR (location_id IS NOT NULL AND target_resource_type IS NOT NULL));

-- 3. Update comments
COMMENT ON COLUMN public.services.location_resource_id IS 'Specific resource link. If null, use target_resource_type';
