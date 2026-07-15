# Marketplace Central — Development Harness

**Ratified:** 2026-07-15 (operator-designed; supersedes the codex-only harness previously in
AGENTS.md). Binding for all mission execution (current queue: MIS-003 milestones M-01..M-06).
**Purpose:** one repeatable execution machine per milestone — quality AND speed. Serial-only is
forbidden where the dependency DAG allows parallel. The harness fixes WHO runs what, in WHAT
order, with WHAT evidence. Adapted from the MetalDocs harness (2026-07-10..14 ratifications);
field findings from that program carry over where marked.

---

## 1. Model matrix — who does what

| Role | Model / path | Does | Never does |
|---|---|---|---|
| **Hub** | Standing dispatch session (operator's hub; boots via `.claude/skills/harness-hub`) | Builds per-milestone context pack → spawn_task chip → collision matrix across parallel tracks → answers events → acceptance dual review → merge → post-merge ladder → deploy/correct → advance | Writing large diffs itself; reviewing its own dispatched work; letting chips touch shared infra |
| **Milestone session** | **Opus** (operator launches chip, worktree isolation) | Orchestrates ONE milestone end-to-end: native task board first act, feature order, dispatches all workers below, integrates features, emits events | Scope beyond its milestone; pushing; merging to master; shared infra; flipping mission status |
| **Feature planner** | **GPT-5.6 Sol, medium reasoning** via `/codex:rescue` | One thorough plan per feature BEFORE implementation — considers contracts, negative paths, seams, invariants, edge cases up front so implementation doesn't loop on corrections | Implementing |
| **Implement worker (standard)** | **GPT-5.6 Luna, high reasoning** via `/codex:rescue` | Standard/easy TDD slices per the written plan | Slices flagged complex |
| **Implement worker (complex)** | **GPT-5.6 Sol, low reasoning** via `/codex:rescue` | Complex slices (state machines, poller, envelope gates, tricky SQL) | — |
| **Investigator / bulk reads** | **GPT-5.6 Luna, medium reasoning** via codex subagent (default); `caveman:cavecrew-investigator` (haiku) allowed for trivial repo greps | Find files, read/summarize, return compressed report — offloads Opus context AND Claude quota | Suggesting fixes beyond the report |
| **Per-slice reviewer** | Independent Claude reviewer subagent (sonnet / cavecrew-reviewer) | Reviews each slice before the next starts; implementer ≠ reviewer, always | Generating new scope |
| **Final dual gate** | **Full Opus review + GPT-5.6 Sol medium review** (both independent, same fixed SHA) | Milestone-end diff review per §4 obligation 4 (canonical statement) | — |
| **Mission co-planner** | **GPT-5.6 Sol, medium** via `/codex:rescue` | Planning P3: BLIND counter-proposal (spine + milestone split + risks) from the frozen P0–P2 evidence — never sees Claude's candidate | Seeing Claude's draft; writing artifacts |
| **Mission decomposition auditor** | **GPT-5.6 Sol, medium** via `/codex:rescue` | Planning P5: audits DAG edges, six-axis disjointness, contract propagation, brief density — blocking subgate before P6 | New scope; implementation planning |
| **Mission readiness gate** | **GPT-5.6 Sol, HIGH** via `/codex:rescue` | Planning P7: full-tree ★1–★7 rubric review of the frozen manifest AFTER the Claude cold crew is Ready; plan is `planned` only when BOTH clear | Sampled pass; editing artifacts |
| **QA persona** | Fresh session/agent, zero inherited context, browser tools | Milestone-close validation as a USER (mission VC Drive blocks); curl-only = FAIL | Reading implementation diffs first; fixing |
| **Mechanical** | Haiku subagent | Renames, comment sweeps, format-only | Judgment work |

Concurrency: bounded by operator attention (chips) + ≤15 workers per session. Fable never a worker.

**Codex invocation rule:** all codex dispatches route through
`/codex:rescue --model <m> --effort <e> --wait` (companion runtime handles result-handling, resume
threading, and stdout-verbatim capture for the dispatch ledger; `--wait` = foreground = SYNC).
Raw `codex exec` is permitted ONLY for the one-off codex precondition probe.
Role → exact flags: use `.agents/skills/codex-dispatch` — never retype the matrix from memory,
and NEVER omit `--effort` (global codex default is `xhigh`: silently slower/costlier).

**Codex precondition:** before the first codex-dependent dispatch, hub verifies `codex exec`
works on this machine (MetalDocs field finding 2026-07-14: Windows sandbox can be broken
machine-wide — `orchestrator_helper_launch_failed`; fix = operator runs interactive
`/codex:setup`). Until fixed: milestone sessions do NOT attempt codex; hub runs GPT passes via
stdin evidence-pack (`codex exec --sandbox read-only -` with full diff + post-state of key files).

**Codex stdin gotcha (field-verified 2026-07-15, codex-cli 0.144.4):** in a non-tty shell
(every harness PowerShell/Bash call), `codex exec "<prompt>"` prints
`Reading additional input from stdin...` and BLOCKS FOREVER waiting for stdin to close. Every
codex call from a session MUST close stdin explicitly — PowerShell: `@() | codex exec ...`
(or pipe the evidence-pack when using `-`). A codex call silent for ~2 min is this hang, not a
slow model — kill and re-issue with stdin closed. PowerShell `Select-Object`/`Out-String`
buffer the whole pipeline, so interim output is invisible; append per-line to a log file when
progress visibility matters.

## 2. Execution loop

```
mission.md Milestone Strategy → hub takes actionable milestone(s) per DAG + collision matrix
  ↓ (spawn_task chip; operator launches on Opus)
P1 BOARD     first act: TaskCreate board — one task per feature, blockedBy = real deps
P2 PLAN      per feature: GPT-5.6 Sol medium plan via /codex:rescue against feature.md brief
             + owning IC(s); plan = slice cards (goal, files, failing-test-first, done criteria)
P3 IMPLEMENT per slice: codex worker (Luna high standard / Sol low complex) — failing test
             first, green, commit per green slice on the worktree branch
P4 REVIEW    per slice: independent Claude reviewer BEFORE next slice (anti-slop checklist §4)
P5 VERIFY    ladder L0→L2 (§5) from clean state, run by the milestone session
P6 DUAL GATE per §4 obligation 4 (canonical): Opus + Sol medium on the fixed-SHA diff
P7 QA        MNFS milestone gate: run `/milestone-validate <milestone-path> --apply` — the
             independent cold `milestone-reviewer` crew + QA live-drive (fresh browser persona
             on the VC Drive blocks) per the plugin's validation skill; verdict artifact at
             <milestone-root>/validation-result.md (only QA passes a milestone). Fail →
             `/correction-create` scopes; the chip dispatches its corrective worker; full
             re-gate, never-downgrade across rounds
P8 CLOSE     evidence per feature at F-*/validation.md; dispatch ledger; CLOSED event to hub
  ↓
HUB          acceptance (verifies dual-gate + QA evidence) → merge --no-ff to master →
             post-merge ladder on integrated master → deploy/rebuild dev stack →
             worktree remove + branch -d → update .mnfs milestone status → next chip(s);
             all milestones CLOSED → /mission-validate then /mission-closeout (hub runs both)
```

**Role binding (single execution engine):** MNFS artifacts name contract roles — Milestone
Orchestrator = the chip, Feature Implementer = the dispatched implementation worker, Correction
Worker = the dispatched corrective worker. The plugin's own execution agents/commands for these
roles were deleted 2026-07-15 (`mnfs-plugin/docs/shared-standards.md` § Role Binding); the
harness is the only execution engine. Gate/verdict agents (`milestone-reviewer`, `qa-validator`,
`mission-reviewer`) remain plugin-owned, invoked via `/milestone-validate` / `/mission-validate`.

Milestone chips return to the hub ONLY via events (gates/terminal) — not turn-by-turn narration.

**Event grammar** (one event per message, header first, caveman-brief payload; sent over
`mcp__ccd_session_mgmt__send_message` to `HUB_SESSION_ID` — per-send operator click is a known
client limitation, so messages few and batched):

| Event | When | Payload |
|---|---|---|
| `CLOSED` | milestone done, commits in place | milestone id · branch + commit range · ladder results · dual-gate verdicts + reconciliation · QA verdict · defers |
| `BLOCKED` | stop-rule hit (architecture/contract contradiction, broken prerequisite, budget) | what, evidence, smallest unblock ask — sent IMMEDIATELY |
| `ESCALATION` | out-of-scope defect found | classification + repro pointer; in-scope work continues |
| `REQUEST` | needs shared resource (dev stack restart, DB reseed, dep install, OpenAPI lock) | what + why; hub owns shared infra and shared seams |
| `SPLIT-REQUEST` | remaining features/slices mutually independent; split buys wall-clock | proposed groups + disjoint file/module ownership |
| `ACK` | hub sent mid-flight correction | one line |

**Chip prompt MUST carry, verbatim-strength:** (a) §4 obligations numbered; (b) "read
docs/superpowers/HARNESS.md §4–§5 before implementing"; (c) evidence dispatch-ledger requirement
(closures listing zero planner/implementer/reviewer dispatches fail hub acceptance); (d) task-board
obligation; (e) comms contract (`HUB_SESSION_ID` + title-match fallback); (f) the milestone's
mission paths (`.mnfs/MIS-003.../M-0n.../milestone.md`, its `validation-contract.md`, feature
briefs, owning ICs) and accepted base SHA; (g) its collision-matrix ownership (exclusive files,
contract-lock status); (h) skill pin: "the binding harness is docs/superpowers/HARNESS.md +
`.agents/skills/harness-worker`; NEVER invoke `mpc-goal-harness` (superseded 2026-07-15)" —
propagated verbatim into every nested worker dispatch (field finding: worker skill-discovery
auto-resolved to a stale skill — never rely on on-disk skill discovery in worktrees; the pin
travels verbatim in every dispatch prompt).

**Remediation is a message, not a new chip:** ACCEPT-WITH-CONDITIONS / REJECT findings go back to
the same milestone session; new corrective dispatch only on 2× reject.

## 3. Parallel-track execution (quality AND speed)

Order governed by the real dependency DAG, never row number. **The true parallelism axis is
hub-dispatched sibling milestone/feature tracks** — one worktree/branch/chip each.

**Nested-child misrouting (proven, MetalDocs 2026-07-13; sharpened 2026-07-15 M-01):** a
BACKGROUND **Agent/Task-tool** nested child of a chip completes to the HUB's loop, never to its
parent — parent deadlocks. The artifact is Agent/Task routing, NOT parallelism itself. Rules:
- Agent/Task-tool nested children: SYNC only (`run_in_background: false`).
- **OS-process codex dispatch** (background shell: stdin closed, output teed to a scratchpad
  log, `.done` sentinel) completes to the DISPATCHING session's own loop (field-verified
  2026-07-15) — allowed intra-milestone, including backgrounded, subject to: one writer per
  seam still holds; every worker in the dispatch ledger; slice review before any dependent
  slice starts.
