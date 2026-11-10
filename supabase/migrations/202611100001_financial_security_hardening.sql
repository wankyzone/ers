-- ERS financial security hardening: idempotent Paystack transfer settlement.
--
-- A transfer webhook must never mutate a wallet with a read/modify/write
-- sequence in the API. This function serializes settlement on the ledger row
-- and refunds a failed transfer exactly once.

CREATE OR REPLACE FUNCTION public.settle_paystack_withdrawal_atomic(
  p_reference text,
  p_outcome text
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_transaction public.transactions%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
BEGIN
  IF p_reference IS NULL OR pg_catalog.btrim(p_reference) = '' THEN
    RAISE EXCEPTION 'Transfer reference is required';
  END IF;

  IF p_outcome IS NULL OR p_outcome NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid transfer outcome';
  END IF;

  SELECT *
    INTO v_transaction
  FROM public.transactions
  WHERE reference = p_reference
    AND type IN ('withdraw', 'withdrawal')
  FOR UPDATE;

  IF v_transaction.id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal transaction not found';
  END IF;

  IF v_transaction.status = p_outcome THEN
    RETURN v_transaction;
  END IF;

  IF v_transaction.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Withdrawal cannot be settled from status %', v_transaction.status;
  END IF;

  IF v_transaction.amount IS NULL OR v_transaction.amount <= 0 THEN
    RAISE EXCEPTION 'Invalid withdrawal amount';
  END IF;

  IF p_outcome = 'failed' THEN
    SELECT *
      INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_transaction.user_id
    FOR UPDATE;

    IF v_wallet.id IS NULL THEN
      RAISE EXCEPTION 'Withdrawal wallet not found';
    END IF;

    UPDATE public.wallets
    SET available_balance = COALESCE(available_balance, 0) + v_transaction.amount
    WHERE id = v_wallet.id;
  END IF;

  UPDATE public.transactions
  SET status = p_outcome
  WHERE id = v_transaction.id
  RETURNING *
  INTO v_transaction;

  RETURN v_transaction;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_paystack_withdrawal_atomic(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.settle_paystack_withdrawal_atomic(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_paystack_withdrawal_atomic(text, text) TO service_role;
