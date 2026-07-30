-- Sprint 5: Security Hardening
-- Issue #4: Harden Wallets RLS
-- Enables RLS and removes direct wallet update permissions.


ALTER TABLE public.wallets
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own wallet"
ON public.wallets;