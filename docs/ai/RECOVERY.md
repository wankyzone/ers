---
Title: Infrastructure Recovery Runbook
Purpose: Reproducible runbook for recovering IaC so Git is the source of truth; records recovery state and gaps.
Owner: Engineering Lead
Status: Active
Version: 1.0
Last Updated: 2026-07-19
Read After: AGENT.md (required for infrastructure work)
Related: DECISIONS.md, SECURITY.md
---

# RECOVERY.md — Infrastructure Recovery Runbook

How ERS recovers Infrastructure-as-Code so that **Git is the source of truth** ([ADR-002](./DECISIONS.md)). This runbook is reproducible: any engineer/AI can follow it after cloning.

---

## 1. Why recovery exists

The primary Google account was lost, taking some engineering history. Production Supabase still exists, but the repo drifted:
- The only migration (`supabase/migrations/20260718111426_remote_schema.sql`) is **empty**.
- No storage buckets are defined (bucket list is empty).
- The live schema was not represented in version control.

## 2. Recovery policy (hard rules)

- **No production writes** during recovery.
- **No metadata changes** to the remote (this is why `db pull` was rejected — see [ADR-003](./DECISIONS.md)).
- **No destructive SQL.**
- Confirm a **current backup** exists before any operation.
- Read-only commands are explicitly distinguished from writing ones.

## 3. Command classification

| Command | Reads remote | Writes remote | Writes local |
|---------|:---:|:---:|:---:|
| `supabase migration list --linked` | ✅ | ❌ | ❌ |
| `supabase db dump --linked -s public -f <file>` | ✅ | ❌ | ✅ (SQL file) |
| `supabase db pull` | ✅ | ⚠️ inserts row into `supabase_migrations` | ✅ |
| `supabase migration repair` | ✅ | ⚠️ edits history table | ❌ |
| `supabase db push` / `db reset` | — | 🚫 applies/destroys | — |

Only the read-only rows are used during recovery. `db pull`, `repair`, `push`, `reset` require explicit approval and are **not** part of recovery.

## 4. Recovery procedure (as executed)

1. **Confirm linked project & Docker** (read-only): project ref `acspvovspjhqeboqbgjh`, region `aws eu-west-2`.
2. **Confirm backup** exists (Supabase Dashboard → Database → Backups, or a manual data-only dump stored outside the repo).
3. **Provide DB password** via the gitignored root `.env` as `SUPABASE_DB_PASSWORD` (never pasted into chat, never printed).
4. **Dump the public schema (read-only):**
   ```bash
   supabase db dump --linked -p "$SUPABASE_DB_PASSWORD" -s public \
     -f supabase/recovery/recovered_public_schema.sql
   ```
   > Note: the CLI may exit non-zero due to a PostHog telemetry shutdown timeout *after* the dump completes — the file is still fully written. Verify with `wc -l`.
5. **Review** the recovered SQL → [docs/recovery/sprint4-schema-recovery-review.md](../recovery/sprint4-schema-recovery-review.md).

## 5. Recovery artifacts

- [supabase/recovery/recovered_public_schema.sql](../../supabase/recovery/recovered_public_schema.sql) — recovered `public` schema (18 tables, 1 function, constraints, indexes, RLS, grants).
- [docs/recovery/sprint4-schema-recovery-review.md](../recovery/sprint4-schema-recovery-review.md) — structured review (confirmed facts, security findings, architecture improvements, migration plan).

## 6. Known recovery gaps (public-only scope, by design)

- The **trigger binding** for `handle_new_user()` lives on `auth.users` (auth schema) — not captured by a public-only dump. Must be documented/recovered separately.
- `extensions` objects (e.g. `uuid_generate_v4`) are referenced, not defined here (correct to exclude).
- **Storage buckets:** none exist — KYC document bucket is a forward Sprint 4 task, not a recovery item.
- **Migration history:** the phantom empty migration remains until baseline promotion.

## 7. Remaining recovery steps (not yet done)

Per the migration plan ([review §4](../recovery/sprint4-schema-recovery-review.md)):
1. Complete read-only verification of SEC-1…SEC-6 (Migration Plan Step 1).
2. Document the `auth.users` trigger binding.
3. Promote recovered SQL → baseline migration; retire the phantom empty migration (local only).
4. Reconcile migration history so local == remote (**writes remote metadata — deferred, needs approval**).
5. Ship security fixes as forward migrations, staged before production.

## 8. Restore expectations (recovery objective)

Any engineer/AI can clone the repo and, using [AGENT.md](./AGENT.md) read order + this runbook, reconstruct the schema and understand the recovery state within minutes — without chat history or model memory.
