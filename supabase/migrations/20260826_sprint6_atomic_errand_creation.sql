-- Sprint 6: Atomic errand creation
--
-- Guarantees:
-- 1. Wallet debit and escrow reservation are atomic with errand creation.
-- 2. Transaction ledger creation is part of the same database transaction.
-- 3. Concurrent requests for the same client are serialized by wallet locking.
-- 4. Idempotency is scoped to the client.
-- 5. Reusing an idempotency key with a different payload is rejected.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS type text;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_id_idempotency_key_key
  ON public.transactions (user_id, idempotency_key)
  WHERE user_id IS NOT NULL
    AND idempotency_key IS NOT NULL;


CREATE OR REPLACE FUNCTION public.create_errand_atomic(
  p_client_id uuid,
  p_title text,
  p_description text,
  p_price numeric,
  p_idempotency_key text
)
RETURNS public.errands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_errand public.errands%ROWTYPE;
  v_existing_transaction public.transactions%ROWTYPE;
  v_existing_errand public.errands%ROWTYPE;
  v_payout_amount numeric;
BEGIN
  -- ============================================================
  -- 1. VALIDATE INPUT
  -- ============================================================

  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Client ID is required';
  END IF;

  IF p_title IS NULL OR pg_catalog.btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  IF p_price IS NULL
     OR p_price <= 0
     OR p_price <> pg_catalog.trunc(p_price) THEN
    RAISE EXCEPTION 'Invalid price';
  END IF;

  IF p_idempotency_key IS NULL OR pg_catalog.btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key is required';
  END IF;


  -- ============================================================
  -- 2. ENSURE WALLET EXISTS
  -- ============================================================

  INSERT INTO public.wallets (
    user_id,
    balance,
    escrow_balance
  )
  VALUES (
    p_client_id,
    0,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;


  -- ============================================================
  -- 3. LOCK CLIENT WALLET
  --
  -- This serializes concurrent financial operations for this
  -- client and prevents double-spending.
  -- ============================================================

  SELECT *
    INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_client_id
  FOR UPDATE;

  IF v_wallet.id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;


  -- ============================================================
  -- 4. IDEMPOTENCY CHECK
  --
  -- Because the wallet is already locked, concurrent errand
  -- creation requests for this client cannot pass this check
  -- simultaneously.
  -- ============================================================

  SELECT *
    INTO v_existing_transaction
  FROM public.transactions
  WHERE user_id = p_client_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_existing_transaction.id IS NOT NULL THEN

    SELECT *
      INTO v_existing_errand
    FROM public.errands
    WHERE id = v_existing_transaction.errand_id
      AND client_id = p_client_id;

    IF v_existing_errand.id IS NULL THEN
      RAISE EXCEPTION 'Idempotency record exists without matching errand';
    END IF;

    -- Same key must represent the same logical request.
    IF v_existing_errand.title IS DISTINCT FROM p_title
       OR v_existing_errand.description IS DISTINCT FROM p_description
       OR v_existing_errand.price IS DISTINCT FROM p_price THEN
      RAISE EXCEPTION 'Idempotency key already used with different request data';
    END IF;

    RETURN v_existing_errand;
  END IF;


  -- ============================================================
  -- 5. BALANCE CHECK
  -- ============================================================

  IF COALESCE(v_wallet.balance, 0) < p_price THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;


  -- ============================================================
  -- 6. CALCULATE RUNNER PAYOUT
  -- ============================================================

  v_payout_amount := pg_catalog.floor(p_price * 0.8);


  -- ============================================================
  -- 7. MOVE MONEY INTO ESCROW
  -- ============================================================

  UPDATE public.wallets
  SET
    balance = COALESCE(balance, 0) - p_price,
    escrow_balance = COALESCE(escrow_balance, 0) + p_price
  WHERE id = v_wallet.id;


  -- ============================================================
  -- 8. CREATE ERRAND
  -- ============================================================

  INSERT INTO public.errands (
    title,
    description,
    client_id,
    price,
    payout_amount,
    status,
    escrow_status,
    escrow_locked_at
  )
  VALUES (
    p_title,
    p_description,
    p_client_id,
    p_price,
    v_payout_amount,
    'created',
    'locked',
    now()
  )
  RETURNING *
  INTO v_errand;


  -- ============================================================
  -- 9. CREATE ESCROW LEDGER ENTRY
  -- ============================================================

  INSERT INTO public.transactions (
    user_id,
    errand_id,
    amount,
    type,
    status,
    idempotency_key
  )
  VALUES (
    p_client_id,
    v_errand.id,
    p_price,
    'escrow_lock',
    'completed',
    p_idempotency_key
  );


  -- ============================================================
  -- 10. RETURN CREATED ERRAND
  -- ============================================================

  RETURN v_errand;
END;
$$;


-- ==============================================================
-- Restrict direct execution.
-- The API uses the Supabase service role.
-- ==============================================================

REVOKE ALL ON FUNCTION public.create_errand_atomic(
  uuid,
  text,
  text,
  numeric,
  text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.create_errand_atomic(
  uuid,
  text,
  text,
  numeric,
  text
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_errand_atomic(
  uuid,
  text,
  text,
  numeric,
  text
) TO service_role;
