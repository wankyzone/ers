-- Enforce the approved ERS 20% platform / 80% runner split at release.
--
-- payout_amount is persisted at errand creation. This function does not
-- silently repair historical values: it fails closed if a stored payout
-- differs from the canonical 80% calculation, so the errand can be reviewed
-- rather than releasing an incorrect amount.

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
  v_release_key text;
BEGIN
  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Client ID is required';
  END IF;

  IF p_errand_id IS NULL THEN
    RAISE EXCEPTION 'Errand ID is required';
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
    RAISE EXCEPTION
      'Cannot release escrow: status=%, escrow=%',
      v_errand.status,
      v_errand.escrow_status;
  END IF;

  IF v_errand.assigned_runner_id IS NULL THEN
    RAISE EXCEPTION 'Cannot release escrow without an assigned runner';
  END IF;

  v_amount := v_errand.price;
  v_expected_payout := pg_catalog.floor(v_amount * 0.8);
  v_payout := COALESCE(v_errand.payout_amount, v_expected_payout);
  v_release_key := 'escrow-release:' || p_errand_id::text;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid escrow amount';
  END IF;

  IF v_payout IS NULL OR v_payout < 0 OR v_payout > v_amount THEN
    RAISE EXCEPTION 'Invalid runner payout';
  END IF;

  IF v_payout IS DISTINCT FROM v_expected_payout THEN
    RAISE EXCEPTION
      'Stored runner payout does not match the approved 80 percent split; manual review required';
  END IF;

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

  UPDATE public.wallets
  SET escrow_balance = COALESCE(escrow_balance, 0) - v_amount
  WHERE id = v_client_wallet.id;

  UPDATE public.wallets
  SET
    available_balance = COALESCE(available_balance, 0) + v_payout,
    balance = COALESCE(balance, 0) + v_payout
  WHERE id = v_runner_wallet.id;

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
