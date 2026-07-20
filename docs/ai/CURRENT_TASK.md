---
Title: Active Engineering Task
Purpose: Define the current task and its progress. Canonical "next actions" live in .javex/NEXT.md.
Owner: Engineering Lead
Status: Active
Version: 1.0
Last Updated: 2026-07-19
Read After: CURRENT_SPRINT.md
Related: .javex/NEXT.md, RECOVERY.md, SECURITY.md
---

# CURRENT_TASK.md — Active Engineering Task

---

## Sprint
Sprint 4 — Runner Verification & KYC (see [CURRENT_SPRINT.md](./CURRENT_SPRINT.md))

## Task
**Infrastructure recovery — make Git the source of truth before implementing KYC.**

Currently **paused**: the session temporarily switched to the **EOS documentation sprint** (building `docs/ai/` + `.javex/`). No implementation, SQL, or migrations during this pause.

## Progress
- [x] Audited repository & Supabase project
- [x] Recovered production `public` schema (read-only `supabase db dump`)
- [x] Produced schema recovery review with SEC-1…SEC-6 and ARCH-1…ARCH-6
- [~] Migration Plan Step 1 (read-only verification of SEC findings) — **started, paused**
- [ ] Promote recovered SQL to baseline migration
- [ ] Reconcile migration history (deferred, needs approval)

## Next step
Canonical next actions live in [.javex/NEXT.md](../../.javex/NEXT.md). Immediate: complete **Migration Plan Step 1** (read-only verification of SEC-1…SEC-6 → report each Confirmed / Not confirmed / Needs additional investigation), then stop. (Requires a Postgres client; `psql` not installed.)

## Constraints
- No production writes. No `db push` / `db reset` / `migration repair` without explicit approval.
- Security fixes ship as forward migrations, never edits to the recovered baseline.