A milestone whose internal parallelism needs a second WRITER on a shared seam still emits
`SPLIT-REQUEST`; the hub adjudicates against the collision matrix and forks a sibling worktree
if clean.

**Collision matrix — two tracks run concurrently ONLY when disjoint on ALL axes.**
Axis definitions are canonical in the mission ownership-matrix columns (planning reference
card); this table restates them, never redefines them.
Source of truth: the mission's `## Parallel Execution Plan` (mission.md) — planning authors the
DAG + per-milestone ownership matrix on these same six axes at P5, and each milestone.md carries
an `## Ownership & Concurrency` block; the hub verifies at dispatch time instead of deriving the
matrix from scratch. Missions planned before 2026-07-15 (e.g. MIS-003) lack these blocks: the
hub derives the matrix itself (as below) and persists each milestone's `## Ownership & Concurrency`
block into its milestone.md at chip-authoring time (lazy retrofit).

| Axis | Collision test | If collide |
|---|---|---|
| Files | same source file edited by both | serialize or split ownership |
| **OpenAPI + SDK** | both edit `contracts/api/marketplace-central.openapi.yaml` / `packages/sdk-runtime` | contract lock: one owner at a time, or hub pre-assigns disjoint path sections and resolves regen conflict at merge |
| FE surface | same `apps/web` component/route tree (AppRouter/nav/Layout are M-02-owned seams) | serialize the FE-touching pair |
| Migration | both add a migration | hub pre-allocates disjoint number blocks in the chip prompts; unplanned need = `REQUEST migration-number`, never grab blind |
| DB shape | both alter same table / module registration | one exclusive owner; other `REQUEST`s |
| Module | both mutate same Go module internals | serialize; cross-module edges via published interfaces are safe |

