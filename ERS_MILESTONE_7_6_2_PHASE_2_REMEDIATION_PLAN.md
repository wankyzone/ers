# ERS Milestone 7.6.2 — Phase 2: Existing Remediation Review

## Executive summary

This is a read-only review of the existing backend security diffs, the untracked remediation test and SQL migration, Phase 1’s route trace, and the specified mobile authentication/PIN code. No code was changed except creation of this requested report. No tests, builds, database operations, migrations, or external requests were run.

The current unstaged backend changes improve several high-risk paths:

- `/wallet` now requires Supabase Bearer authentication, derives ownership from `req.user.id`, and returns only balance columns.
- Former Paystack withdrawal stubs now fail closed at `/withdraw`, `/api/withdraw`, `/errands/paystack/withdraw`, and `/api/errands/paystack/withdraw`.
- PIN set/verify are authenticated, use `req.user.id`, hash PINs, and only allow first-time PIN setup.
- Runner document upload now authenticates, requires `runner` role, derives the owner from the token, and checks file signatures.
- Transfer webhook reconciliation now delegates status/refund changes to an atomic SQL function and validates signed payload reference/amount in the handler.

These changes are **not ready to enable withdrawals**. `POST /errands/withdraw` and `/api/errands/withdraw` remain mounted and contain a transfer flow that references undeclared `db`, `compareHash`, `LIMITS`, and `paystack` identifiers. The source does not establish a safe, complete transfer lifecycle. `POST /errands/paystack/create-recipient` also remains unauthenticated and makes a Paystack API call. PIN verification has no visible attempt limiting, and `public.users` provisioning for new Auth identities is not established by checked-in application code or migrations.

The Phase 1 PIN mismatch needs a more precise interpretation. There are two separate mobile screens:

- The authenticated `apps/mobile/screens/CreatePinScreen.tsx` calls `/pin/set` using `src/config/api.ts`, which does not attach a Bearer token. It is registered in `AppStack`, but no navigation call to that route was found.
- The signup `apps/mobile/src/screens/auth/CreatePinScreen.tsx` is used by `AuthStack`, but currently only navigates to a profile placeholder. It does not call `/pin/set`.

The smallest compatible change for the legacy caller is to use the shared `src/services/api.ts` helper (which attaches the Supabase access token set by the active `AuthProvider`), remove the identity headers, and treat non-2xx responses as failure. When the signup-stack placeholder is later wired to persist a PIN, it must do so only after a valid authenticated session/token exists. This report does not implement that change.

## Evidence boundaries and repository state

- Backend branch: `feat/backend-security-hardening`
- HEAD: `9b31d7211089a172e15e6b8fce512f75f3a725b7`
- The inspected backend files were already modified/untracked before this report was created; they remain untouched.
- The prior Phase 1 report is untracked and was read as an input; it was not modified.
- Findings describe checked-in source and checked-in schema/migration snapshots only. No live Supabase schema or production route behavior was inspected.
- No environment settings or live secrets were read or printed. The remediation test source was inspected, but its test-only environment stubs are not operational configuration.

## Existing remediation review

### `services/api/app.js`

**Changes**

1. Adds raw-body parsing for both `/paystack/webhook` and `/api/paystack/webhook`.
2. Adds `authenticate` to `GET /wallet`; the query now uses `req.user.id` and selects only `balance`, `available_balance`, and `escrow_balance`.
3. Keeps `/api/wallet` as a forwarding alias to `/wallet`.
4. Changes `/withdraw` and `/api/withdraw` from success-shaped placeholders to HTTP 503.

**Security value and completeness**

- Wallet identity is no longer selected from `x-user-id`; the owner is the verified Supabase identity. Reducing the selected columns limits accidental wallet-field disclosure.
- These protections are complete for the top-level wallet handler in source. The `/api/wallet` alias relies on Express re-dispatch to the guarded `/wallet` route; the existing test exercises `/api/wallet`, but the route was not runtime-tested in this review.
- Returning 503 is the right fail-closed behavior for the two root withdrawal paths. It is not a secure payout implementation and must not be changed back to a success-shaped response.
- Raw parsing is required for Paystack signature validation and is set up for both webhook aliases. The test file exercises both aliases in webhook requests.

**Compatibility, tests, and database**

- Clients that previously supplied only `x-user-id` to `/wallet` will now receive 401. This is an intentional compatibility break in favor of authenticated identity. The shared mobile API helper can send Bearer auth when the provider has set its token.
- `securityRemediation.test.js` checks `/api/wallet` with no token, invalid token, and a forged identity header, and checks the restricted response columns. It does not separately exercise `/wallet` or `/api/errands/wallet`.
- No migration is needed for the wallet route change. The webhook alias change depends on existing Paystack webhook setup and the later atomic function migration for transfer events.

