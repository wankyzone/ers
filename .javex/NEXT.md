# NEXT (live — canonical list of next actions)

> **Runtime state** · Last Updated: 2026-07-19 · Rewritten each session · This is the single source for "what happens next."

## Immediate (EOS pause)
1. Human reviews the hardened EOS and approves it as **v1.0** (see EOS Definition of Done in [docs/ai/INDEX.md](../docs/ai/INDEX.md)).
2. Decide whether to commit the EOS + recovery artifacts to Git (recommended).

## When implementation resumes (strict order)
1. **Complete Migration Plan Step 1** — read-only verification of SEC-1…SEC-6; produce a report marking each **Confirmed / Not confirmed / Needs additional investigation**. Requires a Postgres client (`psql` not installed → install `pg` outside the repo).
2. Resolve [ADR-008](../docs/ai/DECISIONS.md): does the backend use `service_role` server-side and keep `anon` client-only? (Sets real SEC severity.)
3. Document the `auth.users` trigger binding for `handle_new_user()` (recovery gap).
4. Promote recovered SQL → baseline migration; retire phantom empty migration `20260718111426_remote_schema.sql` (local only).
5. Resolve [ADR-006](../docs/ai/DECISIONS.md) (identity) and [ADR-007](../docs/ai/DECISIONS.md) (canonical KYC store).
6. Resume Sprint 4 KYC implementation ([docs/ai/CURRENT_SPRINT.md](../docs/ai/CURRENT_SPRINT.md) → KYC feature scope).

## Requires explicit approval (never auto-run)
- `supabase db push`, `db reset`, `migration repair` (write/destroy).
- Any production data change.
- Editing the recovered baseline to "fix" issues (fixes are forward migrations — [ADR-004](../docs/ai/DECISIONS.md)).
