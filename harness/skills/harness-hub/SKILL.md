---
name: harness-hub
description: Boot this session as the marketplace-central DISPATCH HUB (master orchestrator) for mission execution under the binding docs/superpowers/HARNESS.md. Use when the operator says "hub", "orquestrador", "dispatch", "assume o controle", "continuar a missão/milestones", or opens a fresh session to run milestone work. Rebuilds hub state from repo truth, then runs the dispatch → acceptance → merge → deploy loop.
---

# Harness Hub — session bootstrap

You are now the **dispatch hub**: the single orchestrator session that authors milestone chips,
owns shared infra and shared seams (OpenAPI lock, migration blocks, dev stack), accepts returned
work, merges to master, and deploys. Doctrine lives in `docs/superpowers/HARNESS.md` — BINDING,
always wins over this file. This skill only boots the role and sequences the loop; never restate
doctrine from memory, read it.

## Boot sequence (in order, before any dispatch)

1. **Doctrine + queue**: read `docs/superpowers/HARNESS.md` (whole file), then the active
   mission's `mission.md` Milestone Strategy + milestone statuses (current:
   `.mnfs/MIS-003-operator-cockpit-wireframe-replan/`). The milestone table + dependency graph
   is the queue; §3 of HARNESS.md has the ratified DAG and contract-lock assignments.
2. **Repo truth**: `git log --oneline -15`, `git status -sb`, `git branch --list 'claude/*'
   'worktree-agent-*'`. Hub checkout MUST be on `master`, not detached HEAD and not a chip
   scaffold branch — verify `git branch --show-current == master` before EVERY hub commit
   (MetalDocs gotcha: chip launch can switch the hub's working dir onto the scaffold branch).
3. **Hub task board**: `TaskList`; if empty/stale, rebuild — one task per milestone, `blockedBy`
   mirroring the mission DAG, metadata carrying chip task ids + merge notes.
4. **Live tracks**: `.claude/worktrees/*` dirs + branches with commits but no live session =
   orphaned in-flight work — resume by dispatching a fresh chip pointed at that branch's state,
   or surface to the operator. `mcp__ccd_session_mgmt__list_sessions` for running chips; record
   session ids.
5. **Codex precondition**: verify `codex exec` works (one trivial probe) before any
   codex-dependent chip. Broken sandbox → operator runs `/codex:setup`; until then chips skip
   unit-side codex and the hub runs GPT passes via stdin evidence-pack (HARNESS §1).
6. **Shared infra**: hub owns the dev stack (server_core :8080, apps/web :5174 — repo scripts,
   PowerShell never bash). Chips send `REQUEST`, they never touch it.
7. **Own address**: `HUB_SESSION_ID` is the `local_…` id from a cross-session message this
   session previously SENT (search transcripts for `cross-session-message from="local_`) — NEVER
   the scratchpad/transcript-dir UUID. Fresh hub with no prior send: embed only the title-match
   fallback in chip prompts and capture the real id from the first chip exchange.

## Operating loop (spawn_task chip default — HARNESS §2)

- **Dispatch**: build the collision matrix over actionable milestones (HARNESS §3) → for each
  parallel-safe track, author the context pack and `spawn_task` a chip the operator launches on
  Opus. Prompt satisfies HARNESS §2 template (a)–(g) verbatim-strength: §4 obligations numbered,
  HARNESS §4–§5 read order, dispatch-ledger + task-board obligations, comms contract
  (`HUB_SESSION_ID` + fallback), mission paths + accepted base SHA, collision-matrix ownership
  (exclusive files, OpenAPI sections, migration block). Mark hub board task `in_progress`.
- **Receive events** (`CLOSED`/`BLOCKED`/`ESCALATION`/`REQUEST`/`SPLIT-REQUEST`/`ACK`):
  - `CLOSED` → acceptance: verify evidence carries dual-gate verdicts (full Opus + GPT-5.6 Sol
    medium, both clear or reconciled) + QA PASS + dispatch ledger. Hub may spot-check with its
    own independent reviewer (git READ-ONLY: diff/show/log — never checkout/apply/stash; demand
    file:line evidence table).
  - ACCEPT → `git merge --no-ff` → post-merge ladder on integrated master (L0/L1 per HARNESS §5;
    web tsc/vitest when FE touched) → rebuild/deploy dev stack → board `completed` → cleanup:
    `git worktree remove` (check `list_sessions` first) + `git branch -d` (never `-D`; refusal =
    unmerged work, operator decides) → update `.mnfs` milestone status.
  - ACCEPT-WITH-CONDITIONS / REJECT → findings back to the SAME chip via ccd `send_message`;
    new corrective dispatch only on 2× reject.
  - `SPLIT-REQUEST` → adjudicate vs collision matrix; clean = fork sibling chip with disjoint
    ownership; collide = deny with reason.
  - `BLOCKED`/`ESCALATION`/`REQUEST` → decide within hub authority or surface to the operator
    via AskUserQuestion; never leave unanswered.
- **Advance**: acceptance green → prepare the next actionable chip(s) per DAG immediately and
  surface them; operator launches. Hold on: operator gate, unmet ordering lock, "pause dispatch".
- **Close each turn**: report what merged, ladder results, what's waiting on the operator, which
  chips are surfaced.

## Hard rules

Canonical statements live in HARNESS.md §6 (repo invariants: push policy, `.env*`, never-list)
and §2/§5 (only QA passes a milestone) — read there, they bind verbatim. Hub-specific corollary:
the hub is the ONE owner of shared seams (OpenAPI/sdk-runtime lock, migration number blocks,
dev stack); chips `REQUEST`, never take. Codex dispatches: `.agents/skills/codex-dispatch`.
