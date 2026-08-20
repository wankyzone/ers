-- Add escrow fields used by runtime escrow workflow
-- Adds: escrow_status (text), escrow_locked_at (timestamp without time zone)
-- Safe: both columns nullable and no default so existing rows are unaffected.

ALTER TABLE public.errands
  ADD COLUMN IF NOT EXISTS escrow_status text;

ALTER TABLE public.errands
  ADD COLUMN IF NOT EXISTS escrow_locked_at timestamp without time zone;
