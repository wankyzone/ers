# ERS Financial Security Audit & Remediation

**Audit date:** 10 November 2026  
**Repository:** `wankyzone/ers`  
**Base:** `main` at `9b31d7211089a172e15e6b8fce512f75f3a725b7`  
**Working branch:** `security/ers-financial-hardening`  
**Commercial rule preserved:** ERS 20% / runner 80%

## Executive summary

The source review found several high-risk weaknesses in wallet identity, withdrawal authorization, placeholder financial endpoints, transfer settlement, and escrow payout validation. This branch applies fail-closed API changes and database-side atomic settlement controls.

**No production database was queried or modified.** The migrations in this branch have not been applied. Tests have been added but have not been executed in a local Supabase/Postgres environment from this GitHub-only session. Findings below are based on source inspection; exploitability has not been runtime-tested.

## Findings and remediation

| ID | Severity | Finding | Remediation in this branch |
|---|---|---|---|
| FIN-01 | Critical | `GET /wallet` and `GET /api/wallet` trusted caller-supplied `x-user-id` while using the service-role client, allowing a caller to request another account's wallet. | Both routes now require Wanky Protect authentication and derive the wallet owner exclusively from `req.user.id`. Returned fields are explicitly selected. |
| FIN-02 | Critical | `POST /errands/paystack/withdraw` trusted `x-runner-id`, used a read/check/transfer/write sequence, and had no atomic reservation or idempotency protection. | The route is authenticated and runner-authorized but deliberately returns HTTP 501. Root-level withdrawal placeholders also return 501. No new withdrawals are accepted until a complete atomic payout workflow exists. |
| FIN-03 | High | Legacy `/errands/withdraw` referenced undefined dependencies and was not a trustworthy payout implementation. | Replaced with a fail-closed 501 response. Legacy OTP verification route is also disabled. |
| FIN-04 | High | Recipient creation and bank-management placeholders could return success-shaped responses without securely persisting or binding bank details to the authenticated runner. | Recipient and bank mutation endpoints now fail closed with HTTP 501. Paystack account resolution requires authentication. |
| FIN-05 | High | PIN set/verify trusted `x-user-id`; the four-digit PIN verification endpoint had no durable attempt limit or cooldown. OTP verification was a success-shaped placeholder. | PIN and OTP endpoints now fail closed with HTTP 501 (and require authentication/runner authorization where applicable) until step-up verification, durable throttling, and recovery controls are implemented. |
| FIN-06 | High | Paystack transfer failure webhook performed a non-atomic read/modify/write wallet refund, so duplicate deliveries or concurrent events could double-refund. Transfer success updated a transaction without type/provider scoping. | Webhook settlement now calls `settle_paystack_withdrawal_atomic`, which locks the withdrawal ledger row, validates its type/provider and provider amount, and refunds exactly once on a failed transfer. |
| FIN-07 | High | Escrow release trusted stored `payout_amount` with only a non-negative check; a corrupted value could exceed the errand price or depart from the approved split. | The new release migration enforces `floor(price * 0.8)` and fails closed for noncanonical stored payouts. Existing records are not silently rewritten; mismatches require manual review. |
| FIN-08 | High | Dispute handling used a stale read followed by an unconditional update, which could overwrite a concurrent escrow release state. | Dispute update now uses an optimistic escrow-state predicate and returns HTTP 409 if the state changed before the update. |
| FIN-09 | Medium | General transaction history route was an unauthenticated placeholder. | Replaced with authenticated, user-scoped transaction history and explicit response fields. |
| FIN-10 | Medium | Bank and OTP placeholders implied functionality that did not exist. | Endpoints now explicitly report that the capability is unavailable rather than returning success. |

## Financial invariants now enforced by code

1. Wallet reads through the API are scoped to the verified bearer-token identity.
2. No withdrawal or bank-recipient mutation is accepted while the safe payout workflow is incomplete.
3. Transfer settlement is keyed by provider reference and serialized by a database row lock.
4. A failed transfer refunds the wallet once; duplicate failure events do not refund again.
5. Transfer settlement rejects a provider amount that does not equal the ledger amount converted from naira to kobo.
6. Escrow release rejects a stored runner payout that differs from the approved 80% calculation.
7. A dispute cannot overwrite an escrow state that changed concurrently.

## Open risks / work required before production money movement

### OPEN-01 — Platform commission accounting

The escrow release function removes the full errand price from client escrow and credits 80% to the runner. Revenue analytics infer the remaining 20% as `price - payout_amount`, but the reviewed release path does not create a distinct platform commission ledger entry or credit a platform settlement account.

This is an accounting-model gap, not something to patch by inventing a wallet row. Before live launch, define a system-owned platform account / double-entry ledger and reconcile it against escrow release transactions and Paystack settlement balances.

### OPEN-02 — Withdrawals remain unavailable

This PR intentionally disables withdrawal initiation, bank-recipient creation, PIN, and OTP verification. Re-enabling them requires a complete design with:
- atomic balance reservation before contacting Paystack;
- unique idempotency key and internal withdrawal record before provider calls;
- authenticated runner ownership of the verified bank recipient;
- KYC and risk/limit enforcement;
- PIN step-up with durable attempt counters, cooldowns, and recovery;
- safe handling of provider timeouts and unknown transfer states;
- reconciliation for success, failure, reversal, and manual review.

Do not re-enable a transfer endpoint by simply removing the 501 response.

### OPEN-03 — Database role assignment and RLS verification

The API's authorization middleware trusts the role stored in the application profile. Repository recovery documentation describes historical self-insert profile policies that may permit an authenticated user to create a profile with an elevated role if no profile row already exists. The effective production policy set and signup-trigger behavior must be verified against the current database before launch. This audit did not have access to a live Supabase policy catalog.

### OPEN-04 — Production migration and runtime validation

Apply migrations only after review in a disposable/local Supabase database, then run the existing escrow and Paystack integration suites plus the new withdrawal-settlement tests. Validate the actual Paystack webhook payloads for transfer success/failure and reconcile any pending legacy withdrawal references before deployment.

## Files changed

- `services/api/app.js`
- `services/api/routes/errands.js`
- `services/api/routes/paystack.js`
- `services/api/routes/pin.js`
- `services/api/routes/otp.js`
- `services/api/routes/banks.js`
- `services/api/routes/transactions.js`
- `supabase/migrations/202611100001_financial_security_hardening.sql`
- `supabase/migrations/202611100002_enforce_ers_runner_split.sql`
- `services/api/tests/paystackWithdrawalSettlement.integration.test.js`
- `services/api/tests/releaseEscrow.integration.test.js`

## Validation status

- [x] Dedicated branch created from the inspected `main` commit.
- [x] API source changes committed to the branch.
- [x] Database migrations added to the branch; not applied.
- [x] Regression tests added.
- [ ] Node test suite executed.
- [ ] Local Supabase migrations applied and verified.
- [ ] Paystack sandbox transfer/webhook verification.
- [ ] Live RLS/profile-role policy review.
- [ ] Platform commission ledger design and reconciliation.

**Release recommendation:** Keep withdrawals disabled and do not enable production money movement until OPEN-01 through OPEN-04 have been closed and the integration tests pass.
