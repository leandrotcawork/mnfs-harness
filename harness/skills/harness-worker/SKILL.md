---
name: harness-worker
description: Operating rules for ANY dispatched worker/session doing product-repo milestone or feature work (implementer, planner, reviewer, investigator, QA). Defers entirely to the binding harness doctrine (HARNESS-CORE + the repo's docs/HARNESS-PROFILE.md). Use when dispatched by the hub or a milestone session, or when any harness/protocol question arises.
---

# Harness Worker — dispatched-session rules

The ONLY binding harness is the **core doctrine + the repo profile** named in your dispatch
prompt (typically `HARNESS-CORE.md` via plugin or vendored under `docs/`, plus
`docs/HARNESS-PROFILE.md`; legacy repos may name a combined `docs/HARNESS.md`). Read the
sections your dispatch prompt names — minimum core §4 anti-slop contract + §5 verification
ladder + the profile's ladder bindings and non-negotiables — before writing anything. This
skill adds no doctrine; it routes you there and pins the non-negotiables dispatched workers
most often violate.

**Superseded protocols:** the profile §10 denylist names retired skills/protocols for this
repo. If skill discovery, a script, or an old doc points you at one — stop, use the doctrine
your dispatch prompt pinned. Never rely on on-disk skill discovery in worktrees.

## Pinned non-negotiables (full text in core + profile)

1. Your dispatch prompt defines your scope, owned files/seams, and base SHA. Anything
   outside it = `REQUEST`/`ESCALATION` to your dispatcher, never "fix while here".
2. One writer per shared seam. Contract spec + generated SDK land in the same commit.
   Migration numbers are pre-allocated grants — never grab blind.
3. The profile §7 non-negotiables (tenancy predicates, adapter boundaries, integrity rules
   like "unknown ≠ zero") bind verbatim per touched endpoint.
4. Failing test first; commit per green slice; evidence written to the paths your prompt
   names — unwritten = didn't happen.
5. Never: push, reset, revert, stash, clean, read/print `.env*`, install deps
   (dep change = `REQUEST`), touch the dev stack (hub-owned; ports per profile).
6. Build/test env exactly as the profile §2 binds it (hermetic caches, required env vars,
   shell/OS binding). Fresh worktree → run the profile §3 bootstrap BEFORE any lane; its
   false-alarm signatures are listed there — check them before debugging a "failure".
7. Codex calls: always close stdin on raw `codex exec` (`@() | codex exec ...` in PowerShell;
   `< /dev/null` in bash) — silent ≥2 min = the stdin hang, kill and re-issue (core §1).
8. Anti-slop checklist (core §4) is REJECT-on-hit: no speculative abstraction, no comment
   narration, no blanket recover/fallback on integrity reads, no test theater.
9. A false alarm, flake, race, or tooling gotcha you prove in the field is a FINDING — report
   it in your event payload so the hub can ratify it into the profile (core §0). Findings die
   in transcripts unless reported.
