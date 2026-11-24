# ERS Milestone 7.6.1 — Live Identity Reconciliation

**Status: READY WITH BLOCKERS**

This report establishes a repository-backed baseline and provides a manual,
read-only SQL inventory for an authorized operator. No live Supabase connection
was available in this session. Accordingly, no live database schema, data,
policies, grants, triggers, migration history, Auth settings, or counts are
claimed as verified.

The approved governance requirements used here are: every verified account has
customer capability; runner capability requires manual administrator approval;
rejected applicants can reapply; runner suspension does not remove customer
access; admin access requires MFA and attributable audit trails; one identity
can have independent customer and runner capabilities; and caller-controlled
metadata/headers cannot grant privileges.

## 1. Executive summary

The checked-in schema snapshots contain `profiles`, `runners`,
`kyc_profiles`, `audit_logs`, and marketplace/financial tables, but do not
establish that these are the live definitions. The snapshots describe a
mutually exclusive `profiles.role` model, permissive legacy profile policies,
broad grants, a user-metadata-driven profile trigger, and role-based API
authorization.

The website's proposed customer migration changes future profile provisioning
to `client`, but leaves existing roles untouched and does not provide a trusted
runner/admin capability source. The mobile app still submits a role in signup
metadata and upserts `profiles.role`. The API authenticates a bearer token in
some routes, then uses the database profile role; other routes use caller
supplied `x-user-id` and `x-role` headers. The current website waitlist-admin
login is password-only and has no MFA or named administrator principal.

Priority blockers:

1. Reconcile historical `runner`/`admin` values against trusted approval/admin
   evidence before considering them authorization. Do not blanket-convert or
   delete existing roles without an approved data-transition plan.
2. Replace mutually exclusive profile-role authorization with independent,
   server-controlled capabilities. Customer access must remain for verified
   accounts even when runner capability is suspended.
3. Inventory and then remediate live RLS policies and grants, especially
   profile, runner, KYC, audit, user, wallet and errand objects.
4. Define the manual runner application/approval/rejection/reapplication/
   suspension lifecycle and its atomic, attributable audit trail.
5. Require MFA for admin access and sensitive admin actions.
6. Remove caller-supplied identity/role headers as authorization inputs.

No corrective migration is proposed or created in this milestone.

## 2. Repository and worktree verification

Pre-investigation state:

- Worktree: `/workspaces/ers-website-worktree`
- Branch: `feat/website-monorepo-migration`
- HEAD: `9b31d7211089a172e15e6b8fce512f75f3a725b7`
- Staged changes: none
- Existing website status entries at preflight: 92 total (2 modified tracked
  files and 90 untracked paths). The existing state was preserved.

The two modified tracked files were `packages/auth/tsconfig.tsbuildinfo` and
`pnpm-lock.yaml`. Existing untracked work included the website migration,
website/auth source, tests, and other prior work. No unrelated changes were
discarded.

The backend and preservation worktrees were inspected read-only and not
modified. Their starting branches/HEADs were `feat/backend-security-hardening`
and `preservation/ers-pre-isolation-20261122`, both at
`9b31d7211089a172e15e6b8fce512f75f3a725b7`. Their existing dirty statuses
were preserved.

## 3. Live-schema access method and limitations

No authorized live read-only database connection or schema-inspection tool was
available. No credentials or environment values were inspected or extracted;
no external connection was attempted. The accompanying
[`ERS_MILESTONE_7_6_1_SUPABASE_READ_ONLY_INVENTORY.sql`](./ERS_MILESTONE_7_6_1_SUPABASE_READ_ONLY_INVENTORY.sql)
is for an authorized operator to run manually in the Supabase SQL Editor.

The SQL artifact contains only catalog inspection and aggregate `SELECT`
statements. It does not expose row-level personal data. It has not been run in
this session.

Repository evidence was read from:

- [`supabase/recovery/recovered_public_schema.sql`](./supabase/recovery/recovered_public_schema.sql)
- [`schema_before_security.sql`](./schema_before_security.sql)
- [`supabase/migrations/`](./supabase/migrations)
- [`apps/website/supabase/migrations/`](./apps/website/supabase/migrations)

These are checked-in files, not proof of deployed state.

## 4. Repository schema inventory

### 4.1 Snapshot objects and relationships

The recovered snapshot defines these relevant objects:

