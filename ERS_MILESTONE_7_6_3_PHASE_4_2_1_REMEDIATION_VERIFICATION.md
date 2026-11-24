# ERS Milestone 7.6.3 — Phase 4.2.1 Remediation Verification

**Date:** 2026-11-24
**Scope:** Backend source review and targeted access remediation in `/workspaces/ers-backend-worktree`.

## Executive assessment

**NO-GO for full customer/runner dashboard integration.**

The Phase 4.2 code did not fully close all Phase 4.1 findings. In particular, its shared customer guard let any verified profile role through, and role-only runner checks allowed unverified or suspended runner profiles to reach runner operations. This verification corrected those authorization paths using the checked-in KYC approval and runner availability records.

The `/errands/verify-otp` handler still cannot be safely repaired in this task. Its `db` symbol is undefined, and the checked-in OTP schema has no creation timestamp for the handler’s implied “latest OTP” lookup. The mobile app calls a different public placeholder endpoint. Guessing which flow or OTP record should be authoritative could accept the wrong code or falsely confirm a device.

The code now has useful mocked coverage for Auth verification, customer ownership, approved/active runner checks, suspension behavior, sockets, and payout containment. The approved customer-first runner lifecycle is still incomplete: a client-role customer cannot submit the current KYC application route, rejected KYC cannot be resubmitted, and no explicit revoked state exists. Database/RLS behavior has not been validated in a disposable Supabase project.

## 1. Phase 4.1 findings: verified status

| Phase 4.1 finding | Status | Source-based assessment |
|---|---|---|
| Email confirmation was conditional on profile role, so non-client roles could reach customer account routes | **Resolved for protected account operations** | Customer guards now require a valid Auth confirmation timestamp and supported customer profile role (`client` or `runner`). Unverified customers and runners are rejected. Admin routes retain their separate existing authorization. Public placeholders are called out separately below. |
| Unknown roles could receive an unfiltered `GET /errands` result | **Resolved** | The handler admits only `client` and `runner`. Client and inactive/pending runner profiles are filtered to their own `client_id`; only an approved, active runner gets the runner visibility filter. Unsupported roles are rejected before the errands query. |
| Socket.IO user-room and errand-event authorization did not fully enforce customer/runner capability | **Resolved in the inspected default Socket.IO path** | Socket authentication derives identity from the validated token and matching profile. Customer/runner sockets require confirmed Auth email. `join:user` is restricted to the authenticated user ID. Customer errand joins require ownership; runner joins and location updates check assignment and re-check active runner capability. |
| Malformed truthy confirmation timestamps passed | **Resolved** | `isEmailVerifiedAuthUser` validates timestamp structure and calendar/time components in addition to parsing. Tests cover invalid text and an impossible calendar date. |
| Customer dashboard route coverage was not established | **Partially resolved** | The reviewed account-specific API routes now use guards and ownership checks. This is not a browser/mobile dashboard integration or a database/RLS validation. The mobile OTP endpoint remains a public success-shaped placeholder, and the customer-to-runner application lifecycle remains incomplete. |
| Profile role remained security-sensitive | **Partially resolved** | A profile role alone no longer grants runner business capability: that requires the Auth-confirmed session, runner role, profile verification, approved KYC status, and an active `runners.is_available` record. Database policy/role mutation safety remains unverified. |

### Phase 4.2 assertions independently checked

- The previous tests did not establish the required behavior merely by name: one explicitly asserted that an unverified runner could continue through a shared account route and another allowed an unverified runner socket. Those assertions were corrected.
- The previous shared customer guard continued through for any verified role. It now allows only `client` and `runner` customer accounts; other roles do not inherit customer access.
- The active runner check is backed by source-confirmed fields: KYC approval updates `kyc_profiles.status` to `approved` and `profiles.verified` to true; admin runner activation/suspension updates `runners.is_available`. Capability checks fail closed if either record is absent, inactive, or returns a database error.
- This is source-level validation only. The table contents, policies, and production behavior were not queried.

## 2. REST route and authorization review

The `errands`, `pin`, and `paystack` routers are mounted under both normal and `/api` prefixes. Their aliases share the same route middleware.

