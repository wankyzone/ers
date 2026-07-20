---
Title: ERS Engineering Roadmap
Purpose: Direction, sprint history, and the long-term Wanky Secure vision. Not a commitment schedule.
Owner: Architecture (CTO)
Status: Stable
Version: 1.0
Last Updated: 2026-07-19
Read After: AGENT.md
Related: CURRENT_SPRINT.md, ARCHITECTURE.md
---

# ROADMAP.md — ERS Engineering Roadmap

This is direction, not a commitment schedule. The live "what's next" is in [.javex/NEXT.md](../../.javex/NEXT.md).

---

## Product mission

Canonical mission: [AGENT.md §1](./AGENT.md). In one line — build Africa's most trusted platform for getting real-world tasks completed; trust is the product.

## Sprint history & direction

| Sprint | Theme | Status |
|--------|-------|--------|
| 1–2 | Foundation & authentication (Supabase Auth, auth UI, navigation) | Done (per Git history) |
| 3 | Core ERS foundation (errands, wallets, payments/Paystack, escrow) | Done (per Git history) |
| **4** | **Runner Verification & KYC** | **In progress** — see [CURRENT_SPRINT.md](./CURRENT_SPRINT.md) |
| 4-pre | **Infrastructure recovery** (make Git source of truth again) | In progress — see [RECOVERY.md](./RECOVERY.md) |
| 5+ | (Proposed) Ratings & trust signals, dispute resolution, payouts hardening | Planned |

> Sprint 4 is currently **gated** by infrastructure recovery: the production schema must be under version control and the security findings verified before KYC features are built on top of it.

## Long-term: "Wanky Secure"

ERS is the first product on the internal **Wanky Secure** platform. Capabilities, to evolve naturally from ERS (do not over-abstract early):

- Secure Authentication by Wanky
- Device Trust
- Audit Logs
- KYC
- Session Management
- Risk Scoring
- Fraud Detection

See [ARCHITECTURE.md §7](./ARCHITECTURE.md) for how the current schema already seeds these.

## Guiding constraints

- Security by default; every feature must increase trust.
- Standardize on Supabase; do not reinvent its infrastructure.
- No technical debt unless documented in [DECISIONS.md](./DECISIONS.md).
