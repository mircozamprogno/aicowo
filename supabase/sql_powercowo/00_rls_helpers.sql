-- Helper functions for RLS policies
-- These functions are SECURITY DEFINER to bypass RLS recursion when checking roles/permissions

CREATE OR REPLACE FUNCTION public.get_my_partner_uuid()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return the partner_uuid for the current authenticated user
  RETURN (
    SELECT partner_uuid 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the current user has 'admin' or 'superadmin' role
  -- Note: Usually 'admin' policies are specific, but sometimes superadmin implies admin. 
  -- For strict RLS, we stick to checking the 'admin' string or specific logic.
  -- Based on existing policies: (p.role = 'admin')
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the current user has 'superadmin' role
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'superadmin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$;
