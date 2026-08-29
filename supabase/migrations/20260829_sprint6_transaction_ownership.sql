-- Sprint 6: Transaction ownership
--
-- Formalizes transaction ownership columns already present in the
-- production schema and required by atomic escrow release.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS client_id uuid;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS runner_id uuid;
