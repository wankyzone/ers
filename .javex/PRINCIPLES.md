# PRINCIPLES (live quick-reference)

> **Runtime state** · Last Updated: 2026-07-19 · Canonical: [docs/ai/AGENT.md §2–6](../docs/ai/AGENT.md). This is a summary for fast recall, not a second source.

The working rules every session applies.

1. **Security by default** — the secure path is the default path.
2. **Trust first** — never weaken auth/authz; never store secrets or PII in plaintext.
3. **Repository is the source of truth** — not chat history, not model memory.
4. **Production-ready only** — no throwaway code in `main`.
5. **Simplicity over cleverness.**
6. **Strong typing & clear contracts** (`packages/types`).
7. **No undocumented technical debt** — record it in [docs/ai/DECISIONS.md](../docs/ai/DECISIONS.md).
8. **Use official Supabase patterns; RLS is the gate.**
9. **Reversible, forward-only migrations** — never edit the recovered baseline.
10. **Never assume; read before changing; explain WHY; work sequentially.**
11. **Ask before destructive or production-writing operations.**
12. **Update EOS state on exit** (see Session Exit Checklist in AGENT.md).
