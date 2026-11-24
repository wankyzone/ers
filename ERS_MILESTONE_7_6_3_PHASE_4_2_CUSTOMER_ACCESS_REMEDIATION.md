# ERS Milestone 7.6.3 — Phase 4.2 Customer Access Remediation

## 1. Phase 4.1 findings addressed

- Added a reusable verified-customer guard based only on the Supabase Auth user returned by `auth.getUser(token)`. An email confirmation value must be a parseable timestamp in the expected ISO form; missing or malformed values fail closed.
- Kept customer eligibility independent of `profiles.role === "client"`. The Auth UUID must resolve to a profile with the same ID; caller headers, request bodies, profile verification fields, and roles do not supply Auth identity or email verification.
- Applied the guard to the audited customer operations and to shared account routes. Shared routes retain a deliberate runner-only alternative where runner access already existed.
- Replaced the `/errands` list role fall-through with explicit supported-role handling and a customer-ID filter for non-runner roles.
- Tightened Socket.IO connection and event checks: unsupported roles are rejected, customer errand ownership requires a verified Auth identity, runner errand and location access requires the runner role and resource assignment, and user-room joins remain restricted to the authenticated user's own room.
- Added route-matrix, malformed timestamp, unsupported role, forged identity/role, ownership, and runner compatibility tests.

## 2. Files changed

- [services/api/modules/protect/authService.js](./services/api/modules/protect/authService.js) — added trusted Auth confirmation timestamp validation.
- [services/api/modules/protect/authenticate.js](./services/api/modules/protect/authenticate.js) — attaches Auth-derived verification state and rejects a profile whose ID differs from the Auth UUID.
- [services/api/modules/protect/authorize.js](./services/api/modules/protect/authorize.js) and [services/api/modules/protect/index.js](./services/api/modules/protect/index.js) — added and exported verified-customer and customer-or-runner guards.
- [services/api/app.js](./services/api/app.js) — guarded root and `/api` wallet access.
- [services/api/routes/errands.js](./services/api/routes/errands.js) — guarded customer create/confirm and shared account operations; made errand-list role handling explicit.
- [services/api/routes/paystack.js](./services/api/routes/paystack.js) — guarded authenticated funding initialization and payment verification.
- [services/api/routes/pin.js](./services/api/routes/pin.js) — guarded PIN set/create/verify.
- [services/api/server/socket.js](./services/api/server/socket.js) — enforced verified-customer and per-event role/ownership rules.
- [services/api/tests/authMiddleware.test.js](./services/api/tests/authMiddleware.test.js), [services/api/tests/securityRemediation.test.js](./services/api/tests/securityRemediation.test.js), and [services/api/tests/socketTracking.integration.test.js](./services/api/tests/socketTracking.integration.test.js) — added focused coverage.

Other modified or untracked work already present in the worktree, including the existing Phase 4.1 audit, storage changes, and financial reconciliation migration, was preserved and not included in this phase's changes.

## 3. REST routes remediated

The shared guards apply to both router mount prefixes (`/` and `/api`):

| Route group | New access rule | Ownership handling |
|---|---|---|
| `GET /wallet` | Verified Auth customer or existing runner role | Wallet ID is the authenticated Auth UUID |
| `POST /errands/`, `POST /errands/:id/confirm` | Verified Auth customer | Creation uses the Auth UUID; confirmation RPC receives that UUID and retains its ownership check |
| `GET /errands/` | Verified Auth customer or existing runner role; unsupported profile roles receive 403 | Client-capable roles query only their own `client_id`; runner uses the existing visibility filter |
| `GET /errands/transactions/:userId`, `GET /errands/analytics/:userId` | Verified Auth customer or existing runner role | Path ID must equal the Auth UUID; data query uses that ID |
| `POST /errands/:id/dispute`, `GET /errands/wallet`, `POST /errands/verify-otp` | Verified Auth customer or existing runner role | Dispute still requires client/assigned-runner participation; wallet and OTP use the Auth UUID |
| `POST /pin/set`, `/pin/create`, `/pin/verify` | Verified Auth customer or existing runner role | Existing PIN lookup/update remains keyed by the Auth UUID |
| `POST /paystack/initialize`, `GET /paystack/verify/:reference` | Verified Auth customer or existing runner role | Payment records remain associated with the Auth UUID and verification remains ledger-owner scoped |

