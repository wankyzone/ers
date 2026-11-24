# ERS Milestone 7.6.3 — Phase 4.1 Authentication Coverage Audit

**Scope:** Read-only review of the current backend worktree after Phase 4. No source, tests, configuration, or migration files were changed for this audit. This report is the only file created.

## 1. Executive assessment

**NO-GO for proceeding to website customer authentication against this backend as-is.**

Phase 4’s verified-email check is present in both REST authentication and Socket.IO connection authentication, but it is conditional on `profiles.role === "client"`. It correctly uses `email_confirmed_at` from the Supabase Auth `getUser(token)` response; a profile's `verified` field and caller-supplied headers/body do not satisfy that check. The middleware also requires a profile row.

That is not yet a complete customer contract:

1. Several account-scoped REST operations use `authenticate` without a client-role guard. Accounts with a non-client profile role bypass the new confirmation check and can still use those operations.
2. `GET /errands` applies customer/runner filtering only for the exact `client` and `runner` values. Any other non-empty profile role receives the unfiltered query.
3. Socket.IO’s `join:user` checks that the requested ID equals the authenticated profile ID, but it has no customer capability/role check. Non-client roles bypass email verification and may join their own user room.
4. The new tests do not cover malformed-but-truthy confirmation timestamps, alternate-role access to role-neutral customer routes, or the `/errands` unknown-role fall-through.
5. Public OTP/bank/recipient placeholders remain mounted. They do not authenticate or access real customer records, but some return success-shaped placeholder responses and must not be mistaken for completed account features.

These are source-code findings only. Tests and policies were not executed against a database; no production schema or data was inspected.

## 2. Authentication path and role semantics

