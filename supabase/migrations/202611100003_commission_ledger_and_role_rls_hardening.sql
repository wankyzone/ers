-- ERS financial commission ledger + Supabase role/RLS hardening.
-- New accounts are always clients. Runner access is granted only after KYC approval
-- through a service-role-only database function. Existing elevated roles are
-- preserved for a separate production account review.

-- ---------------------------------------------------------------------------
-- 1. Platform commission ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  errand_id uuid NOT NULL UNIQUE REFERENCES public.errands(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL,
  runner_id uuid NOT NULL,
  gross_amount numeric NOT NULL CHECK (gross_amount > 0),
  runner_amount numeric NOT NULL CHECK (runner_amount >= 0),
  commission_amount numeric NOT NULL CHECK (commission_amount >= 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  status text NOT NULL DEFAULT 'recognized'
    CHECK (status IN ('recognized', 'reversed', 'under_review')),
  source text NOT NULL DEFAULT 'escrow_release'
    CHECK (source IN ('escrow_release', 'historical_backfill')),
  recognized_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_commission_balances CHECK (
    gross_amount = runner_amount + commission_amount
  )
);

CREATE INDEX IF NOT EXISTS platform_commission_recognized_at_idx
  ON public.platform_commission_entries (recognized_at DESC);

CREATE TABLE IF NOT EXISTS public.financial_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type = 'errand_release'),
  source_id uuid NOT NULL REFERENCES public.errands(id) ON DELETE RESTRICT,
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  debit_total numeric NOT NULL CHECK (debit_total > 0),
  credit_total numeric NOT NULL CHECK (credit_total > 0),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'reversed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_journal_entry_balanced CHECK (debit_total = credit_total),
  CONSTRAINT financial_journal_source_unique UNIQUE (source_type, source_id)
);

CREATE TABLE IF NOT EXISTS public.financial_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.financial_journal_entries(id) ON DELETE RESTRICT,
  account_code text NOT NULL CHECK (
    account_code IN (
      'client_escrow_liability',
      'runner_wallet_liability',
      'platform_commission_revenue'
    )
  ),
  side text NOT NULL CHECK (side IN ('debit', 'credit')),
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_journal_account_once UNIQUE (journal_entry_id, account_code)
);

ALTER TABLE public.financial_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_journal_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.financial_journal_entries, public.financial_journal_lines
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.financial_journal_entries, public.financial_journal_lines
  TO service_role;

-- Deferred validation checks the final set of lines at transaction commit.
CREATE OR REPLACE FUNCTION public.assert_financial_journal_balanced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry_id uuid;
  v_entry public.financial_journal_entries%ROWTYPE;
  v_debits numeric;
  v_credits numeric;
BEGIN
  IF TG_TABLE_NAME = 'financial_journal_entries' THEN
    v_entry_id := NEW.id;
  ELSE
    v_entry_id := NEW.journal_entry_id;
  END IF;

  SELECT *
    INTO v_entry
  FROM public.financial_journal_entries
  WHERE id = v_entry_id;

  IF v_entry.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    COALESCE(pg_catalog.sum(amount) FILTER (WHERE side = 'debit'), 0),
    COALESCE(pg_catalog.sum(amount) FILTER (WHERE side = 'credit'), 0)
  INTO v_debits, v_credits
  FROM public.financial_journal_lines
  WHERE journal_entry_id = v_entry_id;

  IF v_debits <> v_entry.debit_total
     OR v_credits <> v_entry.credit_total
     OR v_debits <> v_credits THEN
    RAISE EXCEPTION 'Financial journal entry % is not balanced', v_entry_id;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_financial_journal_balanced() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS financial_journal_entry_balance_check ON public.financial_journal_entries;
CREATE CONSTRAINT TRIGGER financial_journal_entry_balance_check
AFTER INSERT OR UPDATE ON public.financial_journal_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_financial_journal_balanced();

DROP TRIGGER IF EXISTS financial_journal_line_balance_check ON public.financial_journal_lines;
CREATE CONSTRAINT TRIGGER financial_journal_line_balance_check
AFTER INSERT OR UPDATE ON public.financial_journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_financial_journal_balanced();

ALTER TABLE public.platform_commission_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_commission_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.platform_commission_entries TO service_role;

