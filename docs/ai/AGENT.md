---
Title: ERS Engineering Constitution
Purpose: The authoritative rules for all engineering — mission, standards, read order, session workflow, approvals, stopping conditions.
Owner: Engineering Lead
Status: Stable
Version: 1.0
Last Updated: 2026-07-19
Read After: INDEX.md
Related: ARCHITECTURE.md, SECURITY.md, DECISIONS.md, RECOVERY.md
---

# AGENT.md — ERS Engineering Constitution

> This is the single most important document in the repository.
> Every engineer and every AI (Claude, ChatGPT, Cursor, Gemini, Codex, Copilot, and future models)
> MUST read this file first, then follow the read order below, before writing anything.
>
> **The repository — not any chat history or model memory — is the source of truth.**

---

## 1. Mission

Build **Africa's most trusted platform for getting real-world tasks completed** (ERS — Errand Runners System).

Trust is the product. Every technical decision is judged by one question: **does this increase user trust?**

See [.javex/MISSION.md](../../.javex/MISSION.md) for the live mission statement and [ROADMAP.md](./ROADMAP.md) for direction.

---

## 2. Engineering Philosophy

- **Security by default** — the secure path is the default path, not an opt-in.
- **Production-ready code** — no throwaway code in `main`. If it ships, it is production quality.
- **Simplicity over cleverness** — boring, readable code beats clever code.
- **Modular architecture** — clear boundaries between apps, services, and packages.
- **Strong typing** — TypeScript everywhere it is practical; explicit contracts in `packages/types`.
- **No technical debt unless explicitly documented** — debt is only acceptable when recorded in [DECISIONS.md](./DECISIONS.md).
- **Do not reinvent infrastructure Supabase already provides** (see §5).

## 3. Trust-First Development

Trust is not a feature; it is a constraint on every feature.

- Never weaken authentication or authorization to ship faster.
- Never store sensitive data (passwords, PINs, BVN, NIN) in plaintext.
- Treat KYC/PII as regulated data: least privilege, encryption where practical, audited access.
- Every user-facing change should make the platform *more* trustworthy, or at minimum not less.
- When a change trades trust for convenience, it must be recorded and approved in [DECISIONS.md](./DECISIONS.md).

## 4. Coding Standards

- **Language:** TypeScript for packages and mobile; the API service is currently Node/Express ESM (JavaScript) — see [ARCHITECTURE.md](./ARCHITECTURE.md).
- **Package manager:** `pnpm` (workspace). Build orchestration via `turbo`. Node `>=20`.
- **Formatting/linting:** `biome` + `prettier` are configured at the root. Match the style of surrounding code.
- **Naming:** consistent, descriptive, no abbreviations that obscure meaning. Keep API route names and DB column names consistent across layers.
- **Validation:** validate all external input (use `zod`; shared validators belong in `packages`).
- **Reversibility:** every migration must be reversible and forward-only against the recovered baseline (see [RECOVERY.md](./RECOVERY.md)).
- **No secrets in code or Git.** Secrets live in the gitignored `.env`.

## 5. Security Standards

Authoritative details live in [SECURITY.md](./SECURITY.md). The rules:

- **Standardize on Supabase** for Authentication, Authorization (RLS), PostgreSQL, Storage, Realtime, and Edge Functions where appropriate.
- **RLS is the gate.** Any table granted to `anon`/`authenticated` MUST have RLS enabled with explicit, minimal policies.
- **Least privilege.** Prefer `service_role` server-side only; never expose it to clients.
- **No plaintext credentials or PII.** Hash secrets; encrypt/tokenize regulated identifiers.
- **Authorization is never derived from client-supplied data** (e.g. signup metadata must not set roles).
- **Flag security concerns immediately** — do not defer or silently work around them.

## 6. Documentation Standards

The documentation system is the **Engineering Operating System (EOS)**. Two layers:

- **`docs/ai/` — permanent record.** Architecture, security, recovery, roadmap, decisions, changelog, sprint/task context. History is preserved, never rewritten destructively.
- **`.javex/` — live runtime state.** Rewritten continuously: current status, next actions, memory, handover, session. Lightweight and always current.

Rules:
- Never recreate, rename, or delete permanent docs without a decision record.
- Keep documents internally consistent and cross-referenced.
- Eliminate duplicated information — link instead of copying.
- Convert relative dates to absolute (`2026-07-19`, not "today").

