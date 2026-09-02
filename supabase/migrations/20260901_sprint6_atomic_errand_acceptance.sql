-- Sprint 6: Atomic and secure errand acceptance
--
-- Guarantees:
-- 1. Only verified, available runner accounts can accept errands.
-- 2. Runner identity is supplied by the trusted API layer.
-- 3. A runner may have only one active (accepted) errand.
-- 4. The target errand must be created and unassigned.
-- 5. Concurrent acceptance attempts are serialized by row locks.
-- 6. Assignment and acceptance timestamp are committed atomically.

CREATE OR REPLACE FUNCTION public.accept_errand_atomic(
  p_runner_id uuid,
  p_errand_id uuid
)
RETURNS public.errands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_runner public.runners%ROWTYPE;
  v_errand public.errands%ROWTYPE;
  v_active_errand public.errands%ROWTYPE;
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
  -- 2. LOCK + VALIDATE RUNNER PROFILE
  -- ============================================================

  SELECT *
    INTO v_profile
  FROM public.profiles
  WHERE id = p_runner_id
  FOR UPDATE;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Runner profile not found';
  END IF;

  IF v_profile.role IS DISTINCT FROM 'runner' THEN
    RAISE EXCEPTION 'Only runner accounts can accept errands';
  END IF;

  IF COALESCE(v_profile.verified, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Runner is not verified';
  END IF;


  -- ============================================================
  -- 3. LOCK + VALIDATE RUNNER RECORD
  -- ============================================================

  SELECT *
    INTO v_runner
  FROM public.runners
  WHERE id = p_runner_id
  FOR UPDATE;

  IF v_runner.id IS NULL THEN
    RAISE EXCEPTION 'Runner record not found';
  END IF;

  IF v_runner.is_available IS NOT TRUE THEN
    RAISE EXCEPTION 'Runner is unavailable';
  END IF;


  -- ============================================================
  -- 4. ENFORCE ONE-ACTIVE-ERRAND RULE
  --
  -- Runner row is locked above, so concurrent acceptance requests
  -- for the same runner are serialized before this check.
  -- ============================================================

  SELECT *
    INTO v_active_errand
  FROM public.errands
  WHERE assigned_runner_id = p_runner_id
    AND status = 'accepted'
  LIMIT 1
  FOR UPDATE;

  IF v_active_errand.id IS NOT NULL THEN
    RAISE EXCEPTION 'Runner already has an active errand';
  END IF;


  -- ============================================================
  -- 5. LOCK TARGET ERRAND
  --
  -- Concurrent runners attempting the same errand serialize here.
  -- ============================================================

  SELECT *
    INTO v_errand
  FROM public.errands
  WHERE id = p_errand_id
  FOR UPDATE;

  IF v_errand.id IS NULL THEN
    RAISE EXCEPTION 'Errand not found';
  END IF;

  IF v_errand.status IS DISTINCT FROM 'created'
     OR v_errand.assigned_runner_id IS NOT NULL THEN
    RAISE EXCEPTION 'Errand is no longer available';
  END IF;


  -- ============================================================
  -- 6. ACCEPT ERRAND
  -- ============================================================

  UPDATE public.errands
  SET
    status = 'accepted',
    assigned_runner_id = p_runner_id,
    accepted_at = pg_catalog.now(),
    assigned_at = pg_catalog.now()
  WHERE id = p_errand_id
    AND status = 'created'
    AND assigned_runner_id IS NULL
  RETURNING *
  INTO v_errand;

  IF v_errand.id IS NULL THEN
    RAISE EXCEPTION 'Errand acceptance failed';
  END IF;


  -- ============================================================
  -- 7. RETURN ACCEPTED ERRAND
  -- ============================================================

  RETURN v_errand;
END;
$$;


-- API executes this function using the Supabase service role.
REVOKE ALL ON FUNCTION public.accept_errand_atomic(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_errand_atomic(uuid, uuid)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_errand_atomic(uuid, uuid)
  TO service_role;
