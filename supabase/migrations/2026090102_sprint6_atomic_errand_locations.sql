-- Extend atomic errand creation with explicit pickup and delivery locations.
-- Existing financial and idempotency behavior remains unchanged.

CREATE OR REPLACE FUNCTION public.create_errand_atomic(
  p_client_id uuid,
  p_title text,
  p_description text,
  p_pickup_location text,
  p_delivery_location text,
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

  IF p_pickup_location IS NULL
     OR pg_catalog.btrim(p_pickup_location) = '' THEN
    RAISE EXCEPTION 'Pickup location is required';
  END IF;

  IF p_delivery_location IS NULL
     OR pg_catalog.btrim(p_delivery_location) = '' THEN
    RAISE EXCEPTION 'Delivery location is required';
  END IF;

  IF p_price IS NULL
     OR p_price <= 0
     OR p_price <> pg_catalog.trunc(p_price) THEN
    RAISE EXCEPTION 'Invalid price';
  END IF;

  IF p_idempotency_key IS NULL
     OR pg_catalog.btrim(p_idempotency_key) = '' THEN
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
  -- ============================================================

  SELECT *
  INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_client_id
  FOR UPDATE;


  -- ============================================================
  -- 4. CHECK IDEMPOTENCY
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
    WHERE id = v_existing_transaction.errand_id;

    IF v_existing_errand.id IS NOT NULL THEN
      RETURN v_existing_errand;
    END IF;

    RAISE EXCEPTION 'Idempotency key already used with different request data';
  END IF;


  -- ============================================================
  -- 5. CHECK BALANCE
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
    pickup_location,
    delivery_location,
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
    pg_catalog.btrim(p_pickup_location),
    pg_catalog.btrim(p_delivery_location),
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