**MIS-003 DAG (from mission.md):** M-01 first (serial). Then **M-02 ∥ M-03** (contract lock:
M-03 owns `/mutations` OpenAPI sections; M-02 server-side OpenAPI edits are none — proxy/FE only;
regen conflicts hub-resolved at merge). M-04 after M-02+M-03. M-05 after M-04 (AppRouter/nav
seam). M-06 after M-03 + M-04 F-01; **M-05 ∥ M-06** allowed if OpenAPI sections pre-assigned
(M-05: /dashboard,/orders,/sync; M-06: category-attributes,/market) and no shared file edits.

**Merge protocol:** every track branches off the same current master; merge-back serialized
through the ONE hub acceptance gate, smallest/lowest-risk first; post-merge ladder runs on the
INTEGRATED master (green branch that reddens master = REJECT); still-in-flight tracks sharing
moved infra rebase on new master when the hub says so.

**Shared test DB:** integration runs across tracks with divergent migrations get SERIALIZED by
the hub (MetalDocs 3D000/template-collision finding); same-fingerprint runs are safe concurrent.

## 4. Implementation standards — anti-slop contract

Milestone-session obligations, checkable:

1. Planning is a **P2 BATCH up-front phase**: ONE Sol-medium planner pass per milestone emits
   slice cards for ALL of the milestone's features + the shared module seam, BEFORE any
   implementation — never one-at-a-time at implement time. Dispatch via
   `/codex:rescue --model gpt-5.6-sol --effort medium --wait`. Batch-of-planning ≠
   batch-of-implementation: implementation still respects one-writer-per-seam (serial within the
   same module). Plan quality is the speed lever; skipping planning to "go fast" is a violation.