### `services/api/routes/errands.js`

**Changes**

- Replaces `POST /paystack/withdraw` with an unconditional 503 response. The route has no authentication middleware, but the current stub performs no side effect and ignores the request.

**Security value and completeness**

- This removes the prior handler that took `x-runner-id` and `recipient_code` from the request, read the wallet, called Paystack’s transfer API, and then performed separate wallet/transaction writes. The prior design did not bind the caller to a verified identity and was not atomic.
- The disablement is complete for `/errands/paystack/withdraw` and `/api/errands/paystack/withdraw`, because both mounts share the router.
- It does **not** disable `POST /errands/withdraw` and `/api/errands/withdraw`. Those separately mounted routes still contain payout logic. They begin with `authenticate` and use `req.user.id`, but have no explicit runner/approved-runner authorization and refer to `db`, `compareHash`, `LIMITS`, and `paystack` without definitions in this module. They also depend on `pin_hash`, `pin_attempts`, cooldown, bank and balance fields that are not established by the inspected `public.users` schema snapshot. They are incomplete and must remain disabled.
- `POST /paystack/create-recipient` remains unauthenticated. It accepts bank account details and calls Paystack to create a transfer recipient without binding the result to the authenticated user or an owned bank-account record. It should be disabled while withdrawals are unavailable, or later replaced with an authenticated, ownership-bound flow.

**Compatibility, tests, and database**

- Clients directly calling the Paystack withdrawal route now receive 503. Current mobile withdrawal code calls `/api/withdraw`, not this alias.
- The tests assert 503 for the root withdrawal and `/errands/paystack/withdraw` aliases and assert no Paystack transfer call. They do **not** cover `/errands/withdraw`, `/api/errands/withdraw`, or `create-recipient`.
- No database migration is needed to disable these routes. A future payout flow would require ledger, idempotency, and reconciliation guarantees; it cannot safely depend on these existing handlers.

### `services/api/routes/paystack.js`

**Changes**

- Transfer `success` and `failed` webhook events now validate a non-empty reference and positive safe-integer provider amount, then call `reconcile_paystack_transfer_atomic`.
- The prior direct status update and separate wallet refund writes are removed from the handler.
- The existing webhook signature validation remains in front of event processing; invalid signatures are rejected. `app.js` now preserves the raw body on both webhook aliases.

**Security value and completeness**

- Moving ledger state/refund logic into one database function prevents the API handler’s previous multi-statement partial-update pattern and supports idempotent retry handling.
- The handler is complete only if the matching SQL function is installed and the transaction schema/index prerequisites exist. The changed code returns 500 when the RPC fails; that is fail-closed for acknowledgement, but repeated provider delivery may continue until configuration is corrected.
- The associated SQL migration uses a row lock and updates the failed-withdrawal wallet refund and transaction state in the same function call. It rejects wrong reference/type/amount/provider and non-pending state, while allowing an already-terminal matching event to return idempotently.
- This is **webhook reconciliation only**, not a safe withdrawal initiation flow. It does not create a pending withdrawal transaction, reserve funds, verify a runner, choose an owned bank recipient, initiate a transfer, or provide an end-to-end withdrawal lifecycle.

**Compatibility, tests, and database**

- Event webhook responses may now be 500 when the RPC or migration is unavailable, rather than silently reporting successful reconciliation. This is correct fail-closed behavior but requires deployment ordering.
- The test file mocks Supabase RPC behavior. It covers invalid signature, transfer amount mismatch, failed-event replay, and repeated success events. It does not execute the PL/pgSQL function, test grants, real row locking, rollback, or concurrent database transactions.
- The route depends on `20260910_sprint6_paystack_transfer_reconciliation.sql`, and that migration in turn assumes the relevant `transactions` and `wallets` columns. The preceding checked-in `20260909_sprint6_paystack_wallet_funding.sql` adds `reference`, `payment_provider`, and a partial unique index on non-null transaction references. Apply/verify that prerequisite first in an isolated database. Do not infer the live schema from snapshots.

### `services/api/routes/pin.js`

**Changes**

- Adds `authenticate` directly to `/set`, `/create`, and `/verify`.
- Replaces identity from `x-user-id` with `req.user.id`.
- Validates PINs as four decimal digits; hashes new PINs with bcrypt.
- Sets a PIN only when `withdrawal_pin IS NULL`; a missing row or already-set PIN produces a conflict response.
- Verify reads the authenticated user’s PIN hash and compares it with bcrypt.

**Security value and completeness**

