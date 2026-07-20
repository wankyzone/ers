---
Title: ERS Security Standards & Findings
Purpose: Define non-negotiable security standards and track live findings (SEC-*) and their verification status.
Owner: Security
Status: Stable
Version: 1.0
Last Updated: 2026-07-19
Read After: AGENT.md
Related: ARCHITECTURE.md, RECOVERY.md, DECISIONS.md
---

# SECURITY.md — ERS Security Standards & Findings

Security is a constraint on every feature, not a feature itself. This document defines the standards and tracks live findings.

---

## 1. Security standards (non-negotiable)

1. **RLS is the gate.** Every `public` table granted to `anon`/`authenticated` MUST have Row Level Security enabled with explicit, minimal policies. A granted table without RLS is world-open.
2. **Least privilege.** The `service_role` key is server-side only and must never reach a client. Clients use the `anon` key and are constrained by RLS.
3. **No plaintext secrets.** Passwords and PINs must be hashed (never stored reversibly). Regulated identifiers (BVN, NIN) must be encrypted or tokenized.
4. **Authorization never trusts client input.** Roles and permissions are never derived from user-supplied signup metadata or request bodies.
5. **Auditability.** Sensitive actions (KYC changes, payouts, role changes) should be recorded in `audit_logs`.
6. **Reversible, forward-only migrations.** Security fixes ship as new migrations, never as edits to the recovered baseline ([DECISIONS.md ADR-004](./DECISIONS.md)).
7. **Flag immediately.** Security concerns are surfaced the moment they are found, never silently worked around.

## 2. Current findings (from schema recovery review)

Source of truth for detail: [docs/recovery/sprint4-schema-recovery-review.md](../recovery/sprint4-schema-recovery-review.md) §2.

> **Verification status:** these findings are derived from the recovered schema dump. Live read-only verification (Migration Plan Step 1) was **started but paused** when the session switched to the EOS documentation sprint. Statuses below reflect that state — most are **Pending live verification**.

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| SEC-1 | 10 tables granted to `anon` with **RLS disabled** (`users`, `wallets`, `payments`, `errands`, `jobs`, `errand_events`, `errand_logs`, `job_logs`, `system_logs`, `orchestrator_retry_log`) | CRITICAL | Pending live verification |
| SEC-2 | `public.users` stores `password` and `withdrawal_pin` as plaintext `text`; no RLS + granted to `anon` | CRITICAL | Pending live verification |
| SEC-3 | `handle_new_user()` sets role from client-supplied signup metadata → privilege escalation | HIGH | Pending live verification (trigger binding on `auth.users`) |
| SEC-4 | Permissive `profiles` INSERT policies with `WITH CHECK (true)` → anyone can insert an `admin` profile | HIGH | Pending live verification |
| SEC-5 | Sensitive KYC PII (`kyc_profiles.bvn`, `profiles.nin`, account numbers) stored plaintext | HIGH | Pending live verification |
| SEC-6 | Inert (misleading) RLS policies on `errands`/`wallets` — policies defined but RLS not enabled | MEDIUM | Pending live verification |

### Highest-leverage open question
Does the backend use the **`service_role`** key server-side and keep the **`anon`** key client-only? This single fact governs the real-world severity of SEC-1, SEC-2, SEC-5, SEC-6. Recorded as an open decision in [DECISIONS.md](./DECISIONS.md).

## 3. Verification method (read-only, non-destructive)

Migration Plan Step 1 (see [recovery review §4](../recovery/sprint4-schema-recovery-review.md)) validates the findings with read-only queries. No writes, no `db push`/`reset`/`repair`.

- RLS state: `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r';`
- Grants: `information_schema.role_table_grants` filtered to `anon`/`authenticated`.
- Trigger binding: `SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgfoid='public.handle_new_user'::regproc;`
- Policies: `pg_policies` for schema `public`.
- Credential/PII population: aggregate counts + pattern checks only (never select raw secret values).

## 4. Remediation posture (planned, not yet applied)

Fixes ship as **forward migrations**, applied to staging first, then production via `db push` with explicit approval:

1. Enable RLS + minimal policies on all `anon`-granted tables (SEC-1, SEC-6).
2. Consolidate and lock down `profiles` policies; remove `WITH CHECK (true)` inserts (SEC-4).
3. Fix `handle_new_user()` to assign roles server-side, not from client metadata (SEC-3).
4. Retire plaintext credential storage; migrate to Supabase Auth / hashed values (SEC-2).
5. Encrypt/tokenize KYC identifiers as part of the Wanky Secure KYC design (SEC-5).

## 5. Secrets handling

- All secrets live in the gitignored root `.env`. `.env` and `.env.*` are covered by `.gitignore`.
- Never print secret values in logs or docs. The DB password is provided by the human and read via env only.
