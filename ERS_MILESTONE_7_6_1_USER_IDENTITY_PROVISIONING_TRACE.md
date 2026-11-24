# ERS Milestone 7.6.1 — User Identity Provisioning Trace

**Scope:** Read-only repository investigation of `public.users` provisioning, authentication, identity relationships, authorization, account lifecycle, and financial identity.

**Repository state at investigation:** `/workspaces/ers-website-worktree`, branch `feat/website-monorepo-migration`, HEAD `9b31d7211089a172e15e6b8fce512f75f3a725b7`. This report is the only file created for this task. Existing dirty changes were preserved. No Supabase connection, database write, migration, installation, or external operation was performed.

## Executive summary

The checked-in code contains two parallel identity stores:

1. Supabase `auth.users` is the credential/session source used by the current website, current mobile navigation/auth provider, and API Bearer-token middleware.
2. `public.users` is a legacy application table containing a separate UUID primary key, email, an unused-looking password field, role and financial/security fields such as `withdrawal_pin`, `pin_set`, and `kyc_verified`.

The repository does **not** show a production website/mobile/backend flow that inserts or upserts `public.users`. Its inserts/deletes are in integration-test setup and teardown; the only non-test direct `public.users` queries found are the legacy PIN route’s updates and reads. The current backend authentication middleware does not load `public.users`: it verifies the Supabase token, then looks up `public.profiles` using the Supabase user UUID. The base checked-in schema does not declare a foreign key from `public.users.id` to `auth.users.id` or `public.profiles.id`. Similar UUID values in test fixtures and application code therefore demonstrate a convention, not a database-enforced identity relationship.

This leaves new-account flows inconsistent. The current mobile signup calls Supabase Auth but does not provision either `public.users` or `public.profiles` directly. The website provisions `public.profiles` through its profile endpoint and a proposed migration trigger; it does not provision `public.users`. Legacy mobile source sends a role in signup metadata and upserts `profiles`, but the application entry point uses a different, newer auth flow. The proposed website migration is present in the worktree but has not been run as part of this investigation.

The highest-risk findings are unauthenticated financial and identity-sensitive endpoints that trust caller-supplied `x-user-id` or `x-runner-id`, including a Paystack transfer route. Separately, most guarded business APIs use the Supabase token correctly but then trust `profiles.role` as authority. The schema contains no durable, enforced relationship tying the `public.users` financial/PIN record to Supabase Auth.

No live database, production settings, secrets, or environment-variable values were inspected. Repository snapshots and source do not establish the live schema or deployed behavior.

## Complete identity and provisioning flow

### Website

1. [customer-auth.ts](/workspaces/ers-website-worktree/apps/website/lib/customer-auth.ts:14) calls `auth.signUp` with email/password and only `full_name` metadata; login calls `signInWithPassword` at line 47.
2. [customer-auth-form.tsx](/workspaces/ers-website-worktree/apps/website/app/auth/customer-auth-form.tsx:58) submits signup and login. When the signup/login session is immediately usable, it calls `/api/customer/profile` (lines 79-86 and 111-119).
3. [customer-profile.ts](/workspaces/ers-website-worktree/apps/website/lib/customer-profile.ts:47) provisions `public.profiles`, keyed by `user.id`, with role `client`; this is not `public.users`.
4. [20261122111500_customer_identity_web.sql](/workspaces/ers-website-worktree/apps/website/supabase/migrations/20261122111500_customer_identity_web.sql:26) defines `handle_new_user()` and lines 46-49 attach it to `auth.users`. The trigger inserts into `public.profiles`, not `public.users`. The migration is a checked-in proposal; whether it has been applied outside this repository is not verified.
5. Website authorization checks email verification and then requires `profiles.role === "client"` in [proxy.ts](/workspaces/ers-website-worktree/apps/website/proxy.ts:55) and [customer-profile.ts](/workspaces/ers-website-worktree/apps/website/lib/customer-profile.ts:73).

### Mobile