| Object | Snapshot columns/constraints | Snapshot relationship/evidence |
|---|---|---|
| `public.profiles` | `id`, `email`, `role`, date of birth, NIN, address/document/account fields, emergency contact, `verified`, `created_at`; PK `id`; unique email and lower(email) index; role check permits `client`, `runner`, `admin` | No `auth.users` FK in the recovered snapshot. The proposed customer migration adds one `NOT VALID`. |
| `public.runners` | `id`, name, email, earnings, created time, `is_available`, latitude/longitude; PK `id` | Snapshot FK `runners.id -> public.users.id ON DELETE CASCADE`, not directly `auth.users`. |
| `public.kyc_profiles` | `id`, `user_id`, name, phone, BVN, bank code/account fields, `status`, created time; PK `id` | Snapshot has no FK shown from `user_id`; it contains sensitive financial/identity data. |
| `public.audit_logs` | `id`, actor ID/role, action, entity/entity ID, JSON metadata, timestamp; PK `id` | Snapshot FK `actor_id -> auth.users.id`. |
| `public.errand_events` | errand ID, actor ID/role, event/status fields, JSON metadata, timestamp; PK `id` | Snapshot FK to `public.errands(id) ON DELETE CASCADE`. |
| `public.errands` | includes `client_id`, `assigned_runner_id`, `runner_id`, status, price/payout, location and timestamps; PK `id` | Snapshot indexes client, runner, status; no matching auth FKs shown in inspected constraints. |
| `public.users` | separate UUID, email/password/name/role, PIN, KYC flag, risk score; PK `id`; unique email | Snapshot shows jobs and runner relationships against this table. Its identity relationship to `auth.users` is not established by the snapshot. |
| `public.wallets` | `id`, `user_id`, balances; PK `id`, unique `user_id` | Snapshot has a self-read policy; a complete FK to auth identity is not shown. |

Other snapshot tables include `errand_logs`, `jobs`, `job_logs`,
`orchestrator_retry_log`, `otp_codes`, `payments`, `system_logs`, `tasks`,
`transactions`, and `user_devices`. The companion SQL inventories these and
any similarly named live identity/authorization tables.

### 4.2 Snapshot policy and grant inventory

`schema_before_security.sql` and the recovered snapshot show multiple profile
policies, including:

- Own-row insert/select/update policies.
- `allow_insert_for_authenticator` for `authenticated, anon` with
  `WITH CHECK (true)`.
- `allow_insert_from_trigger` and `allow_profile_insert` with
  `WITH CHECK (true)`.
- `profiles_insert_authenticated` with `WITH CHECK (true)`.

The snapshot also shows:

- `Audit logs: admin read`, based on `profiles.role = 'admin'`.
- `Audit logs: service insert` with `WITH CHECK (true)`.
- `runner_read_self` on `runners`.
- Errand visibility/update policies.
- RLS enabled in the snapshot on profiles, runners, audit logs, KYC, errands,
  tasks, transactions and user devices (not necessarily every related table).
- Broad `GRANT ALL` on numerous tables to `anon`, `authenticated`, and
  `service_role`, including profiles, runners, KYC, audit, users, wallets,
  errands and errand events.
- Broad default privileges for tables/functions/sequences in `public`.

These policy names and grants come from checked-in snapshot files. Whether
they exist live, whether later migrations changed them, and their effective
combined behavior are **NOT VERIFIED**. Permissive policies combine with OR
semantics; names alone are not evidence of effective restriction.

### 4.3 Triggers and functions in repository

- The recovered snapshot's `public.handle_new_user()` is `SECURITY DEFINER`,
  has `search_path = public`, and inserts a profile role from
  `raw_user_meta_data.role` with default `client`. The snapshot grants function
  execution broadly.
- The proposed website migration replaces that function with an empty
  search path and hard-coded `client`, revokes execution from public/anon/
  authenticated, and recreates `on_auth_user_created`. It still uses
  `ON CONFLICT (id) DO NOTHING`; it does not reconcile existing privileged
  role values.
- Website waitlist migrations define `increment_referrals(text)`: the first
  migration used `SECURITY DEFINER` and granted execution to `anon` and
  `authenticated`; the later migration switches to `SECURITY INVOKER` and
  restricts execution to `service_role`.
- No checked-in identity/runner approval transaction or admin-MFA database
  function was established by this inspection.

Live ownership, `proconfig`, privileges, triggers, bodies and execution rights
must be inventoried by the SQL artifact.

