# ERS — Schema Recovery Review (Sprint 4 Prep)

**Status:** Review only — no code, SQL, or production changes made.
**Source of recovered schema:** [`supabase/recovery/recovered_public_schema.sql`](../../supabase/recovery/recovered_public_schema.sql)
**Recovery command (read-only):** `supabase db dump --linked -s public -f supabase/recovery/recovered_public_schema.sql`
**Date:** 2026-07-19
**Scope:** `public` schema only (Supabase-managed schemas `auth`, `storage`, `realtime`, `vault`, `extensions` intentionally excluded).

---

## 1. Confirmed recovery facts

These are objective facts about what the dump **literally contains**. No interpretation.

### 1.1 Tables recovered (18)
`audit_logs`, `errand_events`, `errand_logs`, `errands`, `job_logs`, `jobs`, `kyc_profiles`,
`orchestrator_retry_log`, `otp_codes`, `payments`, `profiles`, `runners`, `system_logs`,
`tasks`, `transactions`, `user_devices`, `users`, `wallets`.

### 1.2 Functions recovered (1)
- `public.handle_new_user()` — `LANGUAGE plpgsql`, `SECURITY DEFINER`, `search_path = public`. Inserts into `public.profiles (id, role)` using `new.raw_user_meta_data ->> 'role'` defaulting to `'client'`.

### 1.3 Constraints & keys
- Primary keys on all 18 tables.
- Unique: `profiles.email`, `users.email`, `wallets.user_id`, plus unique index `profiles_email_unique` on `lower(email)`.
- CHECK constraints: `payments.status` ∈ {pending, completed, failed}; `profiles.role` ∈ {client, runner, admin}; `tasks.status` ∈ {open, accepted, completed}.
- Foreign keys (7): `audit_logs.actor_id → auth.users`, `errand_events.errand_id → errands (CASCADE)`, `jobs.client_id → users`, `jobs.runner_id → users`, `runners.id → users (CASCADE)`, `transactions.errand_id → errands`.

### 1.4 Indexes (7)
`errand_events_created_at_idx`, `errand_events_errand_id_idx`, `errand_events_event_type_idx`, `errands_client_idx`, `errands_runner_idx`, `errands_status_idx`, `profiles_email_unique`.

### 1.5 RLS — enable state (as literally present in dump)
- **RLS ENABLED (8):** `audit_logs`, `kyc_profiles`, `otp_codes`, `profiles`, `runners`, `tasks`, `transactions`, `user_devices`.
- **RLS NOT ENABLED (10):** `errands`, `errand_events`, `errand_logs`, `job_logs`, `jobs`, `orchestrator_retry_log`, `payments`, `system_logs`, `users`, `wallets`.

### 1.6 RLS — policies present
- `profiles`: ~10 policies (many overlapping INSERT/SELECT/UPDATE).
- `errands`: 4 policies (`Clients can insert errands`, `Open errands visibility`, `Runners can update errands`, `read_available_errands`).
- `wallets`: 2 policies (`Users can read own wallet`, `Users can update own wallet`).
- `audit_logs`: 2 policies (admin read, service insert).
- `runners`: 1 policy (`runner_read_self`).
- **No policies defined for:** `kyc_profiles`, `otp_codes`, `tasks`, `transactions`, `user_devices` (RLS enabled → default deny for non-service roles).

### 1.7 Grants
- `GRANT ALL` on **every** table to `anon`, `authenticated`, `service_role` (Supabase default posture).
- `GRANT ALL` on `handle_new_user()` to `anon`, `authenticated`, `service_role`.
- Default privileges for role `postgres` grant ALL on future sequences/functions/tables to `anon`, `authenticated`, `service_role`.

### 1.8 Recovery-completeness gaps (expected, given public-only scope)
- The **trigger binding** that fires `handle_new_user()` lives on `auth.users` (auth schema) — **not captured**. The function body is captured; the trigger is not.
- `uuid_generate_v4()` resolves to the `extensions` schema (used as a column default on `kyc_profiles`, `otp_codes`, `payments`, `profiles`, `user_devices`) — referenced, not defined here.
- No sequences, no storage buckets (bucket list confirmed empty).

---

## 2. Security findings that require verification