The current app entry [App.tsx](/workspaces/ers-website-worktree/apps/mobile/App.tsx:7) uses `src/context/AuthContext` and [RootNavigator.tsx](/workspaces/ers-website-worktree/apps/mobile/src/navigation/RootNavigator.tsx:1). That context exports [AuthProvider.tsx](/workspaces/ers-website-worktree/apps/mobile/src/providers/AuthProvider.tsx:1), which calls Supabase `signInWithPassword` and `signUp` (lines 92-117). The current [RegisterScreen.tsx](/workspaces/ers-website-worktree/apps/mobile/src/screens/auth/RegisterScreen.tsx:67) calls that signup function. It does not insert `public.users` or `public.profiles` itself.

There is a separate legacy screen at [AuthScreen.tsx](/workspaces/ers-website-worktree/apps/mobile/screens/AuthScreen.tsx:130) which upserts `profiles` with a caller-selected `role`, and sends that role in `user_metadata` at lines 157-164. The current `App.tsx` imports the `src` navigation stack rather than this legacy screen; its presence still matters as a reachable-code/alternate-flow risk if wired back in. The shared auth provider's current signup does not include that role metadata.

### Backend

There is no production registration endpoint or checked-in production `public.users` insert/upsert found in the backend. The backend’s [authenticate.js](/workspaces/ers-website-worktree/services/api/modules/protect/authenticate.js:15) requires a Bearer token, calls Supabase `auth.getUser(token)` through [authService.js](/workspaces/ers-website-worktree/services/api/modules/protect/authService.js:3), then resolves the application record from `public.profiles` by the Supabase user ID at [authService.js](/workspaces/ers-website-worktree/services/api/modules/protect/authService.js:29). `req.user.id` is set to the Supabase Auth user ID at [authenticate.js](/workspaces/ers-website-worktree/services/api/modules/protect/authenticate.js:47).

Test helpers create `auth.users` with Supabase’s admin API, then create application records separately. See [supabaseAuth.js](/workspaces/ers-website-worktree/services/api/tests/helpers/supabaseAuth.js:43) and [auth.e2e.test.js](/workspaces/ers-website-worktree/services/api/tests/auth.e2e.test.js:35). These fixtures reuse the Auth UUID when inserting `public.users`, profiles, wallets, and runners; that is test behavior, not an enforced production relationship.

## `public.users` write/read inventory

### Production application code

- **UPDATE:** [pin.js](/workspaces/ers-website-worktree/services/api/routes/pin.js:9) updates `public.users.withdrawal_pin` and `pin_set`; the `userId` comes from `x-user-id` (line 10).
- **READ:** [pin.js](/workspaces/ers-website-worktree/services/api/routes/pin.js:46) selects `withdrawal_pin` from `public.users`; the lookup identity is also caller-supplied `x-user-id` (line 47).
- **INSERT/UPSERT:** No production source insert/upsert into `public.users` was found.
- **DELETE:** No production account deletion path deleting `public.users` or a Supabase identity was found.

### Test-only writes and cleanup

Integration test setup inserts `public.users` rows after creating or constructing an Auth UUID, including [auth.e2e.test.js](/workspaces/ers-website-worktree/services/api/tests/auth.e2e.test.js:35), [acceptErrand.integration.test.js](/workspaces/ers-website-worktree/services/api/tests/acceptErrand.integration.test.js:86), and [paystackWalletFunding.integration.test.js](/workspaces/ers-website-worktree/services/api/tests/paystackWalletFunding.integration.test.js:73). Test teardown deletes rows and Auth test users, e.g. [auth.e2e.test.js](/workspaces/ers-website-worktree/services/api/tests/auth.e2e.test.js:486). These test fixtures are not a signup/provisioning implementation.

## Authentication and authorization dependencies

### Supabase authentication and identity mapping

