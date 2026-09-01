-- Remove the obsolete 5-parameter atomic errand creation function.
-- The canonical Sprint 6 function now includes pickup and delivery locations.

DROP FUNCTION IF EXISTS public.create_errand_atomic(
  uuid,
  text,
  text,
  numeric,
  text
);

-- Preserve the original security model on the canonical function.
REVOKE ALL ON FUNCTION public.create_errand_atomic(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.create_errand_atomic(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  text
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_errand_atomic(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  text
) TO service_role;
