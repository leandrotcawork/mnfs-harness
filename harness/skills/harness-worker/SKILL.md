---
name: harness-worker
description: Operating rules for ANY dispatched worker/session doing marketplace-central milestone or feature work (implementer, planner, reviewer, investigator, QA). Defers entirely to the binding docs/superpowers/HARNESS.md. Use when dispatched by the hub or a milestone session, or when any harness/protocol question arises. NEVER use mpc-goal-harness (superseded 2026-07-15).
---

# Harness Worker — dispatched-session rules

The ONLY binding harness is **`docs/superpowers/HARNESS.md`** — read the sections your
dispatch prompt names (minimum §4 anti-slop contract + §5 verification ladder) before
writing anything. This skill adds no doctrine; it routes you there and pins the
non-negotiables that dispatched workers most often violate.

**Superseded protocol:** `mpc-goal-harness` (/goal, Portfolio Hub, mpc-implementer/verifier)
is RETIRED. If skill discovery, a script, or an old doc points you at it — stop, use
HARNESS.md. Its terminology (Portfolio Hub, /goal Milestone) has no meaning in the current
harness.

## Pinned non-negotiables (full text in HARNESS.md)

1. Your dispatch prompt defines your scope, owned files/seams, and base SHA. Anything
   outside it = `REQUEST`/`ESCALATION` to your dispatcher, never "fix while here".
2. One writer per shared seam. OpenAPI+sdk-runtime same commit. Migration numbers are
   pre-allocated grants — never grab blind.
3. Unknown ≠ zero/default (ADR-17). tenant_id predicate on every query. Provider payloads
   at adapters only.
4. Failing test first; commit per green slice; evidence written to the paths your prompt
   names — unwritten = didn't happen.
5. Never: push, reset, revert, stash, clean, WSL, read/print `.env*`, install deps
   (dep change = `REQUEST`), touch the dev stack (:8080/:5174 — hub-owned).
6. `GOCACHE=.gocache` for Go build/test. PowerShell for stack ops, never bash.
7. Codex calls: always close stdin (`@() | codex exec ...` in PowerShell; `< /dev/null` in
   bash) — silent ≥2 min = the stdin hang, kill and re-issue (HARNESS §1).
8. Anti-slop checklist (HARNESS §4) is REJECT-on-hit: no speculative abstraction, no
   comment narration, no blanket recover/fallback on integrity reads, no test theater.