- Current web and mobile email/password auth use Supabase Auth. No production password authentication against `public.users.password` was found.
- The database snapshot defines `public.handle_new_user()` to insert into `public.profiles` using a role from `raw_user_meta_data` in [20260718111426_remote_schema.sql](/workspaces/ers-website-worktree/supabase/migrations/20260718111426_remote_schema.sql:26). The snapshot does not contain a `CREATE TRIGGER` statement attaching that function. The website proposal later attaches a replacement trigger, but only to `profiles`.
- The current backend maps `auth.users.id` to `profiles.id` by equality in the application query. In the baseline schema snapshot, `profiles.id` is a primary key but has no FK to `auth.users`. The proposed website migration adds a `NOT VALID` FK from `profiles.id` to `auth.users.id` at [20261122111500_customer_identity_web.sql](/workspaces/ers-website-worktree/apps/website/supabase/migrations/20261122111500_customer_identity_web.sql:11); the target database state remains unverified.
- `public.users.id` is an independent primary key with a random UUID default and no FK to `auth.users` or `profiles` in the checked-in snapshot. Therefore UUID equality alone is not referential integrity.
- `authenticate` loads authorization role from `profiles.role`, not `public.users.role` or verified metadata. [authorize.js](/workspaces/ers-website-worktree/services/api/modules/protect/authorize.js:30) checks this value for required roles.
- Mobile `apiFetch` sends `x-user-id`, `x-role`, and `x-runner-id` from local client state and also sends a Bearer token when available; see [api.ts](/workspaces/ers-website-worktree/apps/mobile/src/services/api.ts:246). Guarded routes generally derive identity from `req.user`, but several unguarded routes trust these headers directly.

### Role and lifecycle dependencies

- `public.users`, `profiles`, mobile metadata, and the shared role type all carry overlapping role/verification concepts. The checked-in `profiles_role_check` allows client/runner/admin in [remote_schema.sql](/workspaces/ers-website-worktree/supabase/migrations/20260718111426_remote_schema.sql:225); `public.users` has a separate role column at lines 308-319.
- KYC submission requires `authenticate` and `authorize("runner")` in [kyc.js](/workspaces/ers-website-worktree/services/api/routes/kyc.js:17). KYC approval/rejection runs through admin-guarded endpoints in [adminKyc.js](/workspaces/ers-website-worktree/services/api/routes/adminKyc.js:65) and [adminKyc.js](/workspaces/ers-website-worktree/services/api/routes/adminKyc.js:97), with service logic in [kycService.js](/workspaces/ers-website-worktree/services/api/services/kycService.js:145).
- Rejected KYC is explicitly blocked from resubmission in [kycService.js](/workspaces/ers-website-worktree/services/api/services/kycService.js:58).
- Runner approval requires the profile already to have role `runner` in [kycService.js](/workspaces/ers-website-worktree/services/api/services/kycService.js:156). Runner acceptance also checks profile role and runner-record availability in [20260902_fix_accept_errand_atomic.sql](/workspaces/ers-website-worktree/supabase/migrations/20260902_fix_accept_errand_atomic.sql:42).
- Admin suspension/activation changes only `runners.is_available` through [runnerManagementService.js](/workspaces/ers-website-worktree/services/api/services/runnerManagementService.js:136) and endpoints in [adminRunners.js](/workspaces/ers-website-worktree/services/api/routes/adminRunners.js:62). It does not change `profiles.role`. The website customer guard only accepts `client`, so a runner profile does not automatically retain customer-route access.
- No production account deletion endpoint or coordinated deletion routine was found. Test cleanup deletes tables and Auth test users manually. Existing FKs do not comprehensively cascade account deletion.

## Database identity relationships

The following are confirmed in the checked-in snapshot [20260718111426_remote_schema.sql](/workspaces/ers-website-worktree/supabase/migrations/20260718111426_remote_schema.sql); they are not claims about the live database.