- These changes prevent a caller from selecting another user with `x-user-id`, storing a plaintext PIN, or overwriting an existing PIN through ordinary set/create calls.
- Authentication and per-account identity binding are complete in the handler source.
- `/verify` has no visible failed-attempt counter, rate limit, or lockout. A four-digit PIN has a limited search space; any production use must be protected by server-side attempt throttling. The dormant attempt logic in `/errands/withdraw` does not protect `/pin/verify` and is itself incomplete.
- There is no PIN reset route or verified reset flow. `/create` is an alias for the same one-time set operation, not a reset.
- The handlers read/write `public.users`. The checked-in schema snapshot has `withdrawal_pin` and `pin_set`, but does not establish an FK to `auth.users` or an Auth-user provisioning trigger. E2E tests manually insert `public.users` rows. No production provisioning guarantee was found in the inspected app/migration sources.

**Compatibility, tests, and database**

- Old clients that relied on `x-user-id` without a Bearer token will now receive 401. The legacy mobile screen’s helper does not attach Bearer auth, so it is incompatible if invoked.
- The tests cover unauthenticated access, forged identity headers, hashed PIN storage, duplicate set, verification, and malformed input. They do not test repeated incorrect PIN attempts, lockout, reset, or a token whose `public.users` row is absent.
- No schema migration is required if the target database already has `public.users.withdrawal_pin` and `pin_set`. Provisioning and any attempt-state design need separate schema review; do not assume matching UUIDs alone create a `public.users` row.

### `services/api/routes/storage.js`

**Changes**

- Adds direct `authenticate` and `authorize("runner")` middleware.
- Derives storage ownership from `req.user.id`, not `x-user-id`.
- Retains multipart field/type/size checks and adds JPEG, PNG, WebP, and PDF signature checks.
- Returns a generic upload failure instead of forwarding arbitrary internal error messages.

**Security value and completeness**

- Prevents unauthenticated upload, caller-selected identity, and ordinary client-role upload, assuming `authorize("runner")`’s profile role is correctly provisioned.
- The ownership query in `storageService` selects a pending KYC record by authenticated `user_id`, then updates that row. The route does not independently verify approved runner status; it trusts `req.user.role` from `profiles`.
- Signature checks establish that the initial bytes match the claimed format; they are not full file decoding/scanning. No client caller was found in the app source.

**Compatibility, tests, and database**

- Clients sending only identity headers are now rejected. No mobile/website caller of this endpoint was found.
- Tests cover client-role denial, forged identity headers, authenticated runner upload, and a fake PDF signature mismatch.
- No migration is introduced by this route diff. It assumes existing role/profile and KYC relationships; live-schema behavior remains unverified.

## Untracked remediation test review

`services/api/tests/securityRemediation.test.js` is an in-process HTTP test with mocked Supabase and Axios. It is useful source-level regression coverage, but has not been run.

| Area | Existing test coverage | Gaps |
|---|---|---|
| Wallet | Bearer required, invalid token rejected, forged `x-user-id` ignored, limited columns returned | Direct `/wallet` and `/api/errands/wallet` aliases; missing wallet row; no live RLS validation |
| PIN | Bearer required, ID from token, bcrypt hash, duplicate setup, valid verification, invalid format | Wrong-PIN repeated attempts/throttling, reset behavior, absent `public.users` row, actual UI-to-API token contract |
| Upload | Client denied, identity header ignored, runner owner used, file signature mismatch rejected | Pending/non-pending KYC cases, all file types, runner approval source, actual storage/database behavior |
| Disabled withdrawal paths | 503 on `/withdraw`, `/api/withdraw`, `/errands/paystack/withdraw`, `/api/errands/paystack/withdraw`; no Paystack call | `/errands/withdraw`, `/api/errands/withdraw`, both create-recipient mounts, `/paystack/recipient` placeholder |
| Webhook | Signed failed-event replay, transfer amount mismatch, invalid signature, duplicate success event | Actual SQL function, grants, transaction rollback, real concurrency/row locks, duplicate reference data, deployed raw-body configuration |

The tests do not substitute for the migration being applied in a disposable Supabase/Postgres project. The fake RPC's idempotency and locking behavior are assertions about the mock, not the database function.

## SQL migration review

`supabase/migrations/20260910_sprint6_paystack_transfer_reconciliation.sql`:

- Creates or replaces `public.reconcile_paystack_transfer_atomic(text, text, bigint)`.
- Reads and locks a transaction by reference; validates event, transaction type, owner, provider where set, amount, and pending/terminal state.
- For a failed transfer, locks the wallet and refunds `available_balance`; then sets terminal transaction status in the same function transaction.
- Uses `SECURITY DEFINER` with an empty `search_path`, schema-qualified tables, and `pg_catalog` calls.
- Revokes execution from `PUBLIC`, `anon`, and `authenticated`; grants execution to `service_role`.
- Does not create tables, triggers, policies, indexes, or directly rewrite existing rows. It is re-runnable in source because it uses `CREATE OR REPLACE` and repeatable revoke/grant statements.

**Dependencies and unresolved schema checks**

- Requires `public.transactions` to have `id`, `reference`, `user_id`, `type`, `payment_provider`, `amount`, and `status`, and `public.wallets` to have `id`, `user_id`, and `available_balance`.
- The prior checked-in wallet-funding migration adds `reference`, `payment_provider`, and a partial unique reference index. The function’s correctness assumes there cannot be multiple non-null rows with the same reference.
- Older checked-in schema snapshots are not a live-schema guarantee; the transaction shape varies across snapshots/migrations. Confirm the full schema and applied migration order in a disposable project before approval.
- Confirm function ownership and service-role execution behavior in the isolated database. The test mock does not verify SQL privilege behavior.
- This migration supports webhook reconciliation for an already-created withdrawal row. It does not authorize or implement withdrawals and must not be used as evidence that withdrawals can be enabled.

## PIN client/server and lifecycle findings

### Current mobile paths

1. `apps/mobile/src/navigation/RootNavigator.tsx` selects `AppStack` when `useAuth().user` exists and `AuthStack` otherwise. `apps/mobile/App.tsx` wraps this in the `AuthProvider` exported by `src/context/AuthContext.ts`.
2. The provider restores the Supabase session and subscribes to auth changes. It calls `setApiAuthToken(session?.access_token ?? null)` in both paths.
3. Shared `apps/mobile/src/services/api.ts` `apiFetch` adds `Authorization: Bearer <token>` when that provider-set token is available.
4. The legacy authenticated screen `apps/mobile/screens/CreatePinScreen.tsx` calls `/pin/set` through `apps/mobile/src/config/api.ts`, which adds no Bearer token. It sends `x-user-id` and `x-role`, which the backend correctly ignores. The route is declared in `AppStack`, but no navigation call to `CreatePin` was found in source.
5. The signup-flow `apps/mobile/src/screens/auth/CreatePinScreen.tsx` is registered in `AuthStack` and is reached from the OTP screen, but currently does not call an API. It displays that PIN storage is not connected and navigates to a profile placeholder.

### Minimal future client change

- For the legacy PIN API caller, import `apiFetch` from `src/services/api.ts`, remove `x-user-id` and `x-role`, and rely on the current provider’s verified session token. Check `res.ok` before showing “PIN Created”; show a useful error on 401/409/5xx.
- If an explicit per-screen guard is needed, use the `accessToken` already exposed by `useAuth` and do not call the route until it is non-null. Never replace Bearer authentication with identity headers.
- Do not wire persistence into the signup-stack screen until signup/OTP has produced a valid authenticated Supabase session. Reuse the same authenticated API contract; do not create a separate PIN identity flow.
- The screen must also handle `409` for a pre-existing PIN and must not claim success if no `public.users` row exists.

### Lifecycle and provisioning

- No application caller of `/pin/verify` was found. The remediation test calls it; this is test use, not a mobile product flow.
- No PIN reset route or reset UI/service was found. `/pin/create` aliases the one-time setup handler.
- `/pin/verify` has no attempt throttling or lockout in the handler. `/errands/withdraw` contains attempted cooldown/attempt code, but references undeclared dependencies and a distinct `pin_hash` field.
- `public.users` schema snapshots show a generated UUID primary key, email, role, `withdrawal_pin`, and `pin_set`; the snapshots do not show `id` referencing `auth.users.id`. No checked-in migration trigger or production API route was found that provisions `public.users` on Auth signup.
- E2E tests explicitly insert into `public.users` for their Auth fixtures, confirming the tests cannot establish automatic production provisioning.
- **Conclusion:** The checked-in code does not establish that new authenticated accounts receive a `public.users` record. Since PIN routes update/read that table by `req.user.id`, new users may receive 409/“PIN not set” behavior unless an out-of-repository database process provisions the row. Live provisioning remains unverified.

## Adjacent payout endpoints and callers