## 5. RLS and grant inventory

### Confirmed repository facts

- Profile RLS policies in the recovered snapshot include both self-row
  policies and permissive insert policies.
- Profile `GRANT ALL` to anonymous and authenticated roles appears in the
  snapshot.
- Similar broad grants appear on `runners`, `kyc_profiles`, `audit_logs`,
  `users`, `wallets`, `errands`, and other tables.
- The proposed customer migration drops the known profile-policy names from
  the snapshot and adds own-row policies, but does not drop its three
  `customer_profiles_*` policies before recreating them; it is not safe to
  rerun as written.
- The proposed migration revokes all table privileges from `anon`, but for
  `authenticated` explicitly revokes only insert/update/delete before granting
  selected privileges. Existing grants must be inspected to ensure no
  effective broad privilege remains.
- The proposed migration only changes profile policies and grants; it does not
  remediate audit, runner, KYC, wallets, users, or errands.

### Live unknowns

The live policy set, role grants, column grants, RLS force state, default
privileges, and grants inherited through roles are unknown. The manual SQL
inventory reports relation RLS flags, policies, table grants, column grants,
and function execute privileges. Database administrators must review effective
privileges, not merely the direct grants returned by one view.

## 6. Migration-history reconciliation

Checked-in migration files found:

- Root migrations: `20260718111426_remote_schema.sql`,
  `20260729111026_security_hardening.sql`,
  `20260730_sprint5_security_rls.sql`,
  `20260819_sprint5_errands_escrow_fields.sql`,
  `20260826_sprint6_atomic_errand_creation.sql`,
  `20260828_sprint6_atomic_escrow_release.sql`,
  `20260829_sprint6_transaction_ownership.sql`,
  `20260901_sprint6_atomic_errand_acceptance.sql`,
  `20260902_fix_accept_errand_atomic.sql`,
  `20260903_sprint6_errand_status_lifecycle.sql`,
  `20260909_sprint6_paystack_wallet_funding.sql`,
  `20260910_fix_release_escrow_atomic.sql`, and
  `202609200001_add_errand_confirmed_at.sql`.
- Website migrations: `20261006_waitlist_referral_schema.sql`,
  `20261013_secure_increment_referrals.sql`, and
  `20261122111500_customer_identity_web.sql`.

The website migration is present as an untracked worktree file. Repository
presence does not establish that it has been applied. No live
`supabase_migrations.schema_migrations` table or applied-version list was
queried. Potential duplicate/conflicting live definitions and partial
application state are therefore **NOT VERIFIED**.

## 7. Identity data reconciliation

No live aggregate count was obtained. In particular, counts by profile role,
verified Auth identities, runners, KYC status, orphan profiles, inconsistent
runner/KYC links, and administrator records are **NOT VERIFIED**. The supplied
SQL computes aggregate-only counts without returning PII.

Repository facts:

- The snapshot role constraint allows `client`, `runner`, and `admin`.
- The package auth type also declares `super_admin`, which the snapshot role
  check does not allow: [`packages/auth/src/types.ts`](./packages/auth/src/types.ts).
- The snapshot has a separate `public.users` table and a separate
  `auth.users` identity; their mappings are not established by the snapshot.
- `runners` references `public.users`; `audit_logs.actor_id` references
  `auth.users`; KYC `user_id` has no FK shown.
- Existing roles and records must not be silently classified as legitimate
  approval. Historical role data requires an independent evidence-based
  reconciliation, and no data was changed.

## 8. Authorization dependency map

