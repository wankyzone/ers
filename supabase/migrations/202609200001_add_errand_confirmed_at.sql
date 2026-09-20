-- Sprint 6: Persist client confirmation timestamp on errands.

ALTER TABLE public.errands
ADD COLUMN IF NOT EXISTS confirmed_at timestamp without time zone;