| Object | Snapshot facts | Identity relationship |
|---|---|---|
| `auth.users` | Supabase Auth identity source used by API `auth.getUser` | Canonical authentication UUID |
| `public.users` | `id` UUID PK; `email` unique; nullable `password`; `full_name`, `role`, `withdrawal_pin`, `pin_set`, `kyc_verified`, `risk_score` (lines 308-319) | No FK to `auth.users` or `profiles` in snapshot |
| `public.profiles` | `id` UUID PK; email and role; KYC/personal fields; `verified` (lines 212-225) | No FK to `auth.users` in snapshot; API assumes `profiles.id = auth.users.id` |
| `public.runners` | `id` PK plus name, email, earnings, availability and coordinates (lines 232-240) | FK `runners.id -> public.users.id ON DELETE CASCADE` at line 488 |
| `public.kyc_profiles` | UUID PK; nullable `user_id`, name, phone, BVN, bank and documents/status fields (lines 147-160) | No FK from `user_id` to `users`, `profiles` or `auth.users` in snapshot |
| `public.wallets` | UUID PK, nullable `user_id`, balances (lines 325-333) | `user_id` unique (line 435), but no FK in snapshot |
| `public.transactions` | UUID PK, errand and financial/metadata fields (lines 281-293); later migrations add `user_id`, `client_id`, `runner_id` | Snapshot only has `transactions.errand_id -> errands.id`; no account FK is declared |
| `public.jobs` | client and runner UUID fields (lines 129-144) | `client_id` and `runner_id` both reference `public.users.id` (lines 478, 483) |
| `public.otp_codes`, `public.user_devices` | Both have nullable `user_id` (lines 184-190 and 296-303) | No user FK shown |
| `public.audit_logs` | `actor_id` UUID | FK to `auth.users.id` (line 468), unlike most application records |

### Financial identity

- A protected wallet handler at [errands.js](/workspaces/ers-website-worktree/services/api/routes/errands.js:474) uses `req.user.id` and filters by `wallets.user_id`.
- The Paystack initialization route authenticates and writes `transactions.user_id = req.user.id` at [paystack.js](/workspaces/ers-website-worktree/services/api/routes/paystack.js:63) and line 109. The verification route filters ledger records by both payment reference and `req.user.id` at lines 193-222. The webhook verifies the provider signature and credits by transaction ledger ownership at lines 363-491.
- The atomic errand-creation routine uses the authenticated API identity passed as `p_client_id` to lock/debit a wallet, create the errand, and write a transaction in [20260826_sprint6_atomic_errand_creation.sql](/workspaces/ers-website-worktree/supabase/migrations/20260826_sprint6_atomic_errand_creation.sql:25). That is an application-provided mapping; the snapshot does not enforce wallet or transaction user IDs as FKs to an identity table.
- The legacy `public.users.withdrawal_pin` route is disconnected from the current secure Paystack identity flow and accepts a raw header identifier. A separate withdrawal implementation in [errands.js](/workspaces/ers-website-worktree/services/api/routes/errands.js:504) uses a `db.user` abstraction and `pin_hash` fields not present in the snapshot’s `public.users` definition; the relationship between that path and `withdrawal_pin` cannot be established from the checked-in schema.

## Security findings ranked by severity

### 1. CRITICAL — Unauthenticated transfer route trusts `x-runner-id`

- **Files/objects:** [errands.js](/workspaces/ers-website-worktree/services/api/routes/errands.js:270), mounted under `/api/errands` by [app.js](/workspaces/ers-website-worktree/services/api/app.js:143); reads and updates `public.wallets`, inserts `public.transactions`, calls Paystack transfer.
- **Issue:** `POST /api/errands/paystack/withdraw` has no `authenticate` middleware and selects wallet owner from `req.headers['x-runner-id']` (route line 271). It checks that selected wallet’s balance, sends a Paystack transfer using a caller-supplied `recipient_code`, then debits that wallet (lines 274-315).
- **Scenario:** An unauthenticated caller who can obtain or guess a wallet owner UUID can submit that UUID and a recipient, causing the server’s Paystack credentials to initiate a transfer against the platform’s Paystack balance, followed by a wallet debit. RLS does not protect this route because the backend uses its server-side Supabase service client.
- **Existing control / insufficiency:** It checks the selected wallet’s available balance, but does not verify the caller’s Supabase identity, runner role, ownership, approval or recipient relationship.
- **Recommended remediation:** Require verified Bearer authentication, derive identity only from `req.user.id`, check server-side active runner capability and approved payout recipient, validate amount/currency/limits, and execute debit/ledger/transfer lifecycle atomically with idempotency and audit.
- **Regression/acceptance:** Anonymous requests rejected; spoofed `x-runner-id` ignored; one user cannot cause a transfer from another user’s wallet; only approved active runner can withdraw; repeated requests cannot double-send; all transfer transitions are ledgered.
- **Change type:** Source change and likely database/ledger changes.

### 2. HIGH — Unauthenticated PIN set and verification use caller-controlled identity