Runner-only errand acceptance/completion, KYC, storage, and admin route middleware were not changed. Public placeholders and machine-to-machine routes listed in Phase 4.1 were not converted into customer-auth endpoints because they do not currently grant protected customer-record access. In particular, `/otp/verify` remains a success-shaped placeholder and must not be used as evidence of Auth email verification.

## 4. Socket.IO events remediated

| Event | Enforcement after remediation |
|---|---|
| Connection | Validates the Bearer token and matching profile ID; rejects unsupported roles. Unverified customers cannot connect. Existing runner/admin non-customer connections do not require customer email verification. |
| `join:errand` | Customer membership requires Auth email verification and matching `client_id`; runner membership requires role `runner` and matching `assigned_runner_id`. A room is joined only after authorization succeeds. |
| `location:update` | Requires role `runner`, assignment to the errand, a valid errand record, and prior membership in that errand room. |
| `join:user` | Submitted ID must exactly match the Auth UUID; the server joins only the corresponding user room. Unverified runner/admin access is limited to their own room as a non-customer account path. |
| `disconnect` | Unchanged; it only logs disconnection. |

## 5. Authentication and ownership behavior

**Before:** Supabase Auth token validation and profile lookup existed, but email confirmation was enforced only when the profile role was exactly `client`. Account-scoped routes without role middleware therefore accepted unverified non-client profiles. `/errands` could return an unfiltered list for an unexpected non-empty role. Socket connections and `join:user` had equivalent alternate-role gaps.

**After:** Customer access is based on the validated Auth user, a valid Auth confirmation timestamp, and the matching profile resolved for that Auth UUID. A profile role or client-supplied field cannot establish verification. Customer list and resource handlers retain explicit ownership checks. Existing runner access is preserved through explicit runner paths rather than weakening the customer guard.

`public.users` and its PIN hashes/schema were not migrated or rewritten. PIN handlers continue to use the authenticated UUID. No changes were made to migrations or database objects.

## 6. Tests and verification

Executed from `/workspaces/ers-backend-worktree`:

```text
node --test services/api/tests/authMiddleware.test.js services/api/tests/securityRemediation.test.js services/api/tests/socketTracking.integration.test.js
40 passed, 0 failed
```

The tests mock Supabase Auth/profile/database access. Socket tests use a local in-process Socket.IO server/client with mocked identity and errand lookups. They are not database, RLS, or production integration tests.

Also passed:

- `node --check` for all changed source and test files.
- `git diff --check`.
- Existing payout containment tests in `securityRemediation.test.js`.

The database-backed `auth.e2e.test.js` was not run because it may perform database writes and no disposable database target was established.

## 7. Remaining gaps and compatibility

- Runner approval/suspension policy, profile-role mutation protections, administrator MFA/AAL2, and durable administrative audit records remain outside this phase.
- No disposable Supabase/RLS integration validation was performed. Production database policies and profile eligibility beyond a matching profile row remain unverified.
- `/errands/verify-otp` contains a pre-existing unresolved `db` reference; its new access guard does not repair that handler implementation.
- Public success-shaped placeholders, including `/otp/verify`, remain unchanged and must not be treated as verification or provisioning.
- Admin routes retain their existing `authorizeAdmin()` behavior; this change does not add MFA.
- Financial withdrawals and recipient-creation aliases remain disabled. Their regression tests pass. No payout endpoint was enabled or changed.

## 8. Operational confirmation

No database or migration operation, production access, deployment, package installation, commit, push, or merge occurred. Existing dirty and untracked work was preserved. The Phase 4.1 recommendation remains conditional on disposable-database/RLS validation before relying on this API for production website customer authentication.
