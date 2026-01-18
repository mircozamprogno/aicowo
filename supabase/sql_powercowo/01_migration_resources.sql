-- Migration script to enable custom resource types
-- Run this in your Supabase SQL Editor

-- 1. Drop the existing constraint that limits resource types
ALTER TABLE public.location_resources DROP CONSTRAINT IF EXISTS location_resources_resource_type_check;

-- 2. (Optional) Create a function to help split resources
-- This function takes a resource ID, creates (quantity-1) new resources, and sets them all to quantity 1
CREATE OR REPLACE FUNCTION public.split_location_resource(resource_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    r_record RECORD;
    i integer;
BEGIN
    -- Get the resource
    SELECT * INTO r_record FROM public.location_resources WHERE id = resource_id;
    
    -- Only proceed if it exists and quantity > 1
    IF FOUND AND r_record.quantity > 1 THEN
        
        -- Start loop from 2 because the original record will act as "Item 1"
        FOR i IN 2..r_record.quantity LOOP
            INSERT INTO public.location_resources (
                location_resource_uuid,
                location_id,
                partner_uuid,
                resource_type,
                resource_name,
                quantity,
                description,
                is_available,
                created_by
            ) VALUES (
                gen_random_uuid(),
                r_record.location_id,
                r_record.partner_uuid,
                r_record.resource_type,
                r_record.resource_name || ' ' || i, -- e.g. "Scrivania 2"
                1,
                r_record.description,
                r_record.is_available,
                r_record.created_by
            );
        END LOOP;

        -- Update the original record
        UPDATE public.location_resources
        SET 
            resource_name = resource_name || ' 1', -- e.g. "Scrivania 1"
            quantity = 1
        WHERE id = resource_id;
        
    END IF;
END;
$$;