- **Files/objects:** [pin.js](/workspaces/ers-website-worktree/services/api/routes/pin.js:9), mounted at `/pin` and `/api/pin` in [app.js](/workspaces/ers-website-worktree/services/api/app.js:138); `public.users.withdrawal_pin`.
- **Issue:** Both `/set` and `/verify` lack `authenticate` and select the target `public.users` row with `x-user-id` (pin.js lines 10-23 and 46-65). `/create` forwards to `/set`.
- **Scenario:** A caller can set or replace the withdrawal PIN for an arbitrary account ID, or use the verify endpoint as a PIN-check oracle. The PIN is bcrypt-hashed, but hashing does not protect the unauthenticated target selection.
- **Existing control / insufficiency:** PIN length is checked on set and bcrypt comparison is used on verify. Neither binds the request to a verified account, proves a legitimate PIN change, nor provides attempt throttling in these handlers.
- **Recommended remediation:** Authenticate every operation, derive target ID from the token, require reauthentication/step-up for PIN changes, rate-limit and lock verification attempts, and avoid returning account-existence distinctions.
- **Regression/acceptance:** Anonymous requests fail; forged user IDs cannot set or test another account PIN; repeated guesses are throttled; only the authenticated user’s PIN changes.
- **Change type:** Source change; schema may be needed for attempt/lock/audit state.

### 3. HIGH — Wallet balance endpoint exposes caller-selected wallet

- **Files/objects:** [app.js](/workspaces/ers-website-worktree/services/api/app.js:74), route alias at lines 113-116; `public.wallets`.
- **Issue:** `/wallet` and `/api/wallet` read a wallet selected by `x-user-id` without authentication.
- **Scenario:** An unauthenticated caller who knows another UUID can retrieve that wallet’s balances. Mobile sends the header, but client header use is not proof of identity.
- **Existing control / insufficiency:** Requires a nonempty ID and handles missing-wallet results. It does not verify the header against a Supabase token. A separate protected `/api/errands/wallet` handler exists, but does not protect this distinct route.
- **Recommended remediation:** Remove or protect the unguarded endpoint; derive ID from `req.user.id`; ensure mobile calls only the protected route and reject spoofed identity headers.
- **Regression/acceptance:** Anonymous access fails; a valid user sees only their own wallet; changed `x-user-id` has no effect; route aliases share the same access control.
- **Change type:** Source change.

### 4. HIGH — Unauthenticated runner-document upload trusts `x-user-id`

- **Files/objects:** [storage.js](/workspaces/ers-website-worktree/services/api/routes/storage.js:48), mounted under `/storage` and `/api/storage` by [app.js](/workspaces/ers-website-worktree/services/api/app.js:141); [storageService.js](/workspaces/ers-website-worktree/services/api/services/storageService.js:10); KYC document paths in `public.kyc_profiles`.
- **Issue:** Upload route has no authentication middleware and passes a caller-selected `x-user-id` to `uploadRunnerDocuments`.
- **Scenario:** A caller can target another identity’s pending KYC record and write documents/update paths under that user’s application, potentially replacing or polluting evidence reviewed by an administrator.
- **Existing control / insufficiency:** File type/size limits and a pending-KYC check exist, but the pending-record check is keyed by the unverified caller-provided identity. Backend storage uses elevated server credentials.
- **Recommended remediation:** Require authentication and derive owner from `req.user.id`; require an eligible application state; use server-checked object paths and audit document replacement.
- **Regression/acceptance:** Anonymous uploads fail; caller cannot target another user’s KYC record/path; non-pending applications reject writes; document changes are auditable.
- **Change type:** Source change; likely storage/RLS policy review.

### 5. HIGH — No enforced identity relationship for `public.users`