CREATE TABLE IF NOT EXISTS public.platform_commission_reconciliation_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  errand_id uuid NOT NULL UNIQUE REFERENCES public.errands(id) ON DELETE RESTRICT,
  gross_amount numeric,
  recorded_runner_amount numeric,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_commission_reconciliation_exceptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_commission_reconciliation_exceptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.platform_commission_reconciliation_exceptions TO service_role;

-- Preserve actual historical payout values. Do not rewrite paid runner earnings.
INSERT INTO public.platform_commission_entries (
  errand_id, client_id, runner_id, gross_amount, runner_amount,
  commission_amount, currency, status, source, recognized_at
)
SELECT
  e.id,
  e.client_id,
  e.assigned_runner_id,
  e.price,
  COALESCE(e.payout_amount, pg_catalog.floor(e.price * 0.8)),
  e.price - COALESCE(e.payout_amount, pg_catalog.floor(e.price * 0.8)),
  'NGN',
  'recognized',
  'historical_backfill',
  COALESCE(e.confirmed_at, e.created_at, now())
FROM public.errands e
WHERE e.status = 'confirmed'
  AND e.escrow_status = 'released'
  AND e.client_id IS NOT NULL
  AND e.assigned_runner_id IS NOT NULL
  AND e.price > 0
  AND COALESCE(e.payout_amount, pg_catalog.floor(e.price * 0.8)) >= 0
  AND COALESCE(e.payout_amount, pg_catalog.floor(e.price * 0.8)) <= e.price
ON CONFLICT (errand_id) DO NOTHING;

-- Build balanced journals for the historical commission rows without changing
-- existing wallet balances or runner payouts.
INSERT INTO public.financial_journal_entries (
  source_type, source_id, currency, debit_total, credit_total, status, created_at
)
SELECT
  'errand_release', c.errand_id, c.currency,
  c.gross_amount, c.gross_amount, 'posted', c.recognized_at
FROM public.platform_commission_entries c
WHERE c.status = 'recognized'
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.financial_journal_lines (
  journal_entry_id, account_code, side, amount, currency, user_id
)
SELECT
  j.id, 'client_escrow_liability', 'debit', c.gross_amount, c.currency, c.client_id
FROM public.financial_journal_entries j
JOIN public.platform_commission_entries c ON c.errand_id = j.source_id
WHERE j.source_type = 'errand_release'
ON CONFLICT (journal_entry_id, account_code) DO NOTHING;

INSERT INTO public.financial_journal_lines (
  journal_entry_id, account_code, side, amount, currency, user_id
)
SELECT
  j.id, 'runner_wallet_liability', 'credit', c.runner_amount, c.currency, c.runner_id
FROM public.financial_journal_entries j
JOIN public.platform_commission_entries c ON c.errand_id = j.source_id
WHERE j.source_type = 'errand_release'
  AND c.runner_amount > 0
ON CONFLICT (journal_entry_id, account_code) DO NOTHING;

INSERT INTO public.financial_journal_lines (
  journal_entry_id, account_code, side, amount, currency, user_id
)
SELECT
  j.id, 'platform_commission_revenue', 'credit', c.commission_amount, c.currency, NULL
FROM public.financial_journal_entries j
JOIN public.platform_commission_entries c ON c.errand_id = j.source_id
WHERE j.source_type = 'errand_release'
  AND c.commission_amount > 0
ON CONFLICT (journal_entry_id, account_code) DO NOTHING;



-- Quarantine invalid historical amounts for manual reconciliation.
INSERT INTO public.platform_commission_reconciliation_exceptions (
  errand_id, gross_amount, recorded_runner_amount, reason
)
SELECT
  e.id,
  e.price,
  e.payout_amount,
  'Historical released errand has missing ownership/runner or invalid gross/payout values; do not infer commission.'
FROM public.errands e
WHERE e.status = 'confirmed'
  AND e.escrow_status = 'released'
  AND (
    e.client_id IS NULL
    OR e.assigned_runner_id IS NULL
    OR e.price IS NULL
    OR e.price <= 0
    OR COALESCE(e.payout_amount, pg_catalog.floor(e.price * 0.8)) < 0
    OR COALESCE(e.payout_amount, pg_catalog.floor(e.price * 0.8)) > e.price
  )