| Area | Source and current decision | Trust / compatibility | Required future direction |
|---|---|---|---|
| Authentication | [`authenticate.js`](./services/api/modules/protect/authenticate.js) verifies Supabase bearer token, then loads application profile | Token identity is verified; role is copied from profile | Preserve verified identity, replace role-based capability source |
| API role checks | [`authService.js`](./services/api/modules/protect/authService.js), [`authorize.js`](./services/api/modules/protect/authorize.js) use `profiles.role` | DB value is not proof of manually approved capability | Consult trusted grants/state |
| Customer authorization | [`customer-profile.ts`](./apps/website/lib/customer-profile.ts), [`proxy.ts`](./apps/website/proxy.ts), [`profile/route.ts`](./apps/website/app/api/customer/profile/route.ts) require `role === client` | Incompatible with approved independent customer and runner capabilities | Verified account gets customer access; retain ownership checks |
| Signup/profile provisioning | [`AuthScreen.tsx`](./apps/mobile/screens/AuthScreen.tsx) submits role metadata and upserts profile role; website trigger hard-codes client | Metadata/header is caller-controlled; trigger protects only new provisioning | Remove mobile role payload/upsert; server/database provisions ordinary profile |
| Runner application/KYC | [`kyc.js`](./services/api/routes/kyc.js), [`kycService.js`](./services/api/services/kycService.js) require runner role for submission/review; rejection blocks resubmission | Lifecycle conflicts with approval-before-runner and reapplication decisions | Customer submits application; only MFA-authorized reviewer approves; allow reapplication |
| Errand acceptance | [`20260902_fix_accept_errand_atomic.sql`](./supabase/migrations/20260902_fix_accept_errand_atomic.sql), [`20260901_sprint6_atomic_errand_acceptance.sql`](./supabase/migrations/20260901_sprint6_atomic_errand_acceptance.sql) check profile role, verified flag, runner record/availability | Role is not independent approval evidence | Check active runner capability, approval and suspension state |
| Errand listing | [`errands.js`](./services/api/routes/errands.js) filters by `req.user.role` | Mutually exclusive role model | Authorize runner view by capability; customer views remain user-owned |
| Runner availability/suspension | [`runnerManagementService.js`](./services/api/services/runnerManagementService.js) toggles `runners.is_available` | Availability is not the same as authorization suspension | Separate capability suspension from availability; customer access persists |
| Wallet/financial routes | [`app.js`](./services/api/app.js), [`pin.js`](./services/api/routes/pin.js), [`storage.js`](./services/api/routes/storage.js), [`otp.js`](./services/api/server/routes/otp.js) include handlers reading `x-user-id` | Caller-supplied identity is not trusted without route-level token binding | Derive owner from verified bearer identity; authorize every route and financial operation |
| Mobile wallet/KYC/API | [`api.ts`](./apps/mobile/src/services/api.ts), [`WalletScreen.tsx`](./apps/mobile/screens/WalletScreen.tsx), [`KycScreen.tsx`](./apps/mobile/screens/KycScreen.tsx), [`CreatePinScreen.tsx`](./apps/mobile/screens/CreatePinScreen.tsx), [`otpscreen.tsx`](./apps/mobile/screens/otpscreen.tsx) send role/user headers or use metadata for UI | Client values may be tampered with and are not an authorization source | Headers may be informational only; backend derives identity/capability from token and server records |
| Administrator | [`admin-auth/route.ts`](./apps/website/app/api/admin-auth/route.ts), [`admin-session.ts`](./apps/website/lib/admin-session.ts), [`admin-authorization.ts`](./apps/website/lib/admin-authorization.ts) use shared password and signed cookie | Signed cookie protects integrity but not MFA or individual admin identity | Named administrator identity, MFA, short-lived session and server-side authorization |
| Audit access | Snapshot's `Audit logs: admin read` checks profile role; service-insert policy is unrestricted in snapshot | Role can be stale/self-assigned; insert policy/grants need effective review | Restrict writes to trusted code and record attributable security events |

This is a repository scan of the named authorization patterns and their
consumers. The manual Supabase inventory is required to discover additional
live tables, policies, functions and authorization objects.

## 9. Identity reconciliation matrix