Each finding lists what the **dump proves** vs. what must be **verified against runtime/live** before we treat it as confirmed-exploitable. Severity is the *potential* impact.

### SEC-1 — Tables granted to `anon` with RLS disabled — **CRITICAL**
- **Dump proves:** RLS not enabled on `users`, `wallets`, `payments`, `errands`, `jobs`, `errand_events`, `errand_logs`, `job_logs`, `system_logs`, `orchestrator_retry_log`; all are `GRANT ALL` to `anon`.
- **Risk:** Anyone holding the public anon key could read/write these tables directly via PostgREST — including `users` (see SEC-2), `wallets` (balances), and `payments`.
- **Verify:** (a) Confirm RLS state live: `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace;` (b) Confirm whether PostgREST/anon access is actually reachable for these tables (test with anon key against `/rest/v1/users`). (c) Confirm backend uses service_role (not anon) for its own queries.

### SEC-2 — Plaintext credentials in `public.users` — **CRITICAL**
- **Dump proves:** `users.password text`, `users.withdrawal_pin text`; table has no RLS + `GRANT ALL` to anon.
- **Risk:** Plaintext password/PIN storage; combined with SEC-1, potentially anon-readable.
- **Verify:** (a) Are these columns actually populated, and are values hashed or plaintext? `SELECT id, (password ~ '^\$2[aby]\$') AS looks_bcrypt FROM users LIMIT 5;` (b) Is `public.users` still in use, or superseded by `auth.users`? (see ARCH-1) (c) Does any live code read/write `password`/`withdrawal_pin`?

### SEC-3 — Privilege escalation via `handle_new_user()` role from signup metadata — **HIGH**
- **Dump proves:** `role` is set from `new.raw_user_meta_data ->> 'role'` (client-controlled) with fallback `'client'`.
- **Risk:** A user could sign up with `role: "admin"` in metadata and self-provision admin.
- **Verify:** (a) Is the trigger actually bound on `auth.users`? `SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgfoid = 'public.handle_new_user'::regproc;` (b) Does the signup path allow arbitrary `raw_user_meta_data.role`? (c) Do any authz checks trust `profiles.role`?

### SEC-4 — Permissive `profiles` INSERT policies (`WITH CHECK (true)`) — **HIGH**
- **Dump proves:** Policies `allow_insert_for_authenticator` (anon+authenticated), `allow_insert_from_trigger`, `allow_profile_insert`, `profiles_insert_authenticated` all use `WITH CHECK (true)`.
- **Risk:** Any caller can insert a `profiles` row with `role='admin'` (CHECK only limits the enum, not the value) → escalation independent of SEC-3.
- **Verify:** (a) Reproduce an anon insert of an admin profile against live (in a non-prod context, or reason from policy only). (b) Confirm which of these overlapping policies are actually needed.

### SEC-5 — Sensitive KYC PII stored plaintext — **HIGH**
- **Dump proves:** `kyc_profiles.bvn text`, `kyc_profiles.account_number text`, `profiles.nin text` — no encryption at column level.
- **Risk:** BVN/NIN are highly sensitive Nigerian identifiers; plaintext storage is a compliance and trust risk.
- **Verify:** (a) Confirm `kyc_profiles` is only reachable by service_role (RLS enabled, zero policies) live. (b) Confirm no anon/authenticated path returns `bvn`/`nin`. (c) Decide encryption/tokenization strategy (Wanky Secure KYC).

### SEC-6 — Inert (misleading) RLS policies — **MEDIUM**
- **Dump proves:** `errands` and `wallets` have policies but RLS is not enabled, so policies are not enforced.
- **Risk:** False sense of protection during review/audit.
- **Verify:** Confirm live `relrowsecurity=false` for both (same query as SEC-1).

> **Note:** SEC-1, SEC-2, SEC-5, SEC-6 depend heavily on whether the backend uses the **service_role** key (which bypasses RLS and grants) vs. exposing the **anon** key to clients. Verifying the key model is the single highest-leverage check.

---

## 3. Architecture improvements

Non-blocking design debt to resolve *before* building more on this foundation. No changes proposed yet — for discussion.