- REST `authenticate` parses a Bearer token, calls `verifyAccessToken`, resolves `profiles` by the Auth UUID, and rejects an unverified profile only when its role is exactly `client`. See [authenticate.js](./services/api/modules/protect/authenticate.js#L15) and [authService.js](./services/api/modules/protect/authService.js#L3).
- `verifyAccessToken` calls Supabase `auth.getUser(token)` and returns its user object, including the trusted Auth `email_confirmed_at`. `getApplicationUser` queries `profiles` by that Auth user's ID and fails if the profile is unavailable.
- REST `authorize("client")` checks the profile role. It does not itself check email verification. Other role checks are also based on `profiles.role`; see [authorize.js](./services/api/modules/protect/authorize.js#L30).
- Socket.IO repeats the token and profile lookup and applies the same exact-client-role verification condition in [socket.js](./services/api/server/socket.js#L24).
- Request identity is set from `authResult.user.id`; the reviewed customer handlers generally use `req.user.id`. Forged `x-user-id`, `x-role`, socket handshake `userId`/`role`, and request-body identity fields do not replace that identity in those paths.
- `profiles.role` remains an authorization input. Runner/admin capability modeling, mutable-role policy safety, and admin MFA are outside Phase 4 and remain unresolved.

## 3. REST endpoint coverage

The `errands`, `transactions`, `paystack`, `kyc`, `pin`, `banks`, `otp`, and `storage` routers are mounted both without and with `/api` prefixes in [app.js](./services/api/app.js#L121). Rows below list both aliases where applicable. Profile checks described as “yes” mean the route passes through `authenticate`, which requires a profile, unless stated otherwise.

### Customer and shared-account operations

| Method and route(s) | Auth and verified-email enforcement | Profile required? | Ownership / authorization | Finding |
|---|---|---:|---|---|
| `GET /wallet`, `GET /api/wallet` | `authenticate`; exact `client` role requires Auth confirmation. The `/api` alias internally reroutes to `/wallet`. | Yes | Wallet lookup uses `req.user.id`. | Customer ownership is server-derived. Non-client roles bypass email verification because this endpoint has no role guard. [app.js](./services/api/app.js#L75) |
| `POST /errands/`, `POST /api/errands/` | `authenticate` + `authorize("client")`; verified check occurs first for client profiles. | Yes | Client ID is `req.user.id`; atomic RPC receives that ID. | Covered for verified client flow; profile role remains the capability check. [errands.js](./services/api/routes/errands.js#L11) |
| `GET /errands/`, `GET /api/errands/` | `authenticate`; exact `client` role is checked for email confirmation. | Yes | Client query filters by authenticated ID; runner query uses runner visibility filter. | **Bypass:** a non-empty role other than `client` or `runner` is not rejected and leaves the query unfiltered, returning all errands. An unverified non-client-role account also bypasses email verification. [errands.js](./services/api/routes/errands.js#L279) |
| `POST /errands/:id/confirm`, `POST /api/errands/:id/confirm` | `authenticate` + `authorize("client")`; verified check is reached. | Yes | Atomic release RPC receives `req.user.id`; RPC checks client ownership. | Customer path is guarded; ownership is also checked in the database routine. [errands.js](./services/api/routes/errands.js#L210) |
| `GET /errands/transactions/:userId`, `/api/errands/transactions/:userId` | `authenticate`; exact client profiles are checked, other roles are not. | Yes | Rejects unless path ID equals `req.user.id`; query is then filtered by that ID. | Cross-user access is denied, but unverified profiles with non-client roles can access their own transaction data. [errands.js](./services/api/routes/errands.js#L328) |
| `GET /errands/analytics/:userId`, `/api/errands/analytics/:userId` | `authenticate`; exact client profiles are checked, other roles are not. | Yes | Path ID must equal `req.user.id`; transaction query uses that ID. | Same role-based verification bypass as the transaction route. [errands.js](./services/api/routes/errands.js#L346) |
| `POST /errands/:id/dispute`, `/api/errands/:id/dispute` | `authenticate`; only exact client profiles are checked for confirmation. | Yes | Fetches errand, permits its client or assigned runner, then updates dispute state. | Ownership/participation is checked, but any non-client role bypasses the email check. [errands.js](./services/api/routes/errands.js#L372) |
| `GET /errands/wallet`, `/api/errands/wallet` | `authenticate`; exact client profiles are checked, other roles are not. | Yes | Wallet query uses `req.user.id`. | Own-wallet access is scoped; a non-client role bypasses customer verification. [errands.js](./services/api/routes/errands.js#L412) |
| `POST /errands/verify-otp`, `/api/errands/verify-otp` | `authenticate`; exact client profiles are checked, other roles are not. | Yes | OTP lookup/update uses `req.user.id`; submitted code is not an identity input. | Account-scoped; alternate profile roles bypass email confirmation. [errands.js](./services/api/routes/errands.js#L449) |
| `POST /pin/set`, `/api/pin/set`; `POST /pin/create`, `/api/pin/create`; `POST /pin/verify`, `/api/pin/verify` | `authenticate`; exact client profiles are checked, other roles are not. | Yes | Reads/writes `public.users` by `req.user.id`, not caller-supplied ID. | No direct ID override found. Unverified non-client roles can use these account-scoped operations. [pin.js](./services/api/routes/pin.js#L49) |
| `POST /paystack/initialize`, `/api/paystack/initialize` | `authenticate`; exact client profiles are checked, other roles are not. | Yes | Transaction user ID and email come from `req.user`; server creates the payment reference. | User ownership is server-derived, but the operation has no client-role guard and non-client roles bypass confirmation. [paystack.js](./services/api/routes/paystack.js#L63) |
| `GET /paystack/verify/:reference`, `/api/paystack/verify/:reference` | `authenticate`; exact client profiles are checked, other roles are not. | Yes | Ledger query includes authenticated user ID, reference, provider, and deposit type. | Ownership check is present; non-client roles bypass email verification. [paystack.js](./services/api/routes/paystack.js#L193) |

### Runner-only and disabled financial operations

| Method and route(s) | Auth and verified-email enforcement | Profile required? | Ownership / authorization | Finding |
|---|---|---:|---|---|
| `POST /errands/:id/accept`, `/api/errands/:id/accept` | `authenticate` + `authorize("runner")`; the customer-only email check does not apply to runner profiles. | Yes | Authenticated runner ID is passed to the atomic acceptance RPC. | Runner behavior is unchanged by Phase 4. Runner verification is outside this phase. [errands.js](./services/api/routes/errands.js#L95) |
| `POST /errands/:id/complete`, `/api/errands/:id/complete` | `authenticate` + `authorize("runner")`; no client email check for runner role. | Yes | Authenticated runner ID is passed to the completion RPC. | Runner behavior unchanged; RPC enforces assignment/state. [errands.js](./services/api/routes/errands.js#L156) |
| `POST /kyc/verify`, `/api/kyc/verify` | `authenticate` + `authorize("runner")`; exact runner role bypasses the client confirmation condition. | Yes | KYC user ID is taken from `req.user.id`. | Runner authorization is role-based and outside this phase. [kyc.js](./services/api/routes/kyc.js#L17) |
| `POST /storage/upload`, `/api/storage/upload` | `authenticate` + `authorize("runner")`; exact runner role bypasses the client confirmation condition. | Yes | Storage service receives `req.user.id`; runner role required. | No caller ID override found. Runner behavior unchanged. [storage.js](./services/api/routes/storage.js#L78) |
| `POST /withdraw`, `POST /api/withdraw` | No Auth; handler immediately returns 503. | No | None. | Disabled; no financial operation is performed. [app.js](./services/api/app.js#L118) |
| `POST /errands/withdraw`, `/api/errands/withdraw`; `POST /errands/paystack/withdraw`, `/api/errands/paystack/withdraw` | No Auth; handlers immediately return 503. | No | None. | Disabled; regression tests assert no Paystack or financial side effects. [errands.js](./services/api/routes/errands.js#L270) |
| `POST /errands/paystack/create-recipient`, `/api/errands/paystack/create-recipient` | No Auth; handlers immediately return 503. | No | None. | Disabled; regression tests assert no Paystack or record mutation. [errands.js](./services/api/routes/errands.js#L321) |

### Public, placeholder, and machine-to-machine endpoints

These are mounted REST endpoints but do not currently implement protected customer-record access. They are listed because clients may call them; their success responses must not be treated as identity or account authorization.

| Method and route(s) | Auth/profile | Observed behavior and coverage |
|---|---|---|
| `GET /transactions/`, `GET /api/transactions/` | None | Returns an empty array; database query is a TODO. No customer data currently returned. [transactions.js](./services/api/routes/transactions.js#L5) |
| `GET /banks/`, `GET /api/banks/`; `GET /paystack/banks`, `GET /api/paystack/banks` | None | Return empty arrays. [banks.js](./services/api/routes/banks.js#L5), [paystack.js](./services/api/routes/paystack.js#L11) |
| `POST /banks/`, `PATCH /banks/:id/default`, `DELETE /banks/:id` and `/api` aliases | None | Placeholder responses; POST echoes request body. No bank-record persistence was found in these handlers. [banks.js](./services/api/routes/banks.js#L9) |
| `POST /paystack/resolve-account`, `/api/paystack/resolve-account`; `POST /paystack/resolve`, `/api/paystack/resolve` | None | Forwards caller-supplied account number/bank code to Paystack. Does not resolve identity or access ERS customer records. [paystack.js](./services/api/routes/paystack.js#L18) |
| `POST /paystack/recipient`, `/api/paystack/recipient` | None | Returns a placeholder recipient and echoes request fields; does not call Paystack or persist a recipient. Distinct from the disabled errands recipient aliases. [paystack.js](./services/api/routes/paystack.js#L51) |
| `POST /otp/verify`, `POST /api/otp/verify` | None | Always returns `"Placeholder OTP verified"`; it does not verify Auth email or issue a trusted customer capability. [otp.js](./services/api/routes/otp.js#L5) |
| `POST /paystack/webhook`, `/api/paystack/webhook` | No user Bearer token; validates Paystack HMAC signature. | Provider callback, not a customer-facing operation. It reads a payment ledger and performs atomic reconciliation/crediting; authorization is provider-signature and ledger based, not user-session based. [paystack.js](./services/api/routes/paystack.js#L363) |

The separate [server/routes/otp.js](./services/api/server/routes/otp.js#L1) contains an older handler that trusts `x-user-id` and `x-device-id`. It is **not imported or mounted** by current [app.js](./services/api/app.js); the active OTP router is `routes/otp.js`. Keep the old file from being wired into the API without replacing its caller-controlled identity behavior.

### Administrative routes

The admin routes are not customer-facing and were not treated as customer capability endpoints. Their mounted handlers generally use `authenticate` plus `authorizeAdmin()`; the client-only email check therefore does not apply to admin profiles. This preserves current admin behavior but does **not** establish the separate MFA/AAL2 requirement. Admin customer-data access needs a separate review.

## 4. Role, identity, and ownership findings

### Confirmed protections

- Auth user ID is derived from Supabase `auth.getUser(token)` and used to query `profiles`; request headers and bodies do not supply the ID in the reviewed middleware.
- Email verification is read from the Auth user response, not `profiles.verified`, `email_verified` headers, or body fields.
- Routes with `authorize("client")` reject a profile whose role is not `client`.
- Customer errand creation/confirmation use the authenticated ID; account-specific transaction, wallet, PIN, and payment handlers also derive or filter by that ID.
- REST and Socket.IO route aliases share the same router or authentication logic, so `/api` aliases do not bypass the middleware merely by using a different prefix.

### Confirmed gaps

1. **Role-conditional confirmation is not a universal customer check.** `authenticate` and Socket.IO reject only `role === "client"` when Auth confirmation is absent. Role-neutral routes do not establish that the account is acting with customer capability.
2. **Unknown-role errand list is unfiltered.** `GET /errands` rejects only a falsy role. Roles such as `admin` or any unexpected non-empty value satisfy that check but trigger neither client nor runner filter.
3. **Profile role remains security-sensitive.** The current design still trusts a profile field for route roles; this audit establishes only that client-provided headers/body do not override it. It does not establish that profile-role writes are secure in the deployed database.
4. **Timestamp validation is truthiness-only.** A malformed non-empty value such as `"not-a-date"` passes `!email_confirmed_at`. Supabase is expected to return a valid timestamp, but code and tests do not fail closed on malformed values.
5. **Customer dashboard coverage is not demonstrated.** The backend has no single shared “verified customer capability” guard; route behavior is a mixture of `authorize("client")`, authenticated ownership checks, and public placeholders.

## 5. Socket.IO event coverage

Authentication middleware executes before Socket.IO accepts a connection. `socket.user` is the resolved profile for the authenticated Auth UUID. Event authorization is separate and summarized below.

| Event | Connection verification | Per-event authorization and identity | Coverage / gap |
|---|---|---|---|
| `join:errand` | Requires valid access token and profile; unverified exact-client role is rejected. Other profile roles bypass the email check. | Fetches the errand and requires `errand.client_id === socket.user.id` or `assigned_runner_id === socket.user.id`; room name is built from requested errand ID only after check. | Own/assigned access and foreign errand denial have tests. Alternative roles are not tested; there is no capability check beyond ownership. [socket.js](./services/api/server/socket.js#L70) |
| `location:update` | Same connection guard; unverified exact-client role cannot connect. | Requires errand record, `assigned_runner_id === socket.user.id`, and prior membership in that errand room before broadcasting. Client-supplied errand ID cannot authorize a different runner/errand. | Assigned-runner and cross-errand spoof tests exist. No explicit `runner` role/capability check exists; assignment is the authorization control. [socket.js](./services/api/server/socket.js#L133) |
| `join:user` | Same connection guard; any authenticated profile with a non-client role bypasses email verification. | Requires submitted user ID to exactly equal `socket.user.id`; joins the server-derived user room. | Cross-user join denial and own-room success are tested. **Unverified non-client roles may join their own room**; no customer-capability check exists. [socket.js](./services/api/server/socket.js#L204) |
| `disconnect` | Only an accepted socket can emit it. | Logs disconnect; no data access or room grant. | No additional authorization needed. [socket.js](./services/api/server/socket.js#L228) |

Socket tests do reject missing/invalid tokens and an unverified profile with role `client`; they do not prove RLS or real Supabase token/profile behavior because the test supplies a mocked `protect` implementation.

## 6. Test coverage assessment

### Existing tests

- [authMiddleware.test.js](./services/api/tests/authMiddleware.test.js): mocked acceptance for a confirmed client; rejection for null confirmation, missing token, invalid token, and missing profile; forged header/body identity and role; runner/admin behavior; and `authorize("client")` rejecting a runner profile.
- [securityRemediation.test.js](./services/api/tests/securityRemediation.test.js): mocked REST checks for Bearer requirements, header-resistant wallet/PIN identity, a cross-account transaction denial, runner-only storage, and disabled payout/recipient endpoints.
- [socketTracking.integration.test.js](./services/api/tests/socketTracking.integration.test.js): socket room ownership, runner location assignment, foreign room rejection, missing/invalid token, and client-role unverified connection rejection.
- [auth.e2e.test.js](./services/api/tests/auth.e2e.test.js): exercises real API errand create/accept/complete/confirm flows using configured Supabase test helpers. It does not provide route-by-route unverified-account coverage. It was not run for this read-only audit.

### Missing or insufficient tests

1. **Malformed confirmation timestamps:** no tests for empty, invalid, whitespace, or malformed non-empty `email_confirmed_at`. The current truthiness check accepts malformed non-empty data.
2. **Alternative profile roles:** no test demonstrates that an unverified `runner`, `admin`, or unknown-role profile can reach role-neutral customer routes. Current middleware code predicts that it can.
3. **Unknown-role errand listing:** no test covers the unfiltered `GET /errands` branch for a non-empty role other than `client`/`runner`.
4. **Route-level client denial coverage:** tests exercise the guard directly and only select REST routes. No test asserts unverified rejection on every account-specific customer route (wallet, PIN, errand list/detail actions, payment initialization/verification, disputes, OTP).
5. **Socket role alternatives:** no test checks an unverified non-client profile joining its user room or an errand room.
6. **REST cross-customer coverage:** one test rejects a foreign transaction path and the wallet test verifies token-derived filtering, but there is no broad matrix for each customer resource/HTTP method.
7. **RLS/database integration:** all Phase 4-specific Auth/profile lookups are mocked; no disposable Supabase policy, trigger, or data-ownership behavior is established.
8. **Public stubs:** no tests prevent clients from treating placeholder OTP/bank/recipient responses as completed account operations.

## 7. Preservation and payout status

- Phase 4 auth still allows runner/admin profiles to pass without an Auth email confirmation timestamp. Their role authorization remains in `authorize.js`; this audit makes no source changes.
- Payout protections remain present in the worktree: withdrawal and recipient creation handlers in `errands.js` and `app.js` return 503, and `securityRemediation.test.js` asserts no Paystack calls or financial mutations for those aliases.
- `public.users` remains used by the PIN route. No schema, migration, or `public.users` operation was performed during this audit.
- No tests, SQL, database connections, production access, deployments, commits, pushes, or merges were performed.
- At audit start the worktree was `feat/backend-security-hardening` at `9b31d7211089a172e15e6b8fce512f75f3a725b7`, with pre-existing modified and untracked files. Those were preserved.

## 8. Recommended remediation order

1. Add an explicit verified-customer authorization guard and apply it to every customer-facing route, including account-scoped routes currently using only `authenticate`. Keep separate runner/admin guards so their behavior is deliberately controlled.
2. Fix `GET /errands` to explicitly allow only the intended roles and apply a query filter for every allowed role; deny all other roles rather than returning an unfiltered query.
3. Apply an explicit capability/ownership rule to `join:user` and the other socket events. Keep per-event resource checks even after connection authentication.
4. Fail closed on missing **or malformed** Auth confirmation timestamps; add empty and invalid timestamp tests.
5. Add route-level tests for each REST operation and alias, including unverified customer, alternate role, forged identity/role, and cross-customer access. Add socket tests for unverified alternate roles and room access.
6. Validate the final policy/ownership contract in a disposable Supabase project. Mocked tests cannot validate profile RLS, legacy role mutation, or production-equivalent data mapping.
7. Review/unmount or replace the legacy `server/routes/otp.js`, and replace public success-shaped placeholders before any UI relies on them.

## 9. Website customer authentication recommendation

**NO-GO pending remediation and verification.** The website must not rely on this API as a complete verified-customer boundary while role-neutral routes permit unverified non-client roles and `/errands` can return unfiltered data for unexpected roles. Proceed only after the backend has a consistent customer capability/verification guard, the unknown-role list behavior is closed, focused tests cover the affected routes and socket rooms, and database/RLS behavior has been validated in a disposable Supabase environment. The website may continue isolated UI work that does not expose protected customer data or enable customer API access.