| Method and path(s) | Middleware and identity | Side effects/current completeness | Client evidence |
|---|---|---|---|
| `POST /withdraw`, `POST /api/withdraw` | No middleware; current handler ignores request and returns 503 | Disabled in current source; no financial operation | Mobile `withdrawWithPin` calls `/api/withdraw`; intentional 503 currently breaks payout UI |
| `POST /errands/paystack/withdraw`, `POST /api/errands/paystack/withdraw` | No middleware; current handler returns 503 | Former unauthenticated `x-runner-id`/caller-recipient transfer code replaced by fail-closed stub | No direct caller found |
| `POST /errands/withdraw`, `POST /api/errands/withdraw` | Direct `authenticate`; uses `req.user.id`; no explicit runner authorization | Still mounted; intended PIN/limits/KYC/bank/transfer flow references identifiers not imported/defined in module and has no demonstrated atomic ledger flow. Treat as incomplete, not as safely disabled. | Mobile calls `/api/withdraw`, not these paths; no caller found |
| `POST /errands/paystack/create-recipient`, `POST /api/errands/paystack/create-recipient` | No authentication or authorization; body supplies account details | Calls Paystack to create a transfer recipient; does not bind it to a verified identity or persist an owned bank record | Shared helper exports `createPaystackRecipient`, but its path is `/api/paystack/create-recipient`, which has no matching handler in `paystack.js`; no invocation of the helper was found |
| `POST /paystack/recipient`, `POST /api/paystack/recipient` | No auth | Placeholder returns a success-shaped fake recipient code; no Paystack call | No direct caller found |
| `POST /paystack/resolve-account`, `/paystack/resolve`, and `/api` aliases | No auth | Calls Paystack account resolution or forwards to it; no transfer is initiated | No concrete caller found in searched screens |
| `POST /paystack/webhook`, `/api/paystack/webhook` | Paystack HMAC validation; raw body parser on both aliases | Transfer events call the SQL RPC; not a transfer initiation endpoint | Provider callback only; no app caller |

The app's current `createPaystackRecipient` wrapper targets a different URL from the backend recipient-creation route and is not called elsewhere in the searched mobile source. The wrapper and `POST /paystack/recipient` placeholder should not be treated as a working bank onboarding integration.

## Remediation matrix

Severity is source-based priority, not a claim that a path is deployed or exploitable in production.

