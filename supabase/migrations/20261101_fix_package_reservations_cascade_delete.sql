-- Fix package_reservations customer FK to CASCADE (2026-11-01)
--
-- The NO ACTION rule on package_reservations.customer_id was silently
-- blocking all customer deletions. bookings and contracts already CASCADE.

ALTER TABLE public.package_reservations
  DROP CONSTRAINT IF EXISTS package_reservations_customer_id_fkey;

ALTER TABLE public.package_reservations
  ADD CONSTRAINT package_reservations_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id)
  ON DELETE CASCADE;
