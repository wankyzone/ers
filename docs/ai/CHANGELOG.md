---
Title: ERS Engineering Log
Purpose: Append-only history of engineering-significant events (infra, schema, security, docs). Also the home for historical session handoffs.
Owner: Engineering
Status: Living
Version: 1.0
Last Updated: 2026-07-19
Read After: AGENT.md
Related: DECISIONS.md, RECOVERY.md
---

# CHANGELOG.md — ERS Engineering Log

This log records engineering-significant events (infra, schema, security, docs). For product/sprint context see [CURRENT_SPRINT.md](./CURRENT_SPRINT.md); for decisions see [DECISIONS.md](./DECISIONS.md).

---

## 2026-07-19

### Engineering Operating System (EOS) established
- Built the permanent documentation layer `docs/ai/`: populated the empty `ARCHITECTURE.md`, `ROADMAP.md`, `CURRENT_SPRINT.md`, `DECISIONS.md`, `SECURITY.md`, `RECOVERY.md`, `CHANGELOG.md`; expanded `AGENT.md` into the Engineering Constitution (mission, standards, read order, session workflow, approval requirements, stopping conditions, start/exit checklists); improved `CURRENT_TASK.md`.
- Created the live runtime-state layer `.javex/`: `MISSION.md`, `PRINCIPLES.md`, `STATUS.md`, `NEXT.md`, `MEMORY.md`, `HANDOVER.md`, `SESSION.md`.
- Cross-referenced all documents; established the read order and session start/exit rituals ([ADR-005](./DECISIONS.md)).

### Infrastructure recovery (in progress)
- Recovered production `public` schema (read-only `supabase db dump`) → `supabase/recovery/recovered_public_schema.sql` (18 tables, 1 function, constraints, indexes, RLS, grants).
- Produced schema recovery review → `docs/recovery/sprint4-schema-recovery-review.md` (SEC-1…SEC-6, ARCH-1…ARCH-6, migration plan).
- Chose `supabase db dump` over `db pull` to avoid remote metadata writes ([ADR-003](./DECISIONS.md)).
- Identified phantom empty migration `20260718111426_remote_schema.sql` (from a prior `db pull` against an already-marked history).
- Migration Plan Step 1 (read-only verification of SEC findings) **started, then paused** for the EOS documentation sprint.

## Earlier (from Git history, pre-EOS)

- `06bf788` / `ff09125` — fix(api): load environment before module initialization
- `4386dce` — chore: debug backend environment loading
- `2a84817` — feat(core): complete ERS foundation and authentication
- `fd15f9c` — feat(auth-ui): implement authentication UI and navigation
