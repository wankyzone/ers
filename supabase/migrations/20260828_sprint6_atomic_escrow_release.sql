-- Sprint 6: Atomic and idempotent escrow release
--
-- Guarantees:
-- 1. Only the owning client can release escrow for a completed errand.
-- 2. Errand state, client escrow debit, runner payout, and ledger entry
--    commit or roll back as one database transaction.
-- 3. Repeated confirmation of an already released errand is idempotent.
-- 4. Concurrent confirmations are serialized by row-level locks.
-- 5. A release ledger entry is uniquely keyed per client + errand.

CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_id_escrow_release_key_key
  ON public.transactions (user_id, idempotency_key)
  WHERE user_id IS NOT NULL
    AND idempotency_key IS NOT NULL;

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
  v_release_key text;
BEGIN
  -- ============================================================
  -- 1. VALIDATE INPUT
  -- ============================================================

  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Client ID is required';
  END IF;

  IF p_errand_id IS NULL THEN
    RAISE EXCEPTION 'Errand ID is required';
  END IF;

  -- ============================================================
  -- 2. LOCK THE ERRAND
  --
  -- Every confirmation for the same errand is serialized here.
  -- This is the primary idempotency/race-condition guard.
  -- ============================================================

  SELECT *
    INTO v_errand
  FROM public.errands
  WHERE id = p_errand_id
  FOR UPDATE;

  IF v_errand.id IS NULL THEN
    RAISE EXCEPTION 'Errand not found';
  END IF;

  -- Ownership is enforced inside the SECURITY DEFINER function.
  IF v_errand.client_id IS DISTINCT FROM p_client_id THEN
    RAISE EXCEPTION 'Unauthorized: not your errand';
  END IF;

  -- ============================================================
  -- 3. IDEMPOTENT SUCCESS PATH
  -- ============================================================

  IF v_errand.status = 'confirmed'
     AND v_errand.escrow_status = 'released' THEN
    RETURN v_errand;
  END IF;

  -- A partially transitioned state is never accepted as success.
  IF v_errand.status IS DISTINCT FROM 'completed'
     OR v_errand.escrow_status IS DISTINCT FROM 'awaiting_confirmation' THEN
    RAISE EXCEPTION
      'Cannot release escrow: status=%, escrow=%',
      v_errand.status,
      v_errand.escrow_status;
  END IF;

  IF v_errand.assigned_runner_id IS NULL THEN
    RAISE EXCEPTION 'Cannot release escrow without an assigned runner';
  END IF;

  v_amount := COALESCE(v_errand.price, v_errand.payout_amount);
  v_payout := COALESCE(v_errand.payout_amount, pg_catalog.floor(v_amount * 0.8));
  v_release_key := 'escrow-release:' || p_errand_id::text;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid escrow amount';
  END IF;

  IF v_payout IS NULL OR v_payout < 0 THEN
    RAISE EXCEPTION 'Invalid runner payout';
  END IF;

  -- ============================================================
  -- 4. ENSURE + LOCK CLIENT WALLET
  -- ============================================================

  INSERT INTO public.wallets (user_id, balance, escrow_balance)
  VALUES (p_client_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
    INTO v_client_wallet
  FROM public.wallets
  WHERE user_id = p_client_id
  FOR UPDATE;

  IF v_client_wallet.id IS NULL THEN
    RAISE EXCEPTION 'Client wallet not found';
  END IF;

  IF COALESCE(v_client_wallet.escrow_balance, 0) < v_amount THEN
    RAISE EXCEPTION 'Insufficient escrow balance';
  END IF;

  -- ============================================================
  -- 5. ENSURE + LOCK RUNNER WALLET
  -- ============================================================

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

  -- ============================================================
  -- 6. PROTECT AGAINST A PRE-EXISTING RELEASE LEDGER RECORD
  -- ============================================================

  SELECT *
    INTO v_existing_transaction
  FROM public.transactions
  WHERE user_id = p_client_id
    AND idempotency_key = v_release_key
  LIMIT 1;

  IF v_existing_transaction.id IS NOT NULL THEN
    RAISE EXCEPTION 'Escrow release ledger record already exists for this errand';
  END IF;

  -- ============================================================
  -- 7. MOVE CLIENT ESCROW OUT + CREDIT RUNNER
  -- ============================================================

  UPDATE public.wallets
  SET escrow_balance = COALESCE(escrow_balance, 0) - v_amount
  WHERE id = v_client_wallet.id;

  UPDATE public.wallets
  SET
    available_balance = COALESCE(available_balance, 0) + v_payout,
    balance = COALESCE(balance, 0) + v_payout
  WHERE id = v_runner_wallet.id;

  -- ============================================================
  -- 8. WRITE THE RELEASE LEDGER ENTRY
  -- ============================================================

  INSERT INTO public.transactions (
    user_id,
    errand_id,
    amount,
    type,
    status,
    client_id,
    runner_id,
    idempotency_key
  )
  VALUES (
    p_client_id,
    p_errand_id,
    v_amount,
    'release',
    'completed',
    p_client_id,
    v_errand.assigned_runner_id,
    v_release_key
  );

  -- ============================================================
  -- 9. FINALIZE ERRAND + ESCROW STATE
  -- ============================================================

  UPDATE public.errands
  SET
    status = 'confirmed',
    escrow_status = 'released',
    confirmed_at = now()
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