| # | Priority | Issue and evidence | Existing protection | Remaining gap | Minimal proposed change | Required regression tests | Database implications | Dependencies/order |
|---|---|---|---|---|---|---|---|---|
| 1 | **HIGH — required security** | `/errands/withdraw` and `/api/errands/withdraw` remain in [routes/errands.js](/workspaces/ers-backend-worktree/services/api/routes/errands.js:461) | Requires Bearer auth and uses `req.user.id` | Not disabled; no runner authorization; broken/unresolved runtime identifiers; no verified atomic transfer lifecycle | Replace both alias behavior with same explicit 503 fail-closed handler until a separately reviewed payout flow is approved | Assert both aliases always 503, no Paystack calls, no wallet/transaction mutations, regardless of headers/body/token | None for disablement | First: before any financial test or enablement; include aliases in withdrawal test list |
| 2 | **HIGH — required security** | Unauthenticated `create-recipient` in [routes/errands.js](/workspaces/ers-backend-worktree/services/api/routes/errands.js:321) calls Paystack using body account data | Provider secret stays server-side | Anonymous third parties can trigger recipient-creation side effects and receive response; no owner binding/persistence | Disable with 503 while withdrawals are disabled; later require verified identity, validate input, and bind recipient to a server-owned bank record | Anonymous and authenticated calls cannot contact Paystack while disabled; later test identity binding, invalid fields, and no cross-user recipient access | None to disable; future owned recipient storage requires reviewed schema | Disable alongside all withdrawal routes; future bank/recipient API requires separate design |
| 3 | **MEDIUM — required before PIN use** | `/pin/verify` in [routes/pin.js](/workspaces/ers-backend-worktree/services/api/routes/pin.js:52) compares a 4-digit PIN without visible attempt limits | Bearer auth and user-bound lookup | Repeated guesses are not throttled in this handler; dormant withdrawal attempt code is not usable protection | Add server-side per-user throttling/lockout through an approved shared rate-limit mechanism; fail closed if limiter storage is unavailable | Repeated wrong attempts block further attempts; correct PIN cannot bypass; independent users do not share counters; reset/expiry behavior is deterministic; parallel attempts do not exceed configured threshold | Depends on chosen mechanism: existing shared limiter needs no new migration; otherwise a narrowly scoped server-side counter table/atomic function needs reviewed migration | Before exposing `/pin/verify` to clients or implementing payouts |
| 4 | **MEDIUM — required identity prerequisite** | PIN handlers use `public.users`; snapshots have no `auth.users` FK/trigger; E2E fixtures manually insert users ([schema snapshot](/workspaces/ers-backend-worktree/schema_before_security.sql:308), [auth.e2e.test.js](/workspaces/ers-backend-worktree/services/api/tests/auth.e2e.test.js:44)) | `authenticate` resolves a profile by verified Auth UUID; PIN queries are token-ID scoped | A profile does not prove a corresponding `public.users` row exists; new-account PIN provisioning is unverified | Before enabling PIN workflows, specify and implement one controlled provisioning path keyed to Auth UUID, with reviewed FK/idempotency and preserved existing data. Do not infer or bulk-copy identities based only on equal UUID strings. | New verified Auth account provisions exactly one compatible `public.users` record; repeat provisioning is idempotent; absent profile/user fails closed; existing roles/PIN hashes remain unchanged | Likely requires a separately reviewed schema migration or trusted backend provisioning change; live schema must first be verified | Resolve identity model and disposable DB schema before PIN UI work |
| 5 | **LOW — client compatibility** | Legacy [CreatePinScreen.tsx](/workspaces/ers-website-worktree/apps/mobile/screens/CreatePinScreen.tsx:30) uses [src/config/api.ts](/workspaces/ers-website-worktree/apps/mobile/src/config/api.ts:30) with no Bearer token | Backend correctly rejects missing Bearer auth; screen sends identity headers only | Caller would fail if reached; no navigation call was found. Signup-stack PIN screen is currently a placeholder, not a caller. | If retaining the legacy screen, switch to shared `src/services/api.ts`, omit identity headers, require token/session, check `res.ok`; only wire the active signup screen after an authenticated session exists | Screen sends Bearer token; forged headers cannot change owner; 401/409/5xx do not show success; placeholder behavior remains until approved | None | After confirming intended screen/flow; do not weaken backend auth |
| 6 | **MEDIUM — payout reconciliation prerequisite** | Webhook handler [routes/paystack.js](/workspaces/ers-backend-worktree/services/api/routes/paystack.js:509) calls RPC added by [20260910_sprint6_paystack_transfer_reconciliation.sql](/workspaces/ers-backend-worktree/supabase/migrations/20260910_sprint6_paystack_transfer_reconciliation.sql) | HMAC signature check, reference/amount validation, transaction+wallet row locking in SQL, service-role-only function grant | The API change fails at runtime if migration/order/schema/grants are missing; current test mocks the RPC | Apply/validate prerequisite migrations and function in a disposable project before deploying webhook handler; do not enable transfer initiation | Execute SQL-level tests for success/failure, matching amount/type/provider, replay, contradictory terminal event, rollback, parallel duplicate delivery, and privilege denial for anon/authenticated | Required: previous `20260909` reference/provider/index migration plus this function; verify actual schema, unique reference index, table columns, and function privileges | Must precede deployment of handler that calls RPC; remains reconciliation-only |
| 7 | **LOW — legacy placeholder cleanup** | `POST /paystack/recipient` in [routes/paystack.js](/workspaces/ers-backend-worktree/services/api/routes/paystack.js:51) returns a fake success-shaped recipient | No actual Paystack transfer side effect | Clients may believe a recipient was created; no caller found | Remove or make explicitly unavailable after route dependency confirmation; do not return a fabricated recipient code | Both aliases cannot return fake success; no client relies on it | None | Search confirmed callers before removal; can follow the security disables |
| 8 | **LOW — upload authorization dependency** | Upload uses `authenticate` + `authorize("runner")` in [routes/storage.js](/workspaces/ers-backend-worktree/services/api/routes/storage.js:78); role comes from `profiles` via [authService.js](/workspaces/ers-backend-worktree/services/api/modules/protect/authService.js:25) | Verified Supabase token and profile-role check; KYC lookup is scoped to authenticated user | This route does not independently validate approved runner state; role-provisioning controls are outside this remediation diff | Confirm runner role can only be granted by the approved server-side process; keep route closed to client role | Client/forged role denied; pending KYC belongs to req.user; non-approved runner cannot upload under the approved role policy | Depends on approved role/KYC schema and RLS; no change justified from this route-only review | Verify role provisioning before relying on this route for onboarding |

## Required security fixes

1. Keep `/withdraw`, `/api/withdraw`, `/errands/paystack/withdraw`, and `/api/errands/paystack/withdraw` fail-closed as they are in the current diff.
2. Also fail-close `/errands/withdraw` and `/api/errands/withdraw`; the current authentication middleware is not enough to make this incomplete payout handler safe.
3. Disable unauthenticated recipient creation while there is no approved payout lifecycle. Do not accept client-supplied recipient codes or treat a created Paystack recipient as owned until it is persisted against a server-verified user/bank record.
4. Add effective PIN verification throttling before shipping any caller of `/pin/verify` or enabling withdrawals. Do not count the unused/broken `pin_attempts` code as protection.
5. Resolve `public.users` provisioning and identity relationship before advertising PIN setup. A verified Supabase profile and matching-looking UUID do not establish that the `public.users` row exists.
6. Preserve the service-role-only RPC privilege boundary and validate the SQL function against a disposable database before deploying webhook code that depends on it.

