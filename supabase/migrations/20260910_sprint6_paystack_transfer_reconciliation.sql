-- Reconcile signed Paystack transfer events exactly once.
--
-- Wallet refund and transaction state changes are performed under the same
-- database transaction after locking the withdrawal ledger row.

CREATE OR REPLACE FUNCTION public.reconcile_paystack_transfer_atomic(
  p_reference text,
  p_event text,
  p_amount_minor bigint
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

  IF p_event IS NULL
     OR p_event NOT IN ('transfer.success', 'transfer.failed') THEN
    RAISE EXCEPTION 'Unsupported transfer event';
  END IF;

  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'Invalid transfer amount';
  END IF;

  SELECT *
    INTO v_transaction
  FROM public.transactions
  WHERE reference = p_reference
  FOR UPDATE;

  IF v_transaction.id IS NULL THEN
    RAISE EXCEPTION 'Transfer transaction not found';
  END IF;

  IF v_transaction.user_id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal owner is missing';
  END IF;

  IF v_transaction.type IS DISTINCT FROM 'withdraw' THEN
    RAISE EXCEPTION 'Reference is not a withdrawal';
  END IF;

  IF v_transaction.payment_provider IS NOT NULL
     AND v_transaction.payment_provider IS DISTINCT FROM 'paystack' THEN
    RAISE EXCEPTION 'Withdrawal belongs to another provider';
  END IF;

  IF v_transaction.amount IS NULL
     OR pg_catalog.round(v_transaction.amount * 100)::bigint
        IS DISTINCT FROM p_amount_minor THEN
    RAISE EXCEPTION 'Transfer amount mismatch';
  END IF;

  IF (p_event = 'transfer.success' AND v_transaction.status = 'completed')
     OR (p_event = 'transfer.failed' AND v_transaction.status = 'failed') THEN
    RETURN v_transaction;
  END IF;

  IF v_transaction.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Withdrawal is not pending';
  END IF;

  IF p_event = 'transfer.failed' THEN
    SELECT *
      INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_transaction.user_id
    FOR UPDATE;

    IF v_wallet.id IS NULL THEN
      RAISE EXCEPTION 'Withdrawal wallet not found';
    END IF;

    UPDATE public.wallets
    SET available_balance =
      COALESCE(available_balance, 0) + v_transaction.amount
    WHERE id = v_wallet.id;
  END IF;

  UPDATE public.transactions
  SET status = CASE
    WHEN p_event = 'transfer.success' THEN 'completed'
    ELSE 'failed'
  END
  WHERE id = v_transaction.id
  RETURNING *
  INTO v_transaction;

  RETURN v_transaction;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_paystack_transfer_atomic(
  text,
  text,
  bigint
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.reconcile_paystack_transfer_atomic(
  text,
  text,
  bigint
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reconcile_paystack_transfer_atomic(
  text,
  text,
  bigint
) TO service_role;