- **Files/objects:** `public.users`, `public.profiles`, `public.runners`, `public.kyc_profiles`, `public.wallets`, and `public.transactions` in [remote_schema.sql](/workspaces/ers-website-worktree/supabase/migrations/20260718111426_remote_schema.sql:147), lines 212-240, 281-333, and constraints at 468-493; API mapping in [authService.js](/workspaces/ers-website-worktree/services/api/modules/protect/authService.js:29).
- **Issue:** Auth middleware maps `auth.users.id` to `profiles.id` by equality, while `public.users` is independently keyed. The snapshot has no FK from `public.users.id` to Auth; KYC and wallet user IDs likewise lack account FKs. Only `runners.id` references `public.users.id`; jobs reference users, and audit actor references auth.
- **Scenario:** A deleted, missing or mismatched application row can be mistaken for or detached from an Auth identity. A valid profile-auth match does not prove that the corresponding public user, wallet, KYC or runner record belongs to that same person.
- **Existing control / insufficiency:** Integration tests deliberately reuse Auth UUIDs for application rows; UUID equality in test setup does not enforce production consistency. The website proposal adds a profile-to-auth FK but does not link `public.users`.
- **Recommended remediation:** Decide which application table is canonical; inventory duplicate/orphan rows; establish explicit FKs and unique constraints only after verified mapping; preserve financial ledger history and use a controlled dual-read/dual-write migration where necessary.
- **Regression/acceptance:** Orphan/mismatched IDs are detectable; new rows must reference an existing canonical identity; account deletion follows an approved retention policy; migration preserves balances, transactions and user data.
- **Change type:** SQL migration and API/source changes.

### 6. HIGH — Role/verification state is duplicated and inconsistently trusted

- **Files/objects:** `public.users.role`, `public.profiles.role`, signup metadata, mobile [AuthScreen.tsx](/workspaces/ers-website-worktree/apps/mobile/screens/AuthScreen.tsx:130), [authorize.js](/workspaces/ers-website-worktree/services/api/modules/protect/authorize.js:30), [handle_new_user()](/workspaces/ers-website-worktree/supabase/migrations/20260718111426_remote_schema.sql:26), and [20261122111500_customer_identity_web.sql](/workspaces/ers-website-worktree/apps/website/supabase/migrations/20261122111500_customer_identity_web.sql:26).
- **Issue:** Legacy mobile signup places role in user metadata and upserts a profile role. The old schema function derives a new profile role from metadata; although the base snapshot does not show a trigger attachment, the website migration later attaches a fixed-client trigger. Backend authorization reads profile role, while other code and data also store role/KYC flags in `public.users`.
- **Scenario:** If legacy metadata-driven provisioning or permissive profile policies remain active in a target deployment, a user can claim runner/admin status; even after prospective hardening, stale profile roles may remain authoritative to backend routes. Conversely, an account can be rejected by an app because its copies of role/verification state disagree.
- **Existing control / insufficiency:** Proposed migration ignores metadata for future profile trigger inserts and constrains profile update grants, but does not reconcile existing privileged roles, `public.users.role`, live policies, or every backend role consumer.
- **Recommended remediation:** Make verified Auth identity the customer baseline; represent runner/admin capabilities in independently granted records; migrate all consumers away from client metadata and profile/user role authority; audit and reconcile legacy values using trusted evidence.
- **Regression/acceptance:** Metadata and profile payloads cannot grant runner/admin; stale roles do not authorize; approved capabilities work across web/mobile; customer access survives runner suspension.
- **Change type:** SQL migration and source changes.

### 7. MEDIUM — Account lifecycle and KYC do not consistently attach to one identity

- **Files/objects:** [kyc.js](/workspaces/ers-website-worktree/services/api/routes/kyc.js:17), [kycService.js](/workspaces/ers-website-worktree/services/api/services/kycService.js:58), `public.kyc_profiles`, and [adminRunners.js](/workspaces/ers-website-worktree/services/api/routes/adminRunners.js:62).
- **Issue:** KYC uses a user ID supplied by authenticated middleware but its schema relation is not enforced; submission requires an existing runner role; rejected records cannot be resubmitted; suspension toggles runner availability only. Website customer authorization remains role-exclusive.
- **Scenario:** A new customer cannot follow an application lifecycle without already having runner role; an applicant with rejected KYC cannot reapply; KYC may be orphaned; suspension leaves the customer route blocked when the profile role remains runner.
- **Existing control / insufficiency:** Admin endpoints authenticate and authorize from profile role, and runner availability gates acceptance. Neither resolves the missing KYC FK, circular role prerequisite, rejection rule, or separate customer capability.
- **Recommended remediation:** Add a distinct runner-application lifecycle and verified ownership FK; allow reapplication; grant runner capability only through an audited admin approval; model suspension independently from customer access.
- **Regression/acceptance:** Verified customer submits application; only admin approves/rejects; rejected applicant can reapply; suspended account retains customer access and cannot perform runner actions.
- **Change type:** Both source and SQL migration.

