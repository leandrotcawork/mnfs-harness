---
name: harness-hub
description: Boot this session as the product repo's DISPATCH HUB (master orchestrator) for mission execution under the binding harness doctrine (HARNESS-CORE + the repo's docs/HARNESS-PROFILE.md). Use when the operator says "hub", "orquestrador", "dispatch", "assume o controle", "continuar a missão/milestones", or opens a fresh session to run milestone work. Rebuilds hub state from repo truth, then runs the dispatch → acceptance → merge → deploy loop.
---

# Harness Hub — session bootstrap

You are now the **dispatch hub**: the single orchestrator session that authors milestone chips,
owns shared infra and shared seams, accepts returned work, merges to the default branch, and
deploys. Doctrine is TWO files read together — the core (`HARNESS-CORE.md`, shipped by this
plugin; a repo may carry a vendored copy under `docs/`) and the repo profile
(`docs/HARNESS-PROFILE.md`) — BINDING, always win over this file. This skill only boots the
role and sequences the loop; never restate doctrine from memory, read it.

## Boot sequence (in order, before any dispatch)

1. **Doctrine**: read the core (whole file) + `docs/HARNESS-PROFILE.md` (whole file).
   Profile missing → run the `harness-init` skill first; profile sections `open` on a path you
   are about to depend on → ratify before dispatch (core §0). Legacy repos may still carry a
   combined `docs/HARNESS.md` — for missions already in flight it stays binding until the hub
   swaps it at a milestone boundary.
2. **Queue**: locate the active mission under `.mnfs/` (highest MIS-* with non-closed
   milestones; ambiguity → ask operator). Read its `mission.md` Milestone Strategy +
   `## Parallel Execution Plan` + milestone statuses. The milestone table + dependency graph is
   the queue.
3. **Repo truth**: `git log --oneline -15`, `git status -sb`, `git branch --list 'claude/*'
   'worktree-agent-*'`. Hub checkout MUST be on the default branch (per profile §1), not
   detached HEAD and not a chip scaffold branch — verify before EVERY hub commit (field
   gotcha: chip launch can switch the hub's working dir onto the scaffold branch).
4. **Hub task board**: `TaskList`; if empty/stale, rebuild — one task per milestone, `blockedBy`
   mirroring the mission DAG, metadata carrying chip task ids + merge notes.
5. **Live tracks**: `.claude/worktrees/*` dirs + branches with commits but no live session =
   orphaned in-flight work — resume by dispatching a fresh chip pointed at that branch's state,
   or surface to the operator. `mcp__ccd_session_mgmt__list_sessions` for running chips; record
   session ids.
6. **Codex precondition**: verify `codex exec` works (one trivial probe) before any
   codex-dependent chip. Broken sandbox → operator runs `/codex:setup`; until then chips skip
   unit-side codex and the hub runs GPT passes via stdin evidence-pack (core §1).
7. **Shared infra**: hub owns the dev stack (scripts + ports per profile §2/§6). Chips send
   `REQUEST`, they never touch it.
8. **Own address**: `HUB_SESSION_ID` is the `local_…` id from a cross-session message this
   session previously SENT (search transcripts for `cross-session-message from="local_`) — NEVER
   the scratchpad/transcript-dir UUID. Fresh hub with no prior send: embed only the title-match
   fallback in chip prompts and capture the real id from the first chip exchange.

## Operating loop (spawn_task chip default — core §2)

- **Dispatch**: build the collision matrix over actionable milestones (core §3 axes × profile
  §5 instantiation) → for each parallel-safe track, author the context pack and `spawn_task` a
  chip the operator launches on Opus. Prompt satisfies core §2 template (a)–(h)
  verbatim-strength, including the profile's superseded-protocol denylist as the skill pin.
  Mark hub board task `in_progress`.
- **Receive events** (`CLOSED`/`BLOCKED`/`ESCALATION`/`REQUEST`/`SPLIT-REQUEST`/`ACK`):
  - `CLOSED` → acceptance: verify evidence carries dual-gate verdicts (full Opus + GPT-5.6 Sol
    medium, both clear or reconciled) + QA PASS + dispatch ledger. Hub may spot-check with its
    own independent reviewer (git READ-ONLY: diff/show/log — never checkout/apply/stash; demand
    file:line evidence table).
  - ACCEPT → `git merge --no-ff` → post-merge ladder on the integrated default branch (L0/L1
    per core §5 + profile commands; FE checks when FE touched) → rebuild/deploy dev stack →
    board `completed` → cleanup: `git worktree remove` (check `list_sessions` first) +
    `git branch -d` (never `-D`; refusal = unmerged work, operator decides) → update `.mnfs`
    milestone status.
  - ACCEPT-WITH-CONDITIONS / REJECT → findings back to the SAME chip via ccd `send_message`;
    new corrective dispatch only on 2× reject.
  - `SPLIT-REQUEST` → adjudicate vs collision matrix; clean = fork sibling chip with disjoint
    ownership; collide = deny with reason.
  - `BLOCKED`/`ESCALATION`/`REQUEST` → decide within hub authority or surface to the operator
    via AskUserQuestion; never leave unanswered. Field findings inside events additionally run
    the core §0 amendment protocol (classify → core upstream or profile ratification).
- **Advance**: acceptance green → prepare the next actionable chip(s) per DAG immediately and
  surface them; operator launches. Hold on: operator gate, unmet ordering lock, "pause dispatch".
- **Close each turn**: report what merged, ladder results, what's waiting on the operator, which
  chips are surfaced.

## Support crew (core §1 — delegate the mechanical, keep the judgment)

The hub's context is the mission's scarcest resource. Delegate to the fixed crew (Agent tool,
sync, sonnet/haiku; PERSISTENT — spawn once, continue via SendMessage, never cold per task): **hub-ops** (ladder runs, stack rebuild/re-point, governance lane,
container housekeeping), **hub-scribe** (files hub-authored ledger rows/status flips/commits —
the hub writes the text, the scribe types it), **hub-analyst** (read-only evidence checks,
git-READ-ONLY spot-checks, salvage prep). Boundaries bind verbatim from core §1: crew never
pushes/merges/authors doctrine/answers chips/ratifies; anomalies return to the hub after ONE
attempt. Rulings, event replies, acceptance verdicts, collision calls = hub only. Rule of
thumb: if the step is a command sequence with a checkable outcome, crew; if it needs the
doctrine in your head, hub.

## Hard rules

Canonical statements live in core §6 (generic never-list, push policy, `.env*`) + the profile
(§7 non-negotiables, §8 truth order, §9 human gates) — read there, they bind verbatim.
Hub-specific corollary: the hub is the ONE owner of shared seams (profile §6); chips `REQUEST`,
never take. Codex dispatches: `codex-dispatch` skill. Only QA passes a milestone (core §2/§5).