| Area | Live database state | Repository expectation | Approved target | Gap | Risk |
|---|---|---|---|---|---|
| Verified customer access | NOT VERIFIED | Website expects `role=client` | Every verified account has customer capability | Role gate is exclusive | Verified runner could lose customer access |
| Runner application | NOT VERIFIED | Existing KYC profile/service | Separate application lifecycle | KYC is tied to pre-existing runner role | Applicants may not submit before privilege |
| Manual approval | NOT VERIFIED | KYC approval code checks profile role | Authorized administrator only | Role and KYC status are coupled | Unapproved role may gain runner access |
| Rejection/reapply | NOT VERIFIED | Rejected KYC explicitly cannot resubmit | Correct and reapply | Existing behavior contradicts policy | Applicant permanently blocked |
| Runner suspension | NOT VERIFIED | `runners.is_available` toggle | Runner capability suspended only | Availability is not authorization state | Suspended user may retain runner capability or lose customer access |
| Reinstatement | NOT VERIFIED | No complete capability lifecycle established | Authorized reinstatement, audited | No independently established grant model | State drift/unaudited reactivation |
| Administrator membership | NOT VERIFIED | Profile role in API; shared password for website waitlist admin | Independently provisioned admin identity | No verified live membership inventory | Stale or shared credentials may authorize admin actions |
| MFA | NOT VERIFIED | Website shared-password endpoint has no MFA step | Mandatory for administrator access | Source flow lacks MFA | Password compromise enables admin session |
| Audit integrity | NOT VERIFIED | `audit_logs` exists in snapshot | Attributable, protected audit trail | Snapshot allows broad grants/policy | Forged or incomplete audit evidence |
| Profile RLS/grants | NOT VERIFIED | Snapshot has permissive profile policies and broad grants; migration replaces known names | Own profile and ordinary fields only | Live policies/grants unknown; migration rerun unsafe | Privileged field write or access |
| Mobile/API identity | NOT VERIFIED | Client sends metadata/headers; API has mixed token and header patterns | Server-verified token identity and capabilities | Multiple callers trust caller input | Cross-user access / role spoofing |

## 10. Security findings ranked by severity

No exploit was attempted. Findings below are static repository risks and
must not be interpreted as confirmation of live exposure.

| # | Severity | File | Lines | Finding | Confidence |
|---|---|---|---|---|---|
| 1 | 🔴 CRITICAL | [`services/api/app.js`](./services/api/app.js), [`pin.js`](./services/api/routes/pin.js), [`storage.js`](./services/api/routes/storage.js), [`otp.js`](./services/api/server/routes/otp.js) | `app.js:76-82`; `pin.js:8-17,43-52`; `storage.js:64-69`; `otp.js:2` | Some handlers use caller-supplied `x-user-id` to select or modify user resources; static excerpts do not show route authentication there. Must verify mounts/middleware and reject unless identity is bound to verified token. | 8/10 |
| 2 | 🟠 HIGH | [`20261122111500_customer_identity_web.sql`](./apps/website/supabase/migrations/20261122111500_customer_identity_web.sql), [`authService.js`](./services/api/modules/protect/authService.js), [`authorize.js`](./services/api/modules/protect/authorize.js) | Migration `33-40`; auth service `29-41`; authorize `48-60` | Legacy `runner`/`admin` roles can survive the new trigger and continue to be trusted by API authorization. Legacy snapshots show client insert policies and broad grants. | 9/10 |
| 3 | 🟠 HIGH | [`recovered_public_schema.sql`](./supabase/recovery/recovered_public_schema.sql), [`schema_before_security.sql`](./schema_before_security.sql) | `26-39`, `212-225`, `559-583`, `680-682` | Snapshot's signup trigger reads role metadata; permissive profile insert policies and grants permit self-asserted roles in that schema. Live status unknown. | 9/10 |
| 4 | 🟡 MEDIUM | [`admin-auth/route.ts`](./apps/website/app/api/admin-auth/route.ts) | `33-63` | Shared-password admin login lacks MFA and per-person identity, conflicting with approved governance. | 9/10 |
| 5 | 🟡 MEDIUM | [`recovered_public_schema.sql`](./supabase/recovery/recovered_public_schema.sql) | `49-60`, policy `504-510`, grants `615-617` | Audit insert policy and broad grants may permit forged audit rows; live effective rights unknown. | 9/10 |
| 6 | 🟡 MEDIUM | [`kyc.js`](./services/api/routes/kyc.js), [`kycService.js`](./services/api/services/kycService.js) | `kyc.js:17-25`; `kycService.js:58-62,145-161` | KYC submission requires runner role; rejection blocks reapplication; approval requires an existing runner role. | 9/10 |
| 7 | 🟡 MEDIUM | [`customer-profile.ts`](./apps/website/lib/customer-profile.ts), [`proxy.ts`](./apps/website/proxy.ts) | `customer-profile.ts:10-12,73-84`; `proxy.ts:69-86` | Exclusive `client` role check conflicts with independent customer and runner capabilities. | 9/10 |
| 8 | 🟡 MEDIUM | [`AuthScreen.tsx`](./apps/mobile/screens/AuthScreen.tsx), [`api.ts`](./apps/mobile/src/services/api.ts) | `AuthScreen.tsx:130-135,157-164`; `api.ts:250-273` | Mobile signup role metadata/profile upsert and API headers use caller-controlled role/identity data. | 9/10 |
| 9 | 🟡 MEDIUM | [`20261122111500_customer_identity_web.sql`](./apps/website/supabase/migrations/20261122111500_customer_identity_web.sql) | `66-86` | Three policy creations are not preceded by drops of their own names, so rerunning may fail. | 10/10 |

