# MEMORY (live — quick-reference index)

> **Runtime state** · Last Updated: 2026-07-19 · Pointers + ephemeral facts only. Canonical detail lives in `docs/ai/` (do not duplicate it here).

## Where the truth lives (pointers)
- Architecture / stack / data model → [docs/ai/ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md)
- Security standards & findings → [docs/ai/SECURITY.md](../docs/ai/SECURITY.md)
- Recovery runbook & state → [docs/ai/RECOVERY.md](../docs/ai/RECOVERY.md)
- Decisions (incl. open) → [docs/ai/DECISIONS.md](../docs/ai/DECISIONS.md)
- Current sprint / task → [docs/ai/CURRENT_SPRINT.md](../docs/ai/CURRENT_SPRINT.md) · [docs/ai/CURRENT_TASK.md](../docs/ai/CURRENT_TASK.md)

## Fast identifiers
- Supabase project ref: `acspvovspjhqeboqbgjh` · region `aws eu-west-2`.
- Recovered schema: `supabase/recovery/recovered_public_schema.sql` (18 tables, 1 function).
- Phantom empty migration: `supabase/migrations/20260718111426_remote_schema.sql`.
- KYC route stub: `services/api/routes/kyc.js` (`POST /verify` → `{success:true}`). Mobile: `apps/mobile/screens/KycScreen.tsx`.

## Ephemeral gotchas (not worth a permanent doc)
- `supabase db dump` can exit non-zero from a **PostHog telemetry timeout AFTER** writing the file — verify by file size, not exit code.
- `psql` is **not installed** in this environment; no `pg`/`postgres.js` node client either.
- Stray `tatus` file at repo root = junk from a mistyped `git diff` redirect; safe to delete.
