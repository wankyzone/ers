# ERS Financial Security Audit & Remediation

**Audit date:** 10 November 2026  
**Repository:** `wankyzone/ers`  
**Base:** `main` at `9b31d7211089a172e15e6b8fce512f75f3a725b7`  
**Working branch:** `security/ers-financial-hardening`  
**Commercial rule:** ERS 20% / runner 80%

## Executive summary

The source review identified weaknesses in wallet identity, withdrawals, transfer settlement, escrow payout validation, signup role assignment, profile policies, and default database privileges.

The remediation now adds:
- authenticated, identity-bound wallet reads;
- fail-closed withdrawal and bank-payout endpoints until a complete safe payout workflow exists;
- atomic, idempotent Paystack transfer settlement;
- a commission subledger and balanced double-entry journal for every escrow release;
- server-managed profile roles and KYC-based runner promotion;
- restrictive RLS/table/function grants and safer default privileges;
- regression tests for financial and authorization invariants.

**No production database was queried or modified.** The new migrations have not been applied or executed in a local Supabase instance in this session. The findings about existing database policies are derived from the repository's recovered schema and security documentation, not a live catalog query.

## Financial accounting design

### Approved split

For an errand with gross amount (G):
- runner payout = `floor(G * 0.80)`;
- ERS commission = `G - runner payout`;
- invariant: `gross_amount = runner_amount + commission_amount`.

This preserves the agreed 80% runner / 20% ERS economics, subject to integer-naira rounding.

### Commission subledger

`platform_commission_entries` records one immutable recognition record per released errand:
- errand, client, runner;
- gross amount, runner amount, ERS commission;
- currency (NGN), recognition timestamp, source, and status.

The unique errand key prevents duplicate recognition. Historical confirmed/released errands are backfilled using the actual stored payout amount. Where the legacy release logic used its 80% fallback for a null payout, the same fallback is used. Invalid historical records are quarantined in `platform_commission_reconciliation_exceptions`; the migration does not rewrite historical wallet balances or runner payouts.

### Double-entry journal

Each escrow release also posts a balanced journal entry with three account lines:

| Account | Side | Amount |
|---|---|---:|
| Client escrow liability | Debit | Gross errand amount |
| Runner wallet liability | Credit | Runner payout (80%) |
| Platform commission revenue | Credit | ERS commission (20%) |

The journal header enforces equal debit and credit totals. Deferred database triggers verify that the posted lines balance to the header at transaction commit. Commission recognition, runner wallet credit, escrow release, errand confirmation, and journal posting happen in the same database transaction.

The admin analytics and dashboard revenue values now read from the recognized commission subledger rather than recalculating commission from errand rows.

**Accounting boundary:** this recognizes ERS commission in the internal ledger; it does not itself transfer funds from Paystack to an ERS bank account. Provider settlement, cash reconciliation, and bank disbursement remain a separate treasury workflow.

## Findings and remediation

| ID | Severity | Finding | Remediation |
|---|---|---|---|
| FIN-01 | Critical | `GET /wallet` and `GET /api/wallet` trusted caller-supplied `x-user-id` while using the service-role client. | Both require Wanky Protect authentication and derive ownership from `req.user.id`; response fields are explicitly selected. KYC document upload now also requires authentication and derives the storage owner from the verified profile. |
| FIN-02 | Critical | Legacy Paystack withdrawal trusted `x-runner-id` and used a non-atomic read/check/transfer/write sequence. | Withdrawal endpoints return HTTP 501 and runner authorization is required on legacy routes. Do not re-enable before the full payout workflow is implemented. |
| FIN-03 | High | Legacy withdrawal/OTP code referenced undefined dependencies or returned success-shaped placeholders. | Legacy implementations are replaced with explicit unavailable responses. |
| FIN-04 | High | Recipient/bank setup placeholders did not establish secure bank ownership or durable recipient persistence. | Recipient and bank mutation endpoints fail closed with HTTP 501. Account resolution requires authentication. |
| FIN-05 | High | PIN setup/verification trusted `x-user-id`; OTP verification was not a real challenge validation flow. | PIN/OTP endpoints fail closed until step-up authentication, durable attempt counters, cooldowns, delivery, and recovery are implemented. |
| FIN-06 | High | Transfer failure webhook used a non-atomic wallet refund; transfer success did not sufficiently scope settlement. | Webhooks call `settle_paystack_withdrawal_atomic`, which locks the transaction, validates provider/type/reference/amount, and refunds a failed transfer once. |
| FIN-07 | High | Escrow release trusted stored payout values without enforcing the agreed split. | Release validates `payout_amount = floor(price * 0.8)` and rejects mismatches for manual review. |
| FIN-08 | High | Dispute update could overwrite a concurrently changed escrow state. | Optimistic state predicate prevents a stale dispute update from replacing a changed escrow state. |
| FIN-09 | High | Signup trigger in recovered schema sourced profile role from client-controlled `raw_user_meta_data.role`. | New Auth users receive `client` regardless of signup metadata. Runner promotion is a service-role-only atomic KYC approval. |
| FIN-10 | High | Recovered schema contained permissive profile INSERT policies, including `WITH CHECK (true)`. | Known permissive/overlapping policies are dropped. Client-side profile INSERT/UPDATE grants are removed; users may read only their own profile. |
| FIN-11 | High | Recovered default privileges granted broad access to future public tables, sequences, and functions. | Default privileges are revoked for `PUBLIC`, `anon`, and `authenticated`; public-schema RPC execution is revoked from client roles. |
| FIN-12 | High | Wallet, payment, errand, and operational tables had broad grants and/or incomplete RLS coverage in the recovered schema. | RLS is enabled across financial/identity/operational tables. Client grants are reduced to RLS-scoped SELECT on profiles, wallets, and errands. Financial writes remain backend/service-role only. |
| FIN-13 | Medium | Transaction history was an unauthenticated placeholder. | Replaced with authenticated, user-scoped transaction history. |
| FIN-14 | Medium | Analytics inferred platform revenue directly from errand price/payout fields. | Revenue metrics now read recognized commission ledger entries. |

