-- Sprint 5: Security Hardening
-- Consolidated migration for the security/RLS changes originally created
-- as separate files sharing the 20260730 migration version.

ALTER TABLE public.errand_events
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_logs
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.jobs
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orchestrator_retry_log
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payments
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.system_logs
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.users
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.wallets
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own wallet"
ON public.wallets;