| Routes | Current check | Ownership/capability result |
|---|---|---|
| `GET /wallet`, `GET /api/wallet`; `GET /errands/wallet` and alias | Authenticated, confirmed `client` or `runner` account | Reads only the authenticated UUID’s wallet. A suspended runner retains customer wallet access. |
| `POST /errands/`, `POST /errands/:id/confirm` and aliases | `authorizeCustomer()` | Requires confirmed Auth email and `client`/`runner` profile. Creation and escrow confirmation derive the customer ID from `req.user`; the existing atomic confirmation RPC keeps its ownership check. |
| `GET /errands/` and alias | Confirmed supported customer account | Client and non-active runner accounts see only their own customer errands. Runner marketplace results require confirmed email, verified profile, approved KYC, and active runner record. Unknown roles fail before querying errands. |
| `POST /errands/:id/accept`, `POST /errands/:id/complete` and aliases | `authorizeActiveRunner()` plus existing atomic RPC | Requires `role=runner`, confirmed Auth email, `profiles.verified=true`, approved KYC, and `runners.is_available=true`. |
| Transactions, analytics, dispute, PIN, Paystack initialize/verify, OTP-by-errands | Confirmed `client` or `runner` account via `authorizeCustomerOrRoles()` | IDs and transaction ownership are derived from `req.user`; dispute still requires client/assigned-runner participation. The OTP route itself is broken for verified callers; see Section 4. |
| `POST /kyc/verify`, `POST /storage/upload` | `authorizeRunnerApplication()` | Requires a confirmed Auth email and an existing `runner` profile role, but deliberately does not require KYC approval so pending applicants can submit/update KYC and upload documents. It does not let a plain `client` role apply; this is a lifecycle gap. |
| Admin routes | Existing `authenticate` + `authorizeAdmin()` | No admin route middleware was changed. This does not establish MFA/AAL2 or database-backed admin provenance. |

The reviewed account routes use Auth-derived identity; caller-provided `x-user-id`, `x-role`, body IDs, and verification fields do not set `req.user`. Existing cross-account transaction checks and errand/RPC ownership checks remain in place. The targeted tests exercise forged identity headers/body fields and foreign resource access.

## 3. Socket.IO review

| Event | Current authorization |
|---|---|
| Connection | Valid Bearer token and matching profile are required. Customer and runner profiles require Auth email confirmation. Supported profile roles are explicit. Suspended/pending runner profiles may still connect as verified customers, but connection does not confer runner capability. |
| `join:errand` | Room join follows a resource lookup and ownership check. A runner acting as customer can join their own customer errand; assigned-runner access requires the active capability check. |
| `location:update` | Requires an existing errand, active runner capability, assignment to that errand, and prior membership in the errand room. Capability is rechecked at event time so a later suspension is effective for subsequent events. |
| `join:user` | Only the authenticated UUID’s room can be joined. Client/runner profiles require verified email; a suspended runner retains their own account room as customer access. |
| `disconnect` | Logging only. |

The socket tests use an in-process Socket.IO server, but Auth, profile, runner capability, and errand data are mocked. No real database, RLS, or concurrent suspension behavior is established.

## 4. `/errands/verify-otp` investigation

### Confirmed implementation defect

The handler in `services/api/routes/errands.js` references `db.otp.findLatest()` and `db.otp.update()` but imports no `db` module, declares no `db`, and initializes no ORM client. A verified request reaches a `ReferenceError` and is handled as an API 500. The route has no local error handling.

The active handler is protected by the customer verification guard and derives `userId` from `req.user.id`; the submitted identity is not trusted. An unverified customer is rejected before the broken handler runs.

### Why it was not patched

- The backend has a checked-in `public.otp_codes` schema (`id`, `user_id`, `code`, `expires_at`, `used`), but it has no `created_at`/issuance sequence field. The `findLatest(userId)` behavior implied by the stale code cannot be reproduced safely from the schema without choosing a proxy such as expiry ordering.
- No checked-in active OTP issuance/generation service or caller of `/errands/verify-otp` was found.
- The mounted `/otp/verify` route is a separate unauthenticated placeholder that always responds with success. `apps/mobile/screens/otpscreen.tsx` calls that route with `code`, `x-user-id`, and `x-role`, then reports “Device verified successfully”; it does not call `/errands/verify-otp`. The older, unmounted `services/api/server/routes/otp.js` trusts `x-user-id`/`x-device-id` and also references undefined `db` and `db.devices`.
- The checked-in schema review says RLS is enabled on `otp_codes` with no policies. No service-level OTP persistence pattern exists to confirm how issued codes are written or consumed.

Because “latest code” and device trust semantics cannot be established from the active caller and schema, no OTP query/update was invented. No OTP verification success/failure test was added that would encode an unverified data contract. The `/errands/verify-otp` defect and mobile placeholder are explicit blockers for OTP/device verification integration.

## 5. Customer-first runner lifecycle assessment

| User state | Customer access | Runner capability | Verified implementation |
|---|---|---|---|
| Verified customer, no application | Allowed for `client` profile | Denied | Customer guards permit only confirmed customer roles; runner-only middleware rejects non-runner role. |
| Draft application | Not represented as a distinct state | Denied absent approval/active records | No draft application model or route was found. |
| Pending review | Retained for a confirmed `runner` profile | Denied | KYC `pending` does not satisfy `hasActiveRunnerCapability`. |
| Rejected | Retained for a confirmed `runner` profile | Denied | KYC `rejected` does not satisfy the capability guard. Existing KYC service refuses resubmission and directs the applicant to support. |
| Approved and active | Retained | Allowed only when runner role, profile verified, KYC approved, and runner record active | This matches current approved/active records; mocked tests cover it. |
| Suspended | Retained | Denied for runner-only REST/socket actions; runner marketplace access removed | Admin suspension sets `runners.is_available=false`; guard rechecks that field. Customer errand listing falls back to the authenticated user's own errands. |
| Revoked | Retained if Auth/profile remains eligible | No first-class revoked state or revocation action found; missing/inactive capability records fail closed | Cannot verify an explicit revoked lifecycle state. |

