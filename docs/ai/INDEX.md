---
Title: ERS Engineering Operating System — Index
Purpose: Landing page and map for the entire EOS; how to onboard and where everything lives.
Owner: Engineering Lead
Status: Stable
Version: 1.0
Last Updated: 2026-07-19
Read After: (start here)
Related: AGENT.md, all docs/ai/*, .javex/*
---

# ERS Engineering Operating System (EOS)

**Start here.** This is the landing page for how ERS engineering knowledge is organized. The **repository — not chat history or model memory — is the single source of truth.**

---

## 1. Documentation philosophy

- The repo must let any engineer or AI resume work **without prior conversations**.
- Two layers, clear responsibilities, **no duplication**: permanent record vs. live runtime state.
- Every fact has **one canonical home**; everything else links to it.
- Deterministic workflows: a fixed read order and explicit session start/exit checklists.

## 2. Structure

| Layer | Location | Nature | Rewritten? |
|-------|----------|--------|-----------|
| **Permanent record** | `docs/ai/` | Constitution, architecture, security, recovery, roadmap, decisions, sprint/task, changelog | Rarely; history preserved |
| **Live runtime state** | `.javex/` | Current status, next actions, memory, handover, session | Continuously; **no history** |
| **Deep artifacts** | `docs/recovery/`, `docs/audits/`, `supabase/recovery/` | Point-in-time reviews & recovered SQL | Append/new files |

Runtime files never store history — history belongs in `docs/ai/CHANGELOG.md` ([ADR-009](./DECISIONS.md)).

## 3. Read order (context synchronization)

1. [AGENT.md](./AGENT.md) — the Constitution (read fully)
2. [.javex/STATUS.md](../../.javex/STATUS.md) — where things stand right now
3. [.javex/NEXT.md](../../.javex/NEXT.md) — the next actions
4. [CURRENT_SPRINT.md](./CURRENT_SPRINT.md) — active sprint
5. [CURRENT_TASK.md](./CURRENT_TASK.md) — active task
6. [DECISIONS.md](./DECISIONS.md) — decisions, including open ones
7. Task-relevant docs: [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](./SECURITY.md), [RECOVERY.md](./RECOVERY.md), [ROADMAP.md](./ROADMAP.md)

## 4. Document responsibilities (single source of truth)

| Document | Canonical owner of… |
|----------|---------------------|
| [AGENT.md](./AGENT.md) | Mission, principles, standards, read order, session workflow, checklists, approvals, stopping conditions |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, stack, monorepo layout, data model, Wanky Secure vision |
| [SECURITY.md](./SECURITY.md) | Security standards + current findings (SEC-*) |
| [RECOVERY.md](./RECOVERY.md) | Infrastructure recovery runbook & state |
| [DECISIONS.md](./DECISIONS.md) | ADRs (accepted + pending) |
| [ROADMAP.md](./ROADMAP.md) | Direction, sprint history, long-term |
| [CURRENT_SPRINT.md](./CURRENT_SPRINT.md) | Active sprint scope & Definition of Done |
| [CURRENT_TASK.md](./CURRENT_TASK.md) | Active task definition & progress |
| [CHANGELOG.md](./CHANGELOG.md) | Engineering history (append-only) |
| [.javex/STATUS.md](../../.javex/STATUS.md) | Live snapshot of state |
| [.javex/NEXT.md](../../.javex/NEXT.md) | Canonical "next actions" |
| [.javex/MEMORY.md](../../.javex/MEMORY.md) | Quick-reference pointers + ephemeral gotchas |
| [.javex/HANDOVER.md](../../.javex/HANDOVER.md) | Latest handoff only |
| [.javex/SESSION.md](../../.javex/SESSION.md) | Current session |
| [.javex/MISSION.md](../../.javex/MISSION.md) · [.javex/PRINCIPLES.md](../../.javex/PRINCIPLES.md) | Quick-ref pointers to AGENT.md (non-canonical) |

## 5. Quick onboarding (5-minute AI / 30-minute human)

**AI resuming work:** read §3 in order; the answers to "what/where/next/blockers" are in STATUS, NEXT, CURRENT_SPRINT, DECISIONS, SECURITY.
**New human engineer:** read [AGENT.md](./AGENT.md) → [ARCHITECTURE.md](./ARCHITECTURE.md) → [CURRENT_SPRINT.md](./CURRENT_SPRINT.md) → [SECURITY.md](./SECURITY.md), then skim [DECISIONS.md](./DECISIONS.md). Repo runs on `pnpm` + `turbo` (Node ≥20).

## 6. EOS Definition of Done (v1.0)

The EOS is approved as v1.0 only when **all** are true:

- [ ] Repository is the single source of truth.
- [ ] A new engineer can onboard in under 30 minutes using only the repo.
- [ ] A new AI can resume work in under 5 minutes using only the repo.
- [ ] No critical documentation gaps remain.
- [ ] All cross-references are valid.
- [ ] `.javex/` (runtime) and `docs/ai/` (permanent) have clear, non-overlapping responsibilities.
- [ ] Session start and exit workflows are deterministic.
- [ ] The EOS is approved as v1.0 by the human owner.

Product development does not resume until every box is checked.