ON CONFLICT (errand_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Replace escrow release with canonical split + commission recognition
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.release_escrow_atomic(
  p_client_id uuid,
  p_errand_id uuid
)
RETURNS public.errands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_errand public.errands%ROWTYPE;
  v_client_wallet public.wallets%ROWTYPE;
  v_runner_wallet public.wallets%ROWTYPE;
  v_existing_transaction public.transactions%ROWTYPE;
  v_amount numeric;
  v_payout numeric;
  v_expected_payout numeric;
  v_commission numeric;
  v_journal_entry_id uuid;
  v_release_key text;
BEGIN
  IF p_client_id IS NULL OR p_errand_id IS NULL THEN
    RAISE EXCEPTION 'Client ID and errand ID are required';
  END IF;

  SELECT *
    INTO v_errand
  FROM public.errands
  WHERE id = p_errand_id
  FOR UPDATE;

  IF v_errand.id IS NULL THEN
    RAISE EXCEPTION 'Errand not found';
  END IF;

  IF v_errand.client_id IS DISTINCT FROM p_client_id THEN
    RAISE EXCEPTION 'Unauthorized: not your errand';
  END IF;

  IF v_errand.status = 'confirmed'
     AND v_errand.escrow_status = 'released' THEN
    RETURN v_errand;
  END IF;

  IF v_errand.status IS DISTINCT FROM 'completed'
     OR v_errand.escrow_status IS DISTINCT FROM 'awaiting_confirmation' THEN
    RAISE EXCEPTION 'Errand is not eligible for escrow release';
  END IF;

  IF v_errand.assigned_runner_id IS NULL THEN
    RAISE EXCEPTION 'Cannot release escrow without an assigned runner';
  END IF;

  v_amount := v_errand.price;
  v_expected_payout := pg_catalog.floor(v_amount * 0.8);
  v_payout := COALESCE(v_errand.payout_amount, v_expected_payout);
  v_commission := v_amount - v_payout;
  v_release_key := 'escrow-release:' || p_errand_id::text;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid escrow amount';
  END IF;

  IF v_payout IS DISTINCT FROM v_expected_payout THEN
    RAISE EXCEPTION 'Stored runner payout does not match the approved 80 percent split; manual review required';
  END IF;

  IF v_commission < 0 THEN
    RAISE EXCEPTION 'Invalid platform commission amount';
  END IF;

  INSERT INTO public.wallets (user_id, balance, escrow_balance)
  VALUES (p_client_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
    INTO v_client_wallet
  FROM public.wallets
  WHERE user_id = p_client_id
  FOR UPDATE;

  IF v_client_wallet.id IS NULL
     OR COALESCE(v_client_wallet.escrow_balance, 0) < v_amount THEN
    RAISE EXCEPTION 'Insufficient client escrow balance';
  END IF;

  INSERT INTO public.wallets (user_id, balance, available_balance)
  VALUES (v_errand.assigned_runner_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
    INTO v_runner_wallet
  FROM public.wallets
  WHERE user_id = v_errand.assigned_runner_id
  FOR UPDATE;

  IF v_runner_wallet.id IS NULL THEN
    RAISE EXCEPTION 'Runner wallet not found';
  END IF;

  SELECT *
    INTO v_existing_transaction
  FROM public.transactions
  WHERE user_id = p_client_id
    AND idempotency_key = v_release_key
  LIMIT 1;

  IF v_existing_transaction.id IS NOT NULL THEN
    RAISE EXCEPTION 'Escrow release ledger record already exists for this errand';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.platform_commission_entries
    WHERE errand_id = p_errand_id
  ) THEN
    RAISE EXCEPTION 'Platform commission entry already exists for this unreleased errand';
  END IF;

  UPDATE public.wallets
  SET escrow_balance = COALESCE(escrow_balance, 0) - v_amount
  WHERE id = v_client_wallet.id;

  UPDATE public.wallets
  SET
    available_balance = COALESCE(available_balance, 0) + v_payout,
    balance = COALESCE(balance, 0) + v_payout
  WHERE id = v_runner_wallet.id;

  INSERT INTO public.transactions (
    user_id, errand_id, amount, type, status, client_id, runner_id, idempotency_key
  )
  VALUES (
    p_client_id, p_errand_id, v_amount, 'release', 'completed',
    p_client_id, v_errand.assigned_runner_id, v_release_key
  );

  INSERT INTO public.platform_commission_entries (
    errand_id, client_id, runner_id, gross_amount, runner_amount,
    commission_amount, currency, status, source, recognized_at
  )
  VALUES (
    p_errand_id, p_client_id, v_errand.assigned_runner_id,
    v_amount, v_payout, v_commission, 'NGN', 'recognized',
    'escrow_release', pg_catalog.now()
  );

  INSERT INTO public.financial_journal_entries (
    source_type, source_id, currency, debit_total, credit_total, status
  )
  VALUES (
    'errand_release', p_errand_id, 'NGN', v_amount, v_amount, 'posted'
  )
  RETURNING id
  INTO v_journal_entry_id;

  INSERT INTO public.financial_journal_lines (
    journal_entry_id, account_code, side, amount, currency, user_id
  )
  VALUES (
    v_journal_entry_id, 'client_escrow_liability', 'debit',
    v_amount, 'NGN', p_client_id
  );

  IF v_payout > 0 THEN
    INSERT INTO public.financial_journal_lines (
      journal_entry_id, account_code, side, amount, currency, user_id
    )
    VALUES (
      v_journal_entry_id, 'runner_wallet_liability', 'credit',
      v_payout, 'NGN', v_errand.assigned_runner_id
    );
  END IF;

  IF v_commission > 0 THEN
    INSERT INTO public.financial_journal_lines (
      journal_entry_id, account_code, side, amount, currency, user_id
    )
    VALUES (
      v_journal_entry_id, 'platform_commission_revenue', 'credit',
      v_commission, 'NGN', NULL
    );
  END IF;

  UPDATE public.errands
  SET
    status = 'confirmed',
    escrow_status = 'released',
    confirmed_at = COALESCE(confirmed_at, pg_catalog.now())
  WHERE id = p_errand_id
    AND client_id = p_client_id
    AND status = 'completed'
    AND escrow_status = 'awaiting_confirmation'
  RETURNING *
  INTO v_errand;

  IF v_errand.id IS NULL THEN
    RAISE EXCEPTION 'Escrow release state transition failed';
  END IF;

  RETURN v_errand;
END;
$$;

REVOKE ALL ON FUNCTION public.release_escrow_atomic(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_escrow_atomic(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_escrow_atomic(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Server-authoritative profile roles and KYC runner approval
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, email)
  VALUES (NEW.id, 'client', NEW.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Remove any previous trigger bound to this function, regardless of its legacy name.
DO $$
DECLARE
  v_trigger record;
BEGIN
  FOR v_trigger IN
    SELECT tgname
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgfoid = 'public.handle_new_user()'::regprocedure
      AND NOT tgisinternal
  LOOP
    EXECUTE pg_catalog.format('DROP TRIGGER %I ON auth.users', v_trigger.tgname);
  END LOOP;
END;
$$;

CREATE TRIGGER ers_handle_new_user_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Remove permissive and overlapping profile policies from recovered schema.
DROP POLICY IF EXISTS "Allow insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "allow_insert_for_authenticator" ON public.profiles;
DROP POLICY IF EXISTS "allow_insert_from_trigger" ON public.profiles;
DROP POLICY IF EXISTS "allow_profile_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Allow select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: read own" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: update own" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_self
ON public.profiles
FOR SELECT
TO authenticated
USING (id = (SELECT auth.uid()));

-- Client-side profile creation is intentionally disallowed. The Auth trigger
-- creates a client profile; service_role performs approved role transitions.

CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(auth.role(), '') NOT IN ('service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'Application role changes must be performed by a trusted server process';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_profile_role_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_role_escalation
BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- Atomic KYC approval promotes a client to runner only after a pending
-- application has been approved by the trusted admin API.
CREATE OR REPLACE FUNCTION public.approve_runner_kyc_atomic(p_kyc_id uuid)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kyc public.kyc_profiles%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF p_kyc_id IS NULL THEN
    RAISE EXCEPTION 'KYC ID is required';
  END IF;

  SELECT *
    INTO v_kyc
  FROM public.kyc_profiles
  WHERE id = p_kyc_id
  FOR UPDATE;

  IF v_kyc.id IS NULL THEN
    RAISE EXCEPTION 'KYC application not found';
  END IF;

  IF v_kyc.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Only pending KYC applications can be approved';
  END IF;

  IF NULLIF(pg_catalog.btrim(v_kyc.full_name), '') IS NULL
     OR NULLIF(pg_catalog.btrim(v_kyc.phone), '') IS NULL
     OR NULLIF(pg_catalog.btrim(v_kyc.bvn), '') IS NULL
     OR NULLIF(pg_catalog.btrim(v_kyc.bank_code), '') IS NULL
     OR NULLIF(pg_catalog.btrim(v_kyc.account_number), '') IS NULL
     OR NULLIF(pg_catalog.btrim(v_kyc.account_name), '') IS NULL THEN
    RAISE EXCEPTION 'KYC application is missing required identity or bank verification fields';
  END IF;

  SELECT *
    INTO v_profile
  FROM public.profiles
  WHERE id = v_kyc.user_id
  FOR UPDATE;

  IF v_profile.id IS NULL OR v_profile.role IS NULL OR v_profile.role NOT IN ('client', 'runner') THEN
    RAISE EXCEPTION 'KYC applicant is not eligible for runner approval';
  END IF;

  UPDATE public.kyc_profiles
  SET status = 'approved'
  WHERE id = p_kyc_id;

  UPDATE public.profiles
  SET role = 'runner', verified = true
  WHERE id = v_profile.id
  RETURNING *
  INTO v_profile;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_runner_kyc_atomic(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_runner_kyc_atomic(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_runner_kyc_atomic(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Lock down direct client access to financial / operational tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.errands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.errand_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.errand_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orchestrator_retry_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Remove any client write policies on wallets and retain only self-read.
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;
DROP POLICY IF EXISTS wallets_update_self ON public.wallets;
DROP POLICY IF EXISTS wallets_insert_self ON public.wallets;
DROP POLICY IF EXISTS wallets_delete_self ON public.wallets;
DROP POLICY IF EXISTS "Users can read own wallet" ON public.wallets;

CREATE POLICY wallets_select_self
ON public.wallets
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Errand state changes and creation are backend/RPC-owned. Clients may read
-- their own errands; runners may read unassigned work and their assignments.
DROP POLICY IF EXISTS "Clients can insert errands" ON public.errands;
DROP POLICY IF EXISTS "Open errands visibility" ON public.errands;
DROP POLICY IF EXISTS "Runners can update errands" ON public.errands;
DROP POLICY IF EXISTS "read_available_errands" ON public.errands;

CREATE POLICY errands_select_participant_or_available
ON public.errands
FOR SELECT
TO authenticated
USING (
  client_id = (SELECT auth.uid())
  OR assigned_runner_id = (SELECT auth.uid())
  OR (
    status = 'created'
    AND escrow_status = 'locked'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'runner'
    )
  )
);

-- Remove broad client grants; explicitly grant only reads needed by client
-- applications. All writes remain service-role/backend only.
REVOKE ALL ON TABLE public.profiles, public.wallets, public.transactions,
  public.payments, public.errands, public.errand_events, public.errand_logs,
  public.users, public.kyc_profiles, public.otp_codes, public.user_devices,
  public.jobs, public.job_logs, public.system_logs, public.orchestrator_retry_log,
  public.runners, public.audit_logs
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.profiles, public.wallets, public.errands
TO authenticated;

-- Service-role API remains the sole writer for the above tables.
GRANT ALL ON TABLE public.profiles, public.wallets, public.transactions,
  public.payments, public.errands, public.errand_events, public.errand_logs,
  public.users, public.kyc_profiles, public.otp_codes, public.user_devices,
  public.jobs, public.job_logs, public.system_logs, public.orchestrator_retry_log,
  public.runners, public.audit_logs
TO service_role;

-- No public-schema RPC is exposed to browser/mobile roles. The API uses service_role.
-- This also closes any legacy SECURITY DEFINER function that inherited broad
-- default EXECUTE grants from the recovered schema.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Recovered default privileges granted all future public objects to client roles.
-- Revoke those defaults so newly created tables/functions are not exposed by default.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
