---
Title: Current Sprint — Sprint 4: Runner Verification & KYC
Purpose: Define the active sprint's goal, scope, blockers, and Definition of Done.
Owner: Engineering Lead
Status: Active
Version: 1.0
Last Updated: 2026-07-19
Read After: NEXT.md
Related: CURRENT_TASK.md, SECURITY.md, ROADMAP.md
---

# CURRENT_SPRINT.md — Sprint 4: Runner Verification & KYC

---

## Sprint goal

Deliver **Runner Verification & KYC**: runners must complete KYC (identity + bank details) and be verified before they can accept errands and receive payouts. Every step must increase user trust.

## Current status: **BLOCKED on infrastructure recovery**

Sprint 4 cannot safely proceed until the repository is the source of truth and the security posture is verified. This gate is intentional (see [DECISIONS.md ADR-002](./DECISIONS.md)).

### Recovery gate (must complete first)
- [x] Recover production `public` schema (read-only `supabase db dump`) → [supabase/recovery/recovered_public_schema.sql](../../supabase/recovery/recovered_public_schema.sql)
- [x] Produce schema recovery review → [docs/recovery/sprint4-schema-recovery-review.md](../recovery/sprint4-schema-recovery-review.md)
- [ ] Verify security findings SEC-1…SEC-6 with read-only queries (Migration Plan Step 1) — **started, paused for EOS doc sprint**
- [ ] Promote recovered SQL to a baseline migration; retire phantom empty migration `20260718111426_remote_schema.sql`
- [ ] Reconcile migration history (deferred; requires approval — writes remote metadata)

### KYC feature scope (after gate)
- [ ] Decide **canonical KYC store** (ARCH-2 / [DECISIONS.md ADR-007](./DECISIONS.md))
- [ ] Decide **identity model** (`auth.users` vs `public.users`, ARCH-1 / ADR-006)
- [ ] KYC data model + RLS (least privilege; PII encrypted/tokenized)
- [ ] Supabase **Storage bucket** for KYC documents (does not exist yet) + access policies
- [ ] Backend KYC route (`services/api/routes/kyc.js` is currently a stub — only `POST /verify` returning `{success:true}`)
- [ ] KYC service + validation (`zod`)
- [ ] Mobile KYC flow (`apps/mobile/screens/KycScreen.tsx`) wired end-to-end
- [ ] Runner verification state → gating errand acceptance & payouts
- [ ] Tests for the complete KYC flow

## Known blockers (top of list)
1. Security findings SEC-1…SEC-4 (CRITICAL/HIGH) — must be verified and remediated; KYC must not be built on an open schema.
2. Canonical KYC store undecided (data fragmented across 3 tables).
3. KYC document Storage bucket missing.
4. `services/api/routes/kyc.js` is a placeholder stub.

## Definition of done
- Repository is source of truth (baseline migration committed).
- SEC-1…SEC-6 verified and remediated via forward migrations.
- Canonical KYC store chosen and documented.
- End-to-end KYC flow works: submit → store (encrypted PII) → verify → runner marked verified → gated actions unlocked.
- All state protected by RLS; no plaintext credentials/PII.