2. Code slices implemented by dispatched codex workers (Luna high standard / Sol low complex).
   Opus writes inline ONLY trivial glue (≤ ~10 lines, no new behavior).
3. Every slice reviewed by an **independent Claude reviewer** before the next slice. Implementer
   ≠ reviewer, non-negotiable.
4. **Dual gate at CLOSED:** full Opus review + independent GPT-5.6 Sol medium review (git
   read-only: diff/show/log — never checkout/apply/stash) on the fixed-SHA milestone diff.
   `CLOSED` only after BOTH clear; disagreement = both verdicts + reconciliation in the event.
5. Bulk reads/inventory → Luna-medium codex investigator (or haiku cavecrew for trivial greps)
   returning compressed report; the Opus session never tree-crawls.
6. Mechanical work → haiku.
7. Evidence lists dispatches per slice: planner, implementer, reviewer(s), verdicts. Zero
   dispatches listed = fails hub acceptance.
8. Native task board live at all times: in_progress at dispatch, completed only reviewed-green.

**AI-slop checklist — any hit = REJECT the slice:** speculative abstraction / one-impl
interfaces with no named consumer · comment narration / PR-voice comments · blanket
recover/try-catch, fallbacks on integrity-critical reads (unknown ≠ zero — ADR-17, fail honest) ·
idiom mismatch with the surrounding module · dead code / commented blocks / unanchored TODOs ·
hand-rolled platform equivalents · generated-file edits (contract-first or nothing) · test
theater (asserting the mock; missing negative/cross-tenant case).

**Reviews verify, never generate scope.** New scope wanted = finding for the hub queue.

## 5. Verification ladder — every level from clean state

