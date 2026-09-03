-- Sprint 6: Lock down errand status lifecycle
--
-- Canonical lifecycle:
--   created -> accepted -> completed -> confirmed
--
-- This migration makes accepted -> completed atomic and server-authoritative.
-- Existing accept_errand_atomic() and release_escrow_atomic() remain the
-- authorities for their respective lifecycle transitions.

CREATE OR REPLACE FUNCTION public.complete_errand_atomic(
  p_runner_id uuid,
  p_errand_id uuid
)
RETURNS public.errands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_errand public.errands%ROWTYPE;
BEGIN
  -- ============================================================
  -- 1. VALIDATE INPUT
  -- ============================================================

  IF p_runner_id IS NULL THEN
    RAISE EXCEPTION 'Runner ID is required';
  END IF;

  IF p_errand_id IS NULL THEN
    RAISE EXCEPTION 'Errand ID is required';
  END IF;


  -- ============================================================
  -- 2. LOCK + VALIDATE ERRAND
  --
  -- The row lock serializes concurrent lifecycle operations.
  -- ============================================================

  SELECT *
    INTO v_errand
  FROM public.errands
  WHERE id = p_errand_id
  FOR UPDATE;

  IF v_errand.id IS NULL THEN
    RAISE EXCEPTION 'Errand not found';
  END IF;


  -- ============================================================
  -- 3. AUTHORIZE ASSIGNED RUNNER
  -- ============================================================

  IF v_errand.assigned_runner_id IS DISTINCT FROM p_runner_id THEN
    RAISE EXCEPTION 'Runner is not assigned to this errand';
  END IF;


  -- ============================================================
  -- 4. ENFORCE LIFECYCLE TRANSITION
  --
  -- Only:
  --   accepted -> completed
  --
  -- is permitted by this function.
  -- ============================================================

  IF v_errand.status IS DISTINCT FROM 'accepted' THEN
    RAISE EXCEPTION 'Errand cannot be completed from its current state';
  END IF;


  -- ============================================================
  -- 5. ENFORCE ESCROW STATE
  --
  -- An accepted errand must still have locked escrow before
  -- completion can move it into awaiting_confirmation.
  -- ============================================================

  IF v_errand.escrow_status IS DISTINCT FROM 'locked' THEN
    RAISE EXCEPTION 'Errand escrow is not in the expected state';
  END IF;


  -- ============================================================
  -- 6. COMPLETE ERRAND
  -- ============================================================

  UPDATE public.errands
  SET
    status = 'completed',
    escrow_status = 'awaiting_confirmation',
    completed_at = pg_catalog.now()
  WHERE id = p_errand_id
    AND assigned_runner_id = p_runner_id
    AND status = 'accepted'
    AND escrow_status = 'locked'
  RETURNING *
  INTO v_errand;

  IF v_errand.id IS NULL THEN
    RAISE EXCEPTION 'Errand completion failed';
  END IF;


  -- ============================================================
  -- 7. RETURN COMPLETED ERRAND
  -- ============================================================

  RETURN v_errand;
END;
$$;

ALTER FUNCTION public.complete_errand_atomic(uuid, uuid)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.complete_errand_atomic(uuid, uuid)
  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.complete_errand_atomic(uuid, uuid)
  FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.complete_errand_atomic(uuid, uuid)
  TO service_role;