The CRITICAL classification for caller-supplied identity headers is a
repository-risk priority, not a confirmed exploitable live vulnerability:
actual route mounts, middleware, deployment configuration and effective
database role were not probed. Validate before assigning a live incident
severity.

## 11. Data integrity risks

- Existing `profiles.role` values may represent self-assertion, legacy
  provisioning or approved decisions; the repository cannot distinguish them.
- `profiles.id` has no auth FK in the recovered snapshot. The proposed migration
  adds a `NOT VALID` FK, which does not establish that historical rows match
  `auth.users`.
- `runners.id` references `public.users.id` in the snapshot, while app auth
  middleware uses `auth.users.id` to look up profiles. The mapping among these
  identities is unknown.
- KYC `user_id` lacks a snapshot FK and the schema permits sensitive KYC data
  in the same table. Do not expose row-level data in the audit.
- `profiles.email` and `users.email` have uniqueness constraints in the
  snapshot, but email synchronization/canonical identity handling is unknown.
- `profiles.verified`, `users.kyc_verified`, KYC status and
  `runners.is_available` have different meanings and are consumed in different
  code paths. They must not be treated as interchangeable approval state.
- Snapshot role values do not include `super_admin` although shared auth types
  do.

## 12. Unknowns and blockers

Before any corrective migration can be approved:

1. Run the accompanying SQL in a non-production/authorized SQL Editor and
   preserve aggregate outputs and catalog definitions for review.
2. Compare live policies/grants with all checked-in policies; enumerate
   additional permissive policies and role memberships.
3. Confirm applied migration history, duplicate versions, failures and partial
   states.
4. Determine whether `public.users` is still authoritative, and map existing
   records to `auth.users` without exporting PII.
5. Quantify profiles by role, unverified profiles, auth orphans, runner/KYC
   mismatches and admin records.
6. Establish trusted evidence for existing runner approvals and admin
   membership; do not infer approval from a role column.
7. Verify route-level authentication and ownership enforcement for all
   `x-user-id` and `x-role` consumers.
8. Define the target runner-application tables/states only after confirming
   whether live equivalents already exist.
9. Define admin MFA enforcement and event attribution for each privileged
   operation.
10. Resolve mobile/backend compatibility before the website migration is
    applied anywhere.

## 13. Recommended Milestone 7.6.2 scope

After review of actual non-production inventory results:

1. Produce an approved data-reconciliation map, retaining original data and
   documenting evidence for each existing privileged identity.
2. Define additive capability/application schema and transition constraints
   that do not make customer access mutually exclusive with runner access.
3. Design narrow RLS/grants for profiles, applications, KYC, runner records,
   admin membership and audit events.
4. Define transaction-safe approval, rejection/reapply, suspension and
   reinstatement operations with attributable audit events and MFA checks.
5. Stage application changes to derive identity from verified sessions and
   capability from server-controlled state.
6. Validate first apply, rerun expectations, existing-data preservation and
   negative authorization cases in a disposable Supabase project.
7. Seek independent migration/security review before any production planning.

No corrective migration or application fix is included in Milestone 7.6.1.

## 14. Read-only validation evidence and final integrity

- Static repository inspection only; no live query was executed.
- The companion SQL file contains only `SELECT` statements and comments; it is
  intended for manual execution, not automation.
- No migration was executed and no database writes occurred.
- No environment values, credentials, personal rows or tokens were accessed.
- No source change, migration file, deployment or external service operation
  occurred.
- The only files created by this milestone are:
  - `ERS_MILESTONE_7_6_1_LIVE_IDENTITY_RECONCILIATION.md`
  - `ERS_MILESTONE_7_6_1_SUPABASE_READ_ONLY_INVENTORY.sql`
- Backend and preservation worktrees remain untouched.

## 15. Final verdict

**READY WITH BLOCKERS** — the repository-side baseline and manual read-only
inventory are prepared. The milestone cannot claim live-schema reconciliation
or be considered ready for migration design approval until an authorized
operator runs and reviews the inventory results in a non-production Supabase
project.
