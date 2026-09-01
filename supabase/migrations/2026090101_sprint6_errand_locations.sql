-- Add explicit pickup and delivery locations to errands.
-- These fields represent the errand's endpoints.
-- Runner lat/lng remain dedicated to live tracking.

ALTER TABLE public.errands
  ADD COLUMN IF NOT EXISTS pickup_location text;

ALTER TABLE public.errands
  ADD COLUMN IF NOT EXISTS delivery_location text;