## Client compatibility fixes

1. Do not change backend middleware to accept `x-user-id` as identity.
2. If the legacy authenticated PIN screen is intended to remain, route it through the shared authenticated API helper and remove `x-user-id`/`x-role` from its request.
3. Keep the current AuthStack PIN screen as a placeholder until the session lifecycle and profile provisioning are ready; then connect it to the same `/pin/set` contract after Auth has issued a valid session.
4. Correct or remove the unused `createPaystackRecipient` wrapper only after agreeing on the recipient API contract. Its current `/api/paystack/create-recipient` path does not match the backend’s `/api/errands/paystack/create-recipient` mount, and no invocation was found.
5. Keep withdrawal UI behavior explicit while API returns 503; it must display unavailable rather than infer success or expect an OTP response.

## Financial functionality that must remain disabled

- No API withdrawal route should initiate a Paystack transfer in this milestone.
- `/errands/withdraw` must be disabled in addition to the already stubbed aliases.
- `create-recipient` must not remain anonymously callable while payout functionality is unavailable.
- The reconciliation migration and webhook handler are not permission to re-enable transfer initiation.
- A future secure payout requires a separate reviewed lifecycle: authenticated user and approved runner/customer policy, verified owned bank destination, PIN step-up with server-side throttling, amount and available-balance checks, idempotency, atomic balance reservation plus pending ledger insertion, provider call using that exact ledger reference, signed webhook reconciliation, and audit/operational recovery. This is not implemented by the current diffs.

## Legacy endpoint removal after dependency confirmation

- `/pin/create` is currently an alias to `/pin/set`; no client call was found. Keep only if a client contract requires the alias; it must not become a reset path.
- `/pin/verify` has no app caller found; do not remove until payout/other usage is checked, but do not expose it without throttling.
- `/api/errands/wallet` is authenticated but no mobile caller was found; review whether the broader `select('*')` response is still required before removal or narrowing.
- `/paystack/recipient` is a fake placeholder with no caller found; remove or explicitly deprecate after confirming external consumers.
- `/paystack/resolve-account` and `/resolve` are unauthenticated Paystack account-resolution aliases; confirm product use and add appropriate auth/abuse controls or retire them.
- `/api/errands/withdraw` and its legacy counterpart should be disabled immediately, not merely queued for cleanup.

## Ordered remediation sequence

1. **Contain financial routes:** Preserve current 503 stubs; add the same fail-closed behavior to `/errands/withdraw` aliases and recipient creation. Extend tests to enumerate every mount.
2. **Confirm schema prerequisites in an isolated project:** Check migration order and exact `transactions`, `wallets`, `profiles`, and `users` definitions. Do not use the recovery snapshot as live evidence.
3. **Validate transfer reconciliation SQL:** Apply only in a disposable non-production project after prerequisites; run SQL-level replay/concurrency/privilege tests. Deploy the RPC before code that depends on it, but keep withdrawal initiation disabled.
4. **Settle identity provisioning:** Define how the trusted system provisions `public.users` from Auth identity and preserves existing role/PIN data. Review the migration and backfill separately before implementation.
5. **Add PIN verification throttling and reset policy:** Choose the approved limiter/storage and recovery behavior. Do not reuse the unfinished withdrawal handler as the security mechanism.
6. **Repair mobile PIN integration:** Confirm which screen should own PIN creation. Update the legacy caller only if retained; wire signup-stack UI only after authenticated session and profile/user provisioning are available.
7. **Clean up aliases/placeholders:** Remove unused endpoint aliases only after confirming external dependencies; correct the recipient API path only if that feature is approved.
8. **Run targeted tests in the next approved implementation milestone:** Backend route tests, mobile API-client test, migration integration tests in a disposable project, then the narrow relevant suite.

## Test acceptance criteria for the next implementation milestone

### Route security and financial disablement

- Every withdrawal path, including `/withdraw`, `/api/withdraw`, both errands withdrawal aliases, and both Paystack withdrawal aliases, returns the documented unavailable response.
- No disabled path calls Paystack, mutates wallets, inserts transactions, or invokes reconciliation RPCs.
- `create-recipient` cannot call Paystack anonymously or while payout setup is disabled.
- Forged `x-user-id`, `x-runner-id`, `x-role`, and `recipient_code` cannot alter the authenticated identity or cause a transfer.