## Database role and RLS policy

### Signup and role assignment

- New users are always created as `client`, even if signup metadata requests `runner` or `admin`.
- Client-side profile INSERT and UPDATE are not granted.
- Users can SELECT only their own profile.
- A profile role change is rejected unless the request is executing under a trusted service-role context.
- Runner access is granted only by the admin KYC approval endpoint through `approve_runner_kyc_atomic`.
- The KYC RPC locks the pending application, validates required identity/bank evidence, and atomically marks KYC approved, promotes the profile to `runner`, and provisions the operational `runners` record required by errand dispatch.
- The mobile app refreshes its profile-derived role when returning to the foreground, so an approved runner does not have to trust stale signup metadata.
- Admin roles are not created through public signup; existing admin accounts are preserved for separate account review.

The mobile app now uses the shared Supabase auth client, no longer sends role metadata at signup, and resolves the app role from the RLS-protected profile. It does not create or upsert profiles from the client.

### Client table access

RLS is enabled for:
`profiles`, `wallets`, `transactions`, `payments`, `errands`, `errand_events`, `errand_logs`, `users`, `kyc_profiles`, `otp_codes`, `user_devices`, `jobs`, `job_logs`, `system_logs`, `orchestrator_retry_log`, `runners`, `audit_logs`, `platform_commission_entries`, `platform_commission_reconciliation_exceptions`, `financial_journal_entries`, and `financial_journal_lines`.

Client-facing database grants are restricted:
- `authenticated` can SELECT its own profile and wallet, and participant/available errands under RLS.
- `anon` has no access to those financial/identity tables.
- Client roles cannot directly INSERT/UPDATE wallets, transactions, payments, profiles, KYC records, or journal entries.
- Client roles cannot execute public-schema RPCs; backend code uses the server-only service-role client.

## Files changed

### API and mobile
- `services/api/app.js`
- `services/api/routes/errands.js`
- `services/api/routes/paystack.js`
- `services/api/routes/pin.js`
- `services/api/routes/otp.js`
- `services/api/routes/banks.js`
- `services/api/routes/transactions.js`
- `services/api/routes/storage.js`
- `services/api/routes/kyc.js`
- `services/api/routes/storage.js`
- `services/api/services/kycService.js`
- `services/api/services/analyticsService.js`
- `services/api/services/dashboardService.js`
- `apps/mobile/screens/AuthScreen.tsx`
- `apps/mobile/screens/KycScreen.tsx`
- `apps/mobile/src/providers/AuthProvider.tsx`
- `apps/mobile/src/services/api.ts`
- `apps/mobile/src/services/api.ts`

### Database
- `supabase/migrations/202611100001_financial_security_hardening.sql`
- `supabase/migrations/202611100003_commission_ledger_and_role_rls_hardening.sql`

### Tests
- `services/api/tests/paystackWithdrawalSettlement.integration.test.js`
- `services/api/tests/releaseEscrow.integration.test.js`
- `services/api/tests/supabaseFinancialRls.integration.test.js`
- Existing auth/escrow/payment test fixtures updated for server-created profiles and service-managed test roles.

## ERS website integration finding

