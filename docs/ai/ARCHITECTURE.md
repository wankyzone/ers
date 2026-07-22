---
Title: ERS System Architecture
Purpose: Describe the system as it actually exists in the repo — stack, monorepo layout, data model, Wanky Secure vision.
Owner: Architecture (CTO)
Status: Stable
Version: 1.0
Last Updated: 2026-07-19
Read After: AGENT.md
Related: SECURITY.md, DECISIONS.md, RECOVERY.md
---

# ARCHITECTURE.md — ERS System Architecture

This document describes the system as it **actually exists in the repository** today. Where the design is undecided, it is marked **OPEN** and points to [DECISIONS.md](./DECISIONS.md).

---

## 1. High-level overview

ERS (Errand Runners System) connects **clients** who post errands with **runners** who complete them, with escrowed payments and KYC-verified participants. The platform is built on **Supabase** and a thin Node/Express API, with an Expo React Native mobile app.

```
                +---------------------------+
                |     Mobile app (Expo RN)  |
                |   apps/mobile             |
                +------------+--------------+
                             |
              REST / Socket.IO | Supabase client
                             v
   +---------------------+   +-----------------------------+
   |  API service        |   |  Supabase (managed)         |
   |  services/api       |-->|  Auth · Postgres · RLS      |
   |  Express, Socket.IO |   |  Storage · Realtime · Edge  |
   +---------------------+   +-----------------------------+
             |
             +--> Paystack (payments), escrow jobs, fraud guard
```

## 2. Monorepo layout

pnpm workspace + Turborepo. Node `>=20`, `pnpm@10.34.1`.

| Path | Purpose |
|------|---------|
| `apps/mobile` | Expo React Native app (iOS/Android/web). Auth, KYC, wallet, errands, tracking. |
| `services/api` | Node/Express (ESM, JavaScript) API. Routes, jobs, sockets, fraud guard. |
| `packages/auth` | Auth client/guards/hooks/session/roles/validators (TypeScript). |
| `packages/config` | Shared configuration. |
| `packages/db` | Database client/helpers. |
| `packages/types` | Shared TypeScript types (contracts across layers). |
| `packages/ui` | Shared UI primitives. |
| `packages/utils` | Shared utilities. |
| `supabase/` | Supabase project config, migrations, and recovery artifacts. |
| `docs/` | Permanent documentation (EOS). |
| `.javex/` | Live runtime state (EOS). |

## 3. Technology stack

- **Backend platform:** Supabase (project ref `acspvovspjhqeboqbgjh`, region `aws eu-west-2`).
- **API:** Express + Socket.IO (`services/api`). Env is loaded first via `services/api/env.js` before any module reads `process.env`.
- **Mobile:** Expo / React Native, navigation stacks, Zustand stores, Socket.IO client.
- **Payments:** Paystack (`services/api/routes/paystack.js`), escrow settlement job (`services/api/jobs/escrow.js`).
- **Validation/crypto:** `zod`, `jose`.
- **Tooling:** Turborepo, Biome, Prettier, TypeScript 5.9.

## 4. Supabase usage (standardization policy)

Per [DECISIONS.md ADR-001](./DECISIONS.md), we standardize on Supabase and avoid reinventing what it provides:

- **Authentication** — Supabase Auth (`auth.users`).
- **Authorization** — Postgres **RLS** policies.
- **Database** — Postgres (`public` schema owned by us).
- **Storage** — Supabase Storage (KYC documents — bucket not yet created; see [CURRENT_SPRINT.md](./CURRENT_SPRINT.md)).
- **Realtime** — used for tracking/updates.
- **Edge Functions** — where appropriate.

## 5. Data model (public schema)

18 tables recovered from production (full DDL: [supabase/recovery/recovered_public_schema.sql](../../supabase/recovery/recovered_public_schema.sql); analysis: [docs/recovery/sprint4-schema-recovery-review.md](../recovery/sprint4-schema-recovery-review.md)).

**Identity & profiles:** `users` (legacy custom table — holds plaintext `password`/`withdrawal_pin`, **OPEN**), `profiles` (keyed to `auth.users`, holds role + KYC fields), `runners`, `user_devices`.

**Work items:** `errands` (canonical), `jobs` (legacy), `tasks` (legacy) — three overlapping concepts, **OPEN** (see [DECISIONS.md ADR-007](./DECISIONS.md)).

**Errand history:** `errand_events` (rich, indexed — preferred), `errand_logs` (legacy).

**Money:** `wallets`, `payments`, `transactions`.

**KYC:** `kyc_profiles` (BVN, bank details), plus KYC fields on `profiles` (`nin`, `proof_of_residence_url`, `date_of_birth`, `verified`) and `users.kyc_verified` — **fragmented, OPEN** (canonical KYC store decision pending).

**Platform/ops:** `audit_logs`, `system_logs`, `job_logs`, `orchestrator_retry_log`, `otp_codes`.

**Function:** `handle_new_user()` (SECURITY DEFINER) — provisions a `profiles` row on signup. ⚠️ Currently derives role from client-supplied signup metadata (see [SECURITY.md SEC-3](./SECURITY.md)).

## 6. Known architectural debt (OPEN decisions)

Tracked in [DECISIONS.md](./DECISIONS.md); summarized in the recovery review §3:

- **ARCH-1 — Dual identity model** (`auth.users` vs `public.users`). Standardize on `auth.users`.
- **ARCH-2 — Fragmented KYC store** (3 tables). Choose one canonical store.
- **ARCH-3 — Three work-item tables** (`errands`/`jobs`/`tasks`). Confirm `errands` canonical.
- **ARCH-4 — Duplicate event logging** (`errand_events` vs `errand_logs`).
- **ARCH-5 — Redundant `profiles` RLS policies.**
- **ARCH-6 — Status vocabulary drift** (`pending` vs `created`).

## 7. "Wanky Secure" (long-term platform vision)

ERS is the first product on an internal security platform, **Wanky Secure**. The current schema already anticipates it — do not build heavy abstractions yet, but design so these evolve naturally:

| Capability | Current seed in codebase |
|------------|--------------------------|
| Secure Authentication by Wanky | Supabase Auth + `packages/auth` |
| Device Trust | `user_devices.is_trusted` |
| Audit Logs | `audit_logs` table |
| KYC | `kyc_profiles`, `profiles` KYC fields |
| Session Management | `packages/auth/session.ts` |
| Risk Scoring | `users.risk_score`, `transactions.risk_flag` |
| Fraud Detection | `services/api/services/fraudGuard.js` |

## 8. Environments & source of truth

- **Git is the single source of truth** ([DECISIONS.md ADR-002](./DECISIONS.md)) following loss of the primary Google account.
- Production schema is being reconstructed into version-controlled migrations — see [RECOVERY.md](./RECOVERY.md).
- Secrets: gitignored `.env` at repo root (never committed).