### PIN lifecycle and mobile

- Requests without a valid Bearer token are rejected; a forged identity header cannot select another `public.users` row.
- Only an existing Auth-linked application account with a provisioned users row can set a PIN; a missing row fails clearly and never reports success.
- PIN material is never stored plaintext; duplicate setup is rejected without replacing the existing hash.
- Repeated invalid PIN verification reaches the configured per-user throttle; parallel attempts cannot bypass its threshold.
- Reset follows an explicitly approved recovery/step-up flow and cannot be performed by calling `/create`.
- The intended mobile screen sends a Bearer token from the authenticated session; error responses do not display a success alert.

### Upload and runner authorization

- A client token is denied even with forged runner headers.
- Only the authenticated account’s pending KYC record is updated.
- Role authorization is tested against the actual approved-runner provisioning contract, not just a mocked profile role.

### Migration and webhook

- In a disposable Supabase/Postgres database, first apply and rerun behavior are verified for the prerequisite and reconciliation migrations.
- Actual SQL tests verify wrong reference/type/provider/amount rejection, exactly-once failed refund, idempotent matching terminal replay, contradictory event rejection, and transactional rollback on failure.
- Concurrent duplicate webhook delivery results in one ledger effect.
- `anon` and `authenticated` cannot execute the reconciliation function; only the intended service role can.
- API tests continue to verify HMAC validation and raw-body behavior for both webhook aliases.

## Unresolved questions requiring approval or non-production verification

1. Is any external client using `/errands/withdraw`, either create-recipient route, `/paystack/recipient`, `/resolve-account`, `/pin/create`, or `/pin/verify`?
2. Should recipient creation remain entirely disabled until withdrawals are implemented, or does another approved feature need it?
3. What is the approved PIN-reset/recovery policy? Existing code only supports first-time set.
4. Which server-side throttling facility should protect PIN verification? No shared limiter was established in this review.
5. What trusted provisioning process creates `public.users` for each verified Supabase identity? Does the live database have a trigger or separate service not represented in checked-in sources?
6. Which live schema and migrations are actually applied? The inspected snapshots differ and do not prove the live structure.
7. Is the runner role on `profiles` granted only by the approved administrative process? `authorize("runner")` trusts that profile role; it does not inspect a separate runner approval record.
8. Is the uncommitted security remediation currently deployed anywhere? No deployment state was checked.
9. Which mobile PIN screen is intended to ship: the legacy authenticated `AppStack` screen or the signup-stack placeholder?

## Files and sources inspected

### Backend

- `services/api/app.js`
- `services/api/routes/errands.js`
- `services/api/routes/paystack.js`
- `services/api/routes/pin.js`
- `services/api/routes/storage.js`
- `services/api/modules/protect/authenticate.js`
- `services/api/modules/protect/authService.js`
- `services/api/modules/protect/authorize.js`
- `services/api/tests/securityRemediation.test.js` (read only; not run)
- `services/api/tests/auth.e2e.test.js` (relevant fixture and cleanup sections)
- `schema_before_security.sql`
- `supabase/migrations/20260909_sprint6_paystack_wallet_funding.sql`
- `supabase/migrations/20260910_sprint6_paystack_transfer_reconciliation.sql`
- `ERS_MILESTONE_7_6_2_PHASE_1_ROUTE_MIDDLEWARE_TRACE.md`

### Website/mobile

- `apps/mobile/screens/CreatePinScreen.tsx`
- `apps/mobile/src/screens/auth/CreatePinScreen.tsx`
- `apps/mobile/src/config/api.ts`
- `apps/mobile/src/services/api.ts`
- `apps/mobile/src/providers/AuthProvider.tsx`
- `apps/mobile/src/context/AuthContext.ts`
- `apps/mobile/src/navigation/AppStack.tsx`
- `apps/mobile/src/navigation/AuthStack.tsx`
- `apps/mobile/src/navigation/RootNavigator.tsx`
- `apps/mobile/src/screens/auth/VerifyOTPScreen.tsx`
- `apps/mobile/App.tsx`

## Final status

- Backend worktree: `/workspaces/ers-backend-worktree`
- Branch: `feat/backend-security-hardening`
- HEAD: `9b31d7211089a172e15e6b8fce512f75f3a725b7`
- Existing modifications and untracked files were preserved.
- No source, test, migration, or existing report file was modified.
- The only file created for this milestone is `ERS_MILESTONE_7_6_2_PHASE_2_REMEDIATION_PLAN.md`.
- No tests, builds, SQL, migrations, Supabase/Paystack requests, or deployments were performed.
