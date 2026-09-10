-- Sprint 6: Harden Paystack wallet funding
--
-- Guarantees:
-- 1. Every Paystack payment is associated with one unique provider reference.
-- 2. Payment ownership is tied to the authenticated ERS user.
-- 3. Wallet credit and transaction completion are atomic.
-- 4. Repeated verification/webhook delivery cannot double-credit a wallet.
-- 5. Invalid payment amount or ownership cannot mutate balances.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS reference text;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_provider text;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_key
  ON public.transactions (reference)
  WHERE reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_user_reference_idx
  ON public.transactions (user_id, reference)
  WHERE reference IS NOT NULL;


-- Atomically complete a verified Paystack wallet funding transaction.
--
-- The transaction must already exist as a pending Paystack deposit.
-- The API/webhook is responsible for verifying the payment with Paystack
-- and validating ownership + amount before calling this function.
--
-- The function guarantees:
-- 1. The wallet is locked before financial mutation.
-- 2. The payment transaction is locked before state mutation.
-- 3. A Paystack reference can only be credited once.
-- 4. Wallet credit and transaction completion are atomic.
-- 5. Repeated delivery of the same payment is idempotent.
-- 6. A reference cannot be reused for another user or amount.

CREATE OR REPLACE FUNCTION public.credit_paystack_wallet_atomic(
  p_user_id uuid,
  p_reference text,
  p_amount numeric
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_transaction public.transactions%ROWTYPE;
BEGIN
  -- ============================================================
  -- 1. VALIDATE INPUT
  -- ============================================================

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF p_reference IS NULL OR pg_catalog.btrim(p_reference) = '' THEN
    RAISE EXCEPTION 'Payment reference is required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid payment amount';
  END IF;


  -- ============================================================
  -- 2. ENSURE + LOCK USER WALLET
  -- ============================================================

  INSERT INTO public.wallets (
    user_id,
    balance,
    available_balance
  )
  VALUES (
    p_user_id,
    0,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
    INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet.id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;


  -- ============================================================
  -- 3. LOCK + VALIDATE PAYMENT TRANSACTION
  -- ============================================================

  SELECT *
    INTO v_transaction
  FROM public.transactions
  WHERE reference = p_reference
  FOR UPDATE;

  IF v_transaction.id IS NULL THEN
    RAISE EXCEPTION 'Payment transaction not found';
  END IF;

  IF v_transaction.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Payment reference belongs to another user';
  END IF;

  IF v_transaction.amount IS DISTINCT FROM p_amount THEN
    RAISE EXCEPTION 'Payment reference amount mismatch';
  END IF;

  IF v_transaction.payment_provider IS DISTINCT FROM 'paystack' THEN
    RAISE EXCEPTION 'Payment reference belongs to another provider';
  END IF;

  IF v_transaction.type IS DISTINCT FROM 'deposit' THEN
    RAISE EXCEPTION 'Invalid payment transaction type';
  END IF;


  -- ============================================================
  -- 4. IDEMPOTENT SUCCESS PATH
  -- ============================================================

  IF v_transaction.status = 'completed' THEN
    RETURN v_transaction;
  END IF;

  IF v_transaction.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Payment transaction cannot be completed from its current status';
  END IF;


  -- ============================================================
  -- 5. CREDIT WALLET
  -- ============================================================

  UPDATE public.wallets
  SET
    balance = COALESCE(balance, 0) + p_amount,
    available_balance = COALESCE(available_balance, 0) + p_amount
  WHERE id = v_wallet.id;


  -- ============================================================
  -- 6. COMPLETE EXISTING LEDGER ENTRY
  -- ============================================================

  UPDATE public.transactions
  SET status = 'completed'
  WHERE id = v_transaction.id
  RETURNING *
  INTO v_transaction;

  RETURN v_transaction;
END;
$$;


REVOKE ALL ON FUNCTION public.credit_paystack_wallet_atomic(
  uuid,
  text,
  numeric
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.credit_paystack_wallet_atomic(
  uuid,
  text,
  numeric
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.credit_paystack_wallet_atomic(
  uuid,
  text,
  numeric
) TO service_role;