The separate `wankyzone/ers-website` repository was inspected to answer whether this backend work automatically protects the current website.

The current website is primarily a marketing/waitlist application. Its `app/api/errands/route.ts` is a mock endpoint: it logs a submitted task and returns a success-shaped response without creating an ERS errand or invoking the secured backend. The reviewed website code does not currently implement wallet, transaction, or Paystack flows against this backend.

Therefore:
- Any future web customer experience that calls this backend and uses the same Supabase project will inherit the API and RLS protections in this PR.
- The existing marketing website is **not automatically connected** by this PR.
- Before web-first customer launch, replace the mock errand endpoint with authenticated calls to the secured ERS API, use the same trusted profile-role model, and add web-specific integration tests.
- Do not interpret the current mock endpoint's success response as a persisted errand.

This website integration is a separate workstream and is not modified by this backend PR.

## Live Supabase read-only verification — 10 November 2026

Connected project: `ers-backend` (`acspvovspjhqeboqbgjh`, `eu-west-2`). The project reports `ACTIVE_HEALTHY`. No production DDL or data mutation was performed during this inspection.

### Migration state

The live migration history ends at `20260909103216_sprint6_paystack_wallet_funding`. The proposed November financial-security migrations are not applied.

### Confirmed live catalog findings

- `public.handle_new_user()` is SECURITY DEFINER and inserts `new.raw_user_meta_data ->> 'role'`, defaulting to `client`. This is not the hardened client-only signup implementation.
- `anon` and `authenticated` both currently have EXECUTE on `handle_new_user()`.
- The live `auth.users` trigger is still named `on_auth_user_created`; the proposed migration replaces it with one trigger bound to the hardened function.
- The live `profiles` table has several overlapping INSERT policies, including `WITH CHECK (true)`; it also has overlapping SELECT and UPDATE policies.
- The live `errands` table still has client INSERT/UPDATE and runner UPDATE policies.
- The live database grants table privileges to both `anon` and `authenticated` across all 18 existing public tables, including `wallets`, `transactions`, `kyc_profiles`, `audit_logs`, and `users`.
- Default privileges for both `postgres` and `supabase_admin` grant broad table, sequence, and function privileges to client roles.
- All 18 current public tables have RLS enabled, but 13 have no policies. This is deny-by-default at the RLS layer only where client grants are present; broad table grants remain and must be revoked.
- The Supabase Security Advisor also reports leaked-password protection disabled.

### Proposed migration changes after live review

The branch migration now revokes client privileges across all existing public tables and sequences, not just a hard-coded subset, grants service-role table access, and revokes client defaults for both `postgres` and `supabase_admin`. The security regression tests now check the actual seven-argument `create_errand_atomic` signature, the signup trigger function grants, default privileges, and legacy table grants.

### Validation still outstanding

The migration has not yet been executed against an isolated database. A temporary Supabase development branch is required to verify the DDL, historical commission backfill, trigger binding, default privileges, RLS behavior, and integration tests before any production rollout.
## Remaining production gates

1. **Local database validation:** apply all three migrations to a disposable Supabase instance; verify function creation, deferred journal constraints, RLS, grants, and historical backfill.
2. **Live read-only verification:** inspect the production `auth.users` trigger binding, effective policies, grants, default privileges, and migration history before any production apply.
3. **Existing admin review:** confirm the identities that currently hold `admin` role; the migration intentionally does not demote existing admins automatically.
4. **KYC data protection:** BVN and bank account details are still stored in `kyc_profiles`; field-level encryption/tokenization and retention controls remain necessary.
5. **Treasury reconciliation:** reconcile recognized platform commission to actual Paystack settlement balances and ERS bank receipts.
6. **Withdrawals:** remain disabled until atomic reservation, idempotency, verified recipient ownership, KYC/risk limits, PIN/OTP, unknown-state reconciliation, and reversal handling are implemented.
7. **Runtime checks:** run API/mobile tests, a local migration reset, Paystack sandbox tests, and admin-dashboard UAT.

## Validation status

- [x] Dedicated branch created from the inspected `main` commit.
- [x] Source changes and two forward migrations committed.
- [x] Commission subledger and balanced journal added to escrow release.
- [x] RLS/role hardening and regression tests added.
- [ ] Node/API test suite executed.
- [ ] Supabase migrations applied and verified locally.
- [ ] Production RLS/grants/trigger inspected read-only.
- [ ] Paystack sandbox transfer/webhook validation.
- [ ] Production treasury reconciliation.

**Release recommendation:** keep the PR in draft. Do not apply the migrations to production or enable withdrawals until the local test suite passes and the remaining production gates are closed.