### Lifecycle gaps

- The KYC application and document-upload routes require the profile role to already be `runner`. A verified `client` cannot start the current application flow using these routes.
- KYC approval requires an existing runner role; no checked-in customer-to-runner role transition/application provisioning flow was found.
- Rejected KYC cannot be resubmitted by the applicant through the current service. The approved reapplication requirement is not met.
- There is no separate draft/revoked application status or runner revocation workflow. Do not treat KYC status and availability as a complete substitute for a reviewed application lifecycle.

Therefore the implementation preserves customer access during pending/rejected/suspended states for accounts already represented as verified `runner` profiles, but it does not implement the complete approved “customer registers first, then applies” lifecycle.

## 6. Tests and verification

Required focused command, run from `/workspaces/ers-backend-worktree`:

```text
node --test services/api/tests/authMiddleware.test.js services/api/tests/securityRemediation.test.js services/api/tests/socketTracking.integration.test.js
```

**Result: 45 passed, 0 failed.**

Coverage includes:

- Confirmed and unconfirmed Auth users, malformed timestamps, missing/invalid tokens, missing profiles, forged identity/role inputs.
- Pending/rejected/suspended runner access denial for runner capability, active approved runner acceptance, and customer access retained for suspended runner accounts.
- Unknown-role errand listing denial, customer resource ownership, socket room and errand ownership, active runner rechecks, and runner/admin middleware compatibility.
- Existing disabled withdrawal/recipient aliases and Paystack containment regressions.

Tests use mocks for Auth, profiles, KYC, runners, errand resources, and RPCs. The socket server itself runs locally in-process. No test establishes real Supabase database or RLS behavior. No OTP-success test was run because the persistence contract remains ambiguous. The database-backed `auth.e2e.test.js` was not run because it may write data and a disposable Supabase target was not established.

Also passed:

- `node --check` on every JavaScript source/test file modified in this verification.
- `git diff --check`.

## 7. Files modified in this verification

- `services/api/modules/protect/authService.js` — shared active-runner capability lookup using existing KYC and runner records.
- `services/api/modules/protect/authorize.js` and `services/api/modules/protect/index.js` — customer-role validation, verified runner-application guard, and approved/active runner guard.
- `services/api/routes/errands.js` — active runner checks for accept/complete and runner marketplace; inactive runner listing is scoped to customer-owned errands.
- `services/api/server/socket.js` — verified runner identity and per-event active capability enforcement while retaining customer room access.
- `services/api/routes/kyc.js` and `services/api/routes/storage.js` — runner-application operations require verified email.
- `services/api/tests/authMiddleware.test.js`, `services/api/tests/securityRemediation.test.js`, and `services/api/tests/socketTracking.integration.test.js` — corrected prior unverified-runner assertions and added lifecycle/capability cases.
- This report.

At task start the worktree was already dirty on branch `feat/backend-security-hardening`, HEAD `9b31d7211089a172e15e6b8fce512f75f3a725b7`. Existing modified and untracked reports, tests, migration, API files, and prior storage changes were preserved. `services/api/routes/storage.js` already contained unrelated uncommitted content; this verification retained it and changed only the route authorization import/use in addition to the prior code.

## 8. Runner/admin compatibility and financial protections

- Verified, approved, active runners retain runner errand and socket operations. Pending/unverified/suspended profiles do not gain runner capability from `profiles.role` alone.
- Confirmed suspended runners retain their own customer wallet/errand access where the shared route supports customer access.
- Admin routes and `authorizeAdmin()` were not modified. Existing admin middleware tests pass. Administrator MFA/AAL2 and durable admin audit requirements remain outside this task and unverified.
- Withdrawal and recipient-creation aliases remain disabled. Their regression tests passed; no financial endpoint was enabled.

## 9. Safety and operation confirmation

- No SQL or migration was modified or executed.
- No database writes, database connections, production/Preview access, or environment/credential inspection occurred.
- No packages were installed.
- No commit, push, merge, or deployment occurred.
- No staged changes were introduced.

## 10. Recommendation

**NO-GO for full email-verification and customer/runner dashboard integration.**

The backend’s protected customer API checks are substantially stronger and can be evaluated further in a disposable Supabase environment. Before full integration, resolve the OTP/device verification contract and remove the public success-shaped placeholder; implement a customer-role runner application/approval transition, rejected-applicant reapplication, and an explicit revocation policy; then validate the resulting rules against disposable database/RLS fixtures. Do not rely on mocked tests as evidence of production database authorization.
