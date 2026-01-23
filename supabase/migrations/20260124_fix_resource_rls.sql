-- Migration: Fix RLS policies for contracts and bookings tables
-- Date: 2026-01-23

-- 1. Ensure is_admin() helper includes superadmins if used for general admin checks
-- Actually, it's better to keep roles distinct but update policies to be inclusive.
-- However, many policies already use is_admin() alone.

-- 2. Add explicit INSERT policies for contracts
-- Allow customers to create their own contracts
CREATE POLICY "Customers can insert own contracts" ON public.contracts
FOR INSERT TO authenticated
WITH CHECK (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
);

-- Ensure admins can insert contracts for their partner
-- We use a new policy to avoid ambiguity with the existing ALL policy
CREATE POLICY "Partner admins can insert contracts" ON public.contracts
FOR INSERT TO authenticated
WITH CHECK (
  (public.is_admin() OR public.is_superadmin()) 
  AND partner_uuid = public.get_my_partner_uuid()
);

-- Also add UPDATE policy for customers (needed for things like notes or basic updates)
CREATE POLICY "Customers can update own contracts" ON public.contracts
FOR UPDATE TO authenticated
USING (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
);


-- 3. Add explicit INSERT policies for bookings
-- Allow customers to create their own bookings
CREATE POLICY "Customers can insert own bookings" ON public.bookings
FOR INSERT TO authenticated
WITH CHECK (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
);

-- Ensure admins can insert bookings for their partner
CREATE POLICY "Partner admins can insert bookings" ON public.bookings
FOR INSERT TO authenticated
WITH CHECK (
  (public.is_admin() OR public.is_superadmin()) 
  AND partner_uuid = public.get_my_partner_uuid()
);

-- Also add UPDATE policy for customers
CREATE POLICY "Customers can update own bookings" ON public.bookings
FOR UPDATE TO authenticated
USING (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
);