## 7. Read Order (Context Synchronization)

Every session begins by reading, in this exact order:

1. [docs/ai/AGENT.md](./AGENT.md) (this file)
2. [.javex/STATUS.md](../../.javex/STATUS.md)
3. [.javex/NEXT.md](../../.javex/NEXT.md)
4. [docs/ai/CURRENT_SPRINT.md](./CURRENT_SPRINT.md)
5. [docs/ai/CURRENT_TASK.md](./CURRENT_TASK.md)
6. [docs/ai/DECISIONS.md](./DECISIONS.md)
7. Any additional docs relevant to the current task ([ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](./SECURITY.md), [RECOVERY.md](./RECOVERY.md), [ROADMAP.md](./ROADMAP.md)).

Only after every relevant document has been reviewed may implementation begin.

## 8. Session Workflow

1. **Synchronize context** using the read order above.
2. **Confirm** the current Git branch and the session objective.
3. **Work sequentially** — one focused step at a time. Do not jump ahead.
4. **Read existing code before changing it.** Never assume.
5. **Explain WHY** before changing something; prefer incremental improvements over rewrites.
6. On completion, run the **Session Exit Checklist** (§11) and update runtime state.

## 9. Approval Requirements

Explicit human approval is required before any of the following:

- Any operation that **writes to the production database** (`supabase db push`, `migration repair`, data edits).
- `supabase db reset` or any destructive SQL.
- Deleting or overwriting files not created in the current session.
- Sending data to external services, or anything outward-facing/hard to reverse.
- Merging to `main`.

Read-only operations (e.g. `supabase db dump`, `migration list`, `SELECT`) are allowed but must be identified as read-only.

## 10. Stopping Conditions

Stop and wait for the human when:

- The task's defined step is complete (report the result, do not auto-continue).
- A destructive or production-writing operation is required.
- A blocker requires a decision that is the human's to make (see [DECISIONS.md](./DECISIONS.md) open items).
- Instructions conflict with this Constitution or with [SECURITY.md](./SECURITY.md).

---

## Session Start Checklist

Before writing any code:

- [ ] Read AGENT.md
- [ ] Read CURRENT_SPRINT.md
- [ ] Read CURRENT_TASK.md
- [ ] Read DECISIONS.md
- [ ] Read SECURITY.md
- [ ] Read RECOVERY.md (when infrastructure work is involved)
- [ ] Read .javex/STATUS.md
- [ ] Read .javex/NEXT.md
- [ ] Confirm current Git branch
- [ ] Confirm the objective for this engineering session

Do not begin implementation until every item has been completed.

## Session Exit Checklist

Before stopping, verify:

- [ ] STATUS.md updated
- [ ] NEXT.md rewritten
- [ ] HANDOVER.md rewritten (latest handoff only; prior handoff summarized into CHANGELOG.md — see [ADR-009](./DECISIONS.md))
- [ ] SESSION.md updated
- [ ] CURRENT_TASK.md updated
- [ ] CURRENT_SPRINT.md updated (if required)
- [ ] CHANGELOG.md updated
- [ ] DECISIONS.md updated (if needed)
- [ ] SECURITY.md updated (if needed)
- [ ] RECOVERY.md updated (if needed)

If ANY item is incomplete, the engineering session is NOT complete.
Never end a session until every item has been completed.

---

## Automatic Behaviour (post-task ritual)

Whenever an engineering task finishes, update runtime state:

- Rewrite [.javex/STATUS.md](../../.javex/STATUS.md), [.javex/NEXT.md](../../.javex/NEXT.md), [.javex/SESSION.md](../../.javex/SESSION.md)
- Rewrite [.javex/HANDOVER.md](../../.javex/HANDOVER.md) with the latest handoff (history → [CHANGELOG.md](./CHANGELOG.md); see [ADR-009](./DECISIONS.md))
- Update [CURRENT_TASK.md](./CURRENT_TASK.md); [CURRENT_SPRINT.md](./CURRENT_SPRINT.md) if required
- Append [CHANGELOG.md](./CHANGELOG.md)
- If architecture changed: update [ARCHITECTURE.md](./ARCHITECTURE.md) and [DECISIONS.md](./DECISIONS.md)
- If security changed: update [SECURITY.md](./SECURITY.md)
- If recovery/infra changed: update [RECOVERY.md](./RECOVERY.md)