### ARCH-1 — Dual identity model: `auth.users` vs `public.users`
Two user stores coexist. `handle_new_user` + `profiles`/`runners`/`audit_logs` key off `auth.users`; `jobs` FKs point at `public.users`; `public.users` also holds `password`/`withdrawal_pin`. **Recommendation:** standardize on Supabase `auth.users` as the identity root; treat `public.users` as legacy to migrate/retire. Decide before Sprint 4 KYC writes.

### ARCH-2 — KYC data fragmented across 3 tables
`kyc_profiles` (bvn, bank details), `profiles` (nin, proof_of_residence_url, date_of_birth, verified), `users.kyc_verified`. **Recommendation:** choose ONE canonical KYC store (proposal: `kyc_profiles` keyed to `auth.users`, with a single `status`/`verified` source of truth) and derive the rest. This is the key Sprint-4 modeling decision.

### ARCH-3 — Three overlapping task concepts: `errands`, `jobs`, `tasks`
Three tables model similar "work item" concepts with divergent columns and status vocabularies (`errands.status` default `pending` but policy checks `created`; `tasks.status` ∈ open/accepted/completed; `jobs.status` free text). **Recommendation:** confirm `errands` is canonical (matches API routes) and mark `jobs`/`tasks` as legacy.

### ARCH-4 — Duplicate event logging: `errand_events` vs `errand_logs`
Both log errand state transitions; `errand_events` is richer and indexed, `errand_logs` is not. **Recommendation:** consolidate on `errand_events`.

### ARCH-5 — Redundant `profiles` policies
~10 policies with heavy overlap (multiple identical "insert own profile", multiple `WITH CHECK (true)`). **Recommendation:** collapse to a minimal, auditable set (one per operation) once SEC-4 is resolved.

### ARCH-6 — Status vocabulary inconsistency
`errands.status` default `'pending'` conflicts with RLS policy `read_available_errands` checking `'created'`. **Recommendation:** define a single canonical status enum for errands.

---

## 4. Migration plan (proposed — not yet executed)

Goal: make Git the source of truth **without** modifying production. Each step is labeled by impact. Nothing below runs until reviewed and approved individually.

| # | Step | Impact |
|---|------|--------|
| 0 | **Done:** generate `recovered_public_schema.sql` | read-only (prod), local file |
| 1 | Verify SEC-1..SEC-6 with live read-only queries (`pg_class`, `pg_trigger`, sample selects) | **read-only** (prod) |
| 2 | Capture the `auth.users` trigger binding for `handle_new_user` into a documented, version-controlled file (recovery gap #1) | **read-only** (prod), local file |
| 3 | Decide ARCH-1 (identity) and ARCH-2 (canonical KYC store) — **decisions, no code** | none |
| 4 | Promote recovered SQL into a baseline migration `supabase/migrations/<ts>_recovered_baseline.sql`; remove/replace the empty phantom `20260718111426_remote_schema.sql` | **local only** |
| 5 | Reconcile migration history so local baseline == remote. Options: (a) `migration list` to inspect, then (b) `migration repair --status applied <ts>` — **writes remote metadata**; deferred, explicit approval required | read (prod) → later **remote metadata write** |
| 6 | Author **forward** migrations (separate files) for security fixes: enable RLS (SEC-1/6), lock down `profiles` policies (SEC-4), fix `handle_new_user` role handling (SEC-3), plan credential/PII handling (SEC-2/5) | local only until `db push` |
| 7 | Apply forward migrations to a **staging/branch** DB first, verify, then to prod via `db push` | **remote write** — explicit approval, staged |

### Guardrails (unchanged)
- No `db push`, `db reset`, or `migration repair` without explicit per-step approval.
- Baseline promotion (step 4) is local-only and reversible via Git.
- Security fixes ship as **forward** migrations, never by editing the recovered baseline (baseline must reflect reality as recovered).

---

## Open decisions for the CTO/architecture owner
1. **Key model:** does the backend use `service_role` server-side and keep `anon` client-only? (drives SEC severity)
2. **Identity root:** `auth.users` canonical, retire `public.users`? (ARCH-1)
3. **Canonical KYC store** for Sprint 4? (ARCH-2)
4. Approve running the **read-only verification queries** (step 1) next.