| Level | What | Gate |
|---|---|---|
| L0 | `go build ./...` (`GOCACHE=.gocache`) · web `tsc`/typecheck · governance lanes (module boundaries, contracts) | zero findings |
| L1 | `GOCACHE=.gocache go test ./...` (touched packages + guard suites; full sweep only when migrations/platform touched) · web vitest | green; flaky = fix or delete |
| L2 | dev stack up (server_core :8080 + apps/web :5174 via repo scripts, PowerShell never bash) · smoke: target routes, error shapes, OpenAPI ↔ SDK ↔ handler parity | green, evidence captured |
| L3 | browser QA persona on the milestone VC Drive blocks | GREEN verdict artifact |
| L4 | MNFS milestone gate `/milestone-validate <milestone-path> --apply` (cold `milestone-reviewer` crew + QA live-drive vs `validation-contract.md`; only QA passes a milestone) | PASS written to `<milestone-root>/validation-result.md` |

**Fresh-worktree bootstrap (ratified 2026-07-15, M-01 field finding):** the registered
integration lane runs Go hermetically (`GOPROXY=off`, `GOSUMDB=off`,
`GOMODCACHE=apps/server_core/.gomodcache`) — a fresh worktree has an empty `.gomodcache`, so
`go run ./cmd/testdb migrate` fails at BUILD (module lookup disabled) and the lane reports
`HPG_MIGRATION_FAILED` with `migrations_first=-1` (false alarm, not a SQL/migration defect).
Standard first act in every new chip worktree before any hermetic lane:
`cd apps/server_core && GOMODCACHE=$(pwd)/.gomodcache go mod download all` (~130M, env prep —
NOT a dep change, no REQUEST needed). `migrations_first=-1` means "build died before migrate
ran"; warm the cache before diagnosing SQL.

**Backend non-negotiables re-checked at L0–L2 per touched endpoint:** tenant_id predicate on
every query · provider payloads at adapters only · unknown never zero/default (ADR-17) ·
OpenAPI + sdk-runtime same commit · provider writes: resolved linkage, explicit policy/source
time, duplicate protection, audit (IC-03 gates) · mocks never prove live integration.

## 6. Repo invariants (survive any harness)

Truth order: `ARCHITECTURE.md`/ADRs > OpenAPI+SDK > `contracts/governance/` > wiki > `.mnfs/` >
tests/builds/commits — stop and classify conflicts. Domain/application/ports/adapters/transport
boundaries. One writer per shared seam. Never: reset, revert, stash, clean, delete unknown state,
WSL, expose secrets/PII, cold-clone, purge caches, dep-install as ritual (dep change = `REQUEST`).
Never push without explicit operator permission; commit after verified work is standing
authorization. Never read/print/commit `.env*` contents. Live ML writes require explicit operator
authorization per mission Validation Strategy.

## 7. Failure protocol

RED at any ladder level → root-cause fix (systematic-debugging) → re-run FULL ladder from L0.
Slice fails review 2× → redesign the slice, not a third patch. Invariant/ADR contradiction →
STOP, `BLOCKED`, operator decides. Budget ceiling → stop, flush state to evidence + task board,
`BLOCKED` with split proposal. Never: skip hooks, force-push, fake evidence, "fix while here"
scope widening (→ `ESCALATION`).

## 8. Context & handoff discipline

Fresh Opus chip per milestone; fresh QA persona per QA. Handoff state lives ONLY in: `.mnfs`
milestone/feature artifacts, evidence files, task board, memory index — unwritten = didn't
happen. Commit per green slice = crash-recovery contract. Sessions open only their listed
context files; bulk reads via investigator. Hub self-compacts at ~200k tokens after flushing
durable state.

**Operator visibility (recommended, not obligatory — ratified 2026-07-15):** a session running
multiple OS-process workers may serve a local live dashboard (pattern: scratchpad
`live-server.mjs`, bound to 127.0.0.1 only, SSE-tailing the per-worker teed logs with
live/idle/done state). Scratchpad-local, per-session, never committed, never exposed beyond
localhost. Compensates for the native task panel showing backgrounded wrappers as idle.