### 8. MEDIUM — No coordinated account deletion/provisioning contract

- **Files/objects:** Auth test cleanup [auth.e2e.test.js](/workspaces/ers-website-worktree/services/api/tests/auth.e2e.test.js:476); existing relationships in [remote_schema.sql](/workspaces/ers-website-worktree/supabase/migrations/20260718111426_remote_schema.sql:468).
- **Issue:** No production account deletion endpoint or coordinated cleanup flow was found. Existing FKs cover only selected relationships and do not cascade Auth deletion across `public.users`, wallets, KYC and transactions.
- **Scenario:** A user deletion by an external/admin mechanism can leave orphaned identity, KYC or wallet data; indiscriminate cascade could instead destroy financial records that need retention.
- **Existing control / insufficiency:** Test teardown manually deletes several tables and Auth test users. That is not a production lifecycle policy.
- **Recommended remediation:** Define account closure, retention, anonymization and financial-record retention; implement an audited service workflow with explicit dependencies and legal retention constraints.
- **Regression/acceptance:** Closure does not leave unintended active credentials/capabilities; required ledger history is retained; reprocessing is idempotent and auditable.
- **Change type:** Both source and SQL migration, after policy approval.

## Confirmed facts vs unresolved assumptions

### Confirmed from checked-in source

- API `authenticate` verifies the Supabase Bearer token and maps `auth.users.id` to `profiles.id`.
- Current website signup uses Supabase Auth and provisions a `profiles` row, not `public.users`.
- Current mobile app entry uses a Supabase Auth provider that does not insert `public.users` or `profiles`.
- Legacy mobile auth code includes role metadata and a profile upsert.
- Production source direct access to `public.users` found is the PIN route’s read/update; no public.users insert/upsert was found outside test fixtures.
- Test suites create Auth users and separately insert application rows, often using the same UUID.
- The checked-in schema has the relationships listed above; it does not enforce most Auth-to-application links.
- Several routes accept caller-supplied identity headers without authentication.

### Not established by repository evidence

- Whether the snapshot matches the live schema or live migration history.
- Whether a trigger is attached to the original `handle_new_user()` function in a deployed project.
- Whether all test and legacy routes are deployed/reachable in production.
- Whether mobile, website and backend currently use the same Supabase project.
- Whether any operational process creates or synchronizes `public.users` outside checked-in source.
- Whether the `public.users.password` column contains or has ever contained credentials.
- Whether any legacy withdrawal/PIN service abstraction exists outside the checked-in files.
- Whether production API gateways add protections not represented in this repository. No such protection is assumed.

## Recommended next engineering steps

1. Treat the unauthenticated transfer, PIN, wallet and storage routes as urgent ownership/authentication blockers; derive all affected identities from verified Supabase sessions.
2. Establish the canonical account table and authoritative ownership mapping. Before any migration, compare live-equivalent schema/data and enumerate orphan/duplicate IDs without modifying them.
3. Define a data-preserving `auth.users` to application identity migration; add constraints only after reconciliation and review of financial retention/cascade behavior.
4. Consolidate customer eligibility and runner/admin capabilities. Stop authorizing from signup metadata or mutable profile/user role fields.
5. Reconcile KYC application, approval, rejection/reapply, suspension, audit and deletion workflows with the approved identity governance decisions.
6. Add regression tests for forged identity headers, account ownership, cross-account reads/writes, payout ownership, role escalation, lifecycle transitions, and old-row preservation.
7. Validate only in a disposable non-production project after independent review; do not infer live behavior from repository snapshots.

## Final integrity status

The website branch and HEAD remained as recorded above. No staged changes were created. Existing uncommitted changes, including pre-existing untracked Milestone 7.6.1 inventory artifacts, were preserved. No backend or preservation worktree was accessed or modified. The new report is the only file created by this investigation.
