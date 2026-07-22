---
Title: Architecture Decision Records (ADRs)
Purpose: Append-only log of significant engineering decisions, accepted and pending.
Owner: Architecture (CTO)
Status: Living
Version: 1.0
Last Updated: 2026-07-19
Read After: AGENT.md
Related: ARCHITECTURE.md, SECURITY.md, RECOVERY.md
---

# DECISIONS.md — Architecture Decision Records (ADRs)

Append-only log of significant engineering decisions. Never delete an ADR; supersede it with a new one. Format: Status · Context · Decision · Consequences.

---

## ADR-001 — Standardize on Supabase
- **Status:** Accepted
- **Context:** Need auth, DB, storage, realtime without building bespoke infrastructure.
- **Decision:** Use Supabase for Authentication, Authorization (RLS), PostgreSQL, Storage, Realtime, and Edge Functions where appropriate. Do not reinvent what Supabase provides.
- **Consequences:** RLS is our primary authorization mechanism. Team must follow official Supabase patterns.

## ADR-002 — Git is the single source of truth
- **Status:** Accepted
- **Context:** The primary Google account was lost, taking some engineering history with it. Production Supabase still exists, but the repo had drifted (empty migration, missing IaC).
- **Decision:** The Git repository — not chat history or the live database — is authoritative. Infrastructure must be recovered into version control before further feature work.
- **Consequences:** Sprint 4 is gated behind infrastructure recovery. See [RECOVERY.md](./RECOVERY.md).

## ADR-003 — Recover schema via `supabase db dump` (not `db pull`)
- **Status:** Accepted
- **Context:** A prior `supabase db pull` produced an empty migration (`20260718111426_remote_schema.sql`) because the remote migration-history table already marked that version as applied. Recovery policy: no production writes, no metadata changes.
- **Decision:** Recover the schema with the read-only `supabase db dump -s public`, which pg_dumps the live schema regardless of migration history and writes nothing to production. `db pull` was rejected because it writes a row to the remote `supabase_migrations` table.
- **Consequences:** Recovered SQL lives in `supabase/recovery/` for review, then is promoted to a baseline migration locally. Migration-history reconciliation (which writes remote metadata) is a separate, explicitly-approved step.

## ADR-004 — Security fixes ship as forward migrations
- **Status:** Accepted
- **Context:** The recovered baseline must faithfully represent production as-recovered.
- **Decision:** Never edit the recovered baseline to "fix" issues. All fixes (RLS, policy changes, credential/PII handling) ship as new, reversible forward migrations.
- **Consequences:** Clear, auditable history: baseline = reality recovered; subsequent migrations = intentional changes.

## ADR-005 — Engineering Operating System (EOS): `docs/ai/` + `.javex/`
- **Status:** Accepted
- **Context:** Chat history and model memory are unreliable and were lost once. Any AI/engineer must be able to clone the repo and resume within minutes.
- **Decision:** Maintain two documentation layers — `docs/ai/` (permanent record) and `.javex/` (live runtime state) — with a mandatory read order and session start/exit checklists ([AGENT.md](./AGENT.md)).
- **Consequences:** Every session must synchronize context from the repo and update runtime state on exit. The repo is self-describing.

## ADR-009 — `.javex/HANDOVER.md` is latest-only; history lives in CHANGELOG.md
- **Status:** Accepted (supersedes the earlier "append HANDOVER" instruction)
- **Context:** `.javex/` is defined as runtime-only state that must not accumulate history (EOS hardening, Phase 5). An append-only handover log contradicts that by growing historical content inside the runtime layer.
- **Decision:** `HANDOVER.md` holds **only the most recent handoff**. When a new handoff is written, the prior one is summarized into [CHANGELOG.md](./CHANGELOG.md) (the permanent history). The Session Exit Checklist and Automatic Behaviour in [AGENT.md](./AGENT.md) were updated to say "rewrite" rather than "append."
- **Consequences:** `.javex/` stays lightweight and truly runtime; history has one canonical home. Reviewer flagged this as a change from the original directive — the human owner may override if an append-only handover is preferred.

---

## Open decisions (PENDING — require the architecture owner)

## ADR-006 — Identity model: `auth.users` vs `public.users`
- **Status:** PENDING
- **Context:** Two user stores coexist (ARCH-1). `public.users` holds plaintext `password`/`withdrawal_pin`; `profiles`/`runners` key off `auth.users`; `jobs` FKs point at `public.users`.
- **Options:** (a) Standardize on `auth.users`, retire `public.users` (recommended). (b) Keep both with a documented bridge.
- **Decision:** _pending._

## ADR-007 — Canonical KYC store
- **Status:** PENDING
- **Context:** KYC data is fragmented across `kyc_profiles`, `profiles`, and `users.kyc_verified` (ARCH-2). Sprint 4 needs one source of truth.
- **Options:** (a) `kyc_profiles` keyed to `auth.users` as canonical, with a single verification-status source (recommended). (b) Consolidate into `profiles`.
- **Decision:** _pending._

## ADR-008 — Backend key model (service_role vs anon exposure)
- **Status:** PENDING (verification needed)
- **Context:** Real-world severity of SEC-1/2/5/6 depends on whether the backend uses `service_role` server-side and keeps `anon` client-only.
- **Decision:** _pending Migration Plan Step 1 verification._
