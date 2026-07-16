# Hub-and-Chips Development Harness — Core Doctrine

**Layer:** METHOD (generic — no product, repo, or mission names belong in this file).
**Binding rule:** execution in a product repo is governed by THREE layers read together:

1. **Core** (this file, shipped by the `harness` plugin) — roles, loop, events, gates, protocol.
2. **Profile** (`docs/HARNESS-PROFILE.md` in the product repo) — repo bindings: exact commands,
   seams, collision-axis instantiation, non-negotiables, human gates. Owned by the repo, evolves
   by ratification (§0).
3. **Mission** (`.mnfs/MIS-*/` artifacts) — the current queue, DAG, ownership matrices.
   Mission-lifetime content NEVER lives in core or profile.

Conflict order: profile wins over core for in-flight missions; core updates land at mission or
milestone boundaries. A missing profile section is `open`, not license to improvise — the hub
ratifies it before depending on it.

## 0. Profile contract & amendment protocol

The profile is a LIVING document. It is expected to start thin (see `PROFILE-TEMPLATE.md` —
a schema, not a form) and grow from field findings, exactly like mission evidence.

- Every profile section carries `status: ratified | assumed | open` and provenance
  (date + finding source). `assumed` = scout/interview inference not yet proven in the field.
- **Amendment protocol:** field finding (a chip's false alarm, a flake, a tooling gotcha, a new
  seam) → finding reported via event (§2) → hub classifies:
  - **method-level** (would bite any repo) → core change → plugin update (upstream PR/commit);
  - **repo-level** → profile amendment, ratified with date, appended to the profile's
    `## Amendment log`.
- First boot in a virgin repo: run the `harness-init` skill — scouts + operator interview draft
  the minimum viable profile (`assumed`-marked). The harness may not run ladder levels whose
  profile bindings are `open`.

## 1. Model matrix — who does what

| Role | Model / path | Does | Never does |
|---|---|---|---|
| **Hub** | Standing dispatch session (boots via `harness-hub` skill) | Builds per-milestone context pack → spawn_task chip → collision matrix across parallel tracks → answers events → acceptance dual review → merge → post-merge ladder → deploy/correct → advance | Writing large diffs itself; reviewing its own dispatched work; letting chips touch shared infra |
| **Milestone session** | **Opus** (operator launches chip, worktree isolation) | Orchestrates ONE milestone end-to-end: native task board first act, feature order, dispatches all workers below, integrates features, emits events | Scope beyond its milestone; pushing; merging to the default branch; shared infra; flipping mission status |
| **Feature planner** | **GPT-5.6 Sol, medium reasoning** via `/codex:rescue` | One thorough plan per feature BEFORE implementation — contracts, negative paths, seams, invariants, edge cases up front | Implementing |
| **Implement worker (standard)** | **GPT-5.6 Luna, high reasoning** via `/codex:rescue` | Standard/easy TDD slices per the written plan | Slices flagged complex |
| **Implement worker (complex)** | **GPT-5.6 Sol, low reasoning** via `/codex:rescue` | Complex slices (state machines, pollers, envelope gates, tricky SQL) | — |
| **Implement worker (fallback)** | **Claude sonnet subagent** | Sanctioned fallback implementer when codex is unavailable (broken sandbox, quota) or the operator directs — same plan, TDD, slice-review, and ledger rules apply unchanged; not a logged deviation (ratified 2026-07-16; field-proven M-01 slices 8-12, gate-passing) | Being the default while codex works |
| **Investigator / bulk reads** | **GPT-5.6 Luna, medium reasoning** via codex subagent (default); haiku investigator allowed for trivial repo greps | Find files, read/summarize, return compressed report — offloads Opus context AND Claude quota | Suggesting fixes beyond the report |
| **Per-slice reviewer** | Independent Claude reviewer subagent (sonnet) | Reviews each slice before the next starts; implementer ≠ reviewer, always | Generating new scope |
| **Final dual gate** | **COLD Opus subagent review (clean context, explicit `model=opus`) + GPT-5.6 Sol medium review** (both independent, same fixed SHA; NEVER the orchestrating session — self-grade bias) | Milestone-end diff review per §4 obligation 4 (canonical statement) | — |
| **Mission co-planner** | **GPT-5.6 Sol, medium** via `/codex:rescue` | Planning P3: BLIND counter-proposal from frozen P0–P2 evidence — never sees Claude's candidate | Seeing Claude's draft; writing artifacts |
| **Mission decomposition auditor** | **GPT-5.6 Sol, medium** via `/codex:rescue` | Planning P5: audits DAG edges, six-axis disjointness, contract propagation, brief density | New scope; implementation planning |
| **Mission readiness gate** | **GPT-5.6 Sol, HIGH** via `/codex:rescue` | Planning P7: full-tree ★1–★7 rubric review AFTER the Claude cold crew is Ready; `planned` only when BOTH clear | Sampled pass; editing artifacts |
| **QA persona** | Fresh session/agent, zero inherited context, browser tools | Milestone-close validation as a USER (mission VC Drive blocks); curl-only = FAIL | Reading implementation diffs first; fixing |
| **Mechanical** | Haiku subagent | Renames, comment sweeps, format-only | Judgment work |

Concurrency: bounded by operator attention (chips) + ≤15 workers per session. The top-tier
frontier model (e.g. Fable) is never a worker.

**Codex dispatch paths (ruling 2026-07-16, M-01 escalation):** two legal paths, chosen by
expected duration. Role → exact flags/path: use the `codex-dispatch` skill — never retype the
matrix from memory, and NEVER omit effort (global codex default is `xhigh`: silently
slower/costlier).
- **Long dispatches — expected >~2 min (feature planner, implement worker, gate review: any
  run where a hang is indistinguishable from work) → OS-process codex per §3.** Stdin closed,
  prompt read from a file (never a long inline arg), stdout teed to a scratchpad
  `agent__<id>.log`, `-o <scratchpad>/agent__<id>.last.md` (the CLI writes the final message
  verbatim to disk — ceremony field-verified 2026-07-16), `.done` sentinel on exit. These
  files ARE the §8 dashboard feed and the ledger's `Log`/output columns; a long dispatch with
  no teed log cannot be told apart from a hang (M-01: 679s gate reviews ran fully blind).
- **Short dispatches (probes, quick investigations, anything needing companion resume
  threading) → `/codex:rescue --model <m> --effort <e> --wait`.** The companion returns
  stdout to the calling session's CONTEXT ONLY — it writes NO ledger-addressable artifact
  (the prior "stdout-verbatim capture for the dispatch ledger" rationale was false;
  field-verified M-01, withdrawn). Users of this path write the ledger row AT DISPATCH TIME
  and paste verbatim output into an evidence file the row points at. Multi-line prompts on
  this path go via `--prompt-file`, never inline `--task` — inline hits shell command-length
  limits and MANGLES QUOTING SILENTLY (field-verified M-01: a truncated reviewer prompt still
  emits a confident verdict).

**Ledger rule — Claude-side workers (Agent-tool subagents: per-slice reviewers, cold Opus
gate, mechanical):** no OS log exists, so the ledger row is written AT DISPATCH TIME, before
reading the result — role, model, effort, prompt-pack file path — then completed with the
verdict/output artifact path. Prompt-packs and verdicts are files on disk; rows anchor to
artifacts, never to session prose. Any worker with no row = acceptance defect (M-01 lost its
7 most consequential dispatches to exactly this gap). **Accepted limitation (ruled
2026-07-16):** Agent-tool dispatches produce no OS log and therefore no live dashboard feed —
M-01's gate reviews ran 281-679s unwatched and that is the tool's shape, not a process gap to
re-litigate. Mitigation IS the rule above: bounded inputs, SYNC dispatch, ledger row at
dispatch time. Do not build per-run scaffolding to compensate.

**Codex precondition:** before the first codex-dependent dispatch, hub verifies `codex exec`
works on this machine (field finding 2026-07-14: Windows sandbox can be broken machine-wide —
`orchestrator_helper_launch_failed`; fix = operator runs interactive `/codex:setup`). Until
fixed: milestone sessions do NOT attempt codex; hub runs GPT passes via stdin evidence-pack
(`codex exec --sandbox read-only -` with full diff + post-state of key files).

**Codex stdin gotcha (field-verified 2026-07-15, codex-cli 0.144.4):** in a non-tty shell,
`codex exec "<prompt>"` prints `Reading additional input from stdin...` and BLOCKS FOREVER
waiting for stdin to close. Every raw codex call MUST close stdin explicitly — PowerShell:
`@() | codex exec ...` · bash: `codex exec ... < /dev/null`. A codex call silent for ~2 min is
this hang, not a slow model — kill and re-issue. Shell pipelines that buffer (`Select-Object`,
`Out-String`) hide interim output; tee per-line to a log file when progress matters.

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
P5 VERIFY    ladder L0→L2 (§5, commands per profile) from clean state, run by the milestone session
P6 DUAL GATE per §4 obligation 4 (canonical): Opus + Sol medium on the fixed-SHA diff
P7 QA        milestone-close QA: LIVE-DRIVE by a fresh persona vs validation-contract.md
             (user-level, browser where a UI exists; curl-only = FAIL); verdict artifact at
             <milestone-root>/validation-result.md (only QA passes a milestone). The
             /milestone-validate cold ★ crew is SUPERSEDED at milestone close by the P6
             dual gate — do not stack both (operator-ratified 2026-07-16; field: M-01
             round-1 five-member crew found zero defects, the live drive found the real
             adapter gap + 4 more). Fail → `/correction-create` scopes; the chip dispatches
             its corrective worker; full re-gate, never-downgrade across rounds
P8 CLOSE     evidence per feature at F-*/validation.md; dispatch ledger; CLOSED event to hub
  ↓
HUB          acceptance (verifies dual-gate + QA evidence) → merge --no-ff to default branch →
             post-merge ladder on integrated default branch → deploy/rebuild dev stack →
             worktree remove + branch -d → update .mnfs milestone status → next chip(s);
             all milestones CLOSED → /mission-validate then /mission-closeout (hub runs both)
```

**Role binding (single execution engine):** MNFS artifacts name contract roles — Milestone
Orchestrator = the chip, Feature Implementer = the dispatched implementation worker, Correction
Worker = the dispatched corrective worker (`mnfs-plugin/docs/shared-standards.md` § Role
Binding). The harness is the only execution engine; gate/verdict agents (`milestone-reviewer`,
`qa-validator`, `mission-reviewer`) remain plugin-owned, invoked via `/milestone-validate` /
`/mission-validate`.

Milestone chips return to the hub ONLY via events (gates/terminal) — not turn-by-turn narration.

**Event grammar** (one event per message, header first, terse payload; sent over
`mcp__ccd_session_mgmt__send_message` to `HUB_SESSION_ID` — per-send operator click is a known
client limitation, so messages few and batched):

| Event | When | Payload |
|---|---|---|
| `CLOSED` | milestone done, commits in place | milestone id · branch + commit range · ladder results · dual-gate verdicts + reconciliation · QA verdict · defers |
| `BLOCKED` | stop-rule hit (architecture/contract contradiction, broken prerequisite, budget) | what, evidence, smallest unblock ask — sent IMMEDIATELY |
| `ESCALATION` | out-of-scope defect found | classification + repro pointer; in-scope work continues |
| `REQUEST` | needs shared resource (dev stack restart, DB reseed, dep install, contract lock) | what + why; hub owns shared infra and shared seams |
| `SPLIT-REQUEST` | remaining features/slices mutually independent; split buys wall-clock | proposed groups + disjoint file/module ownership |
| `COMMITTED` | mid-milestone landmark the hub may need to act on (slice/SHA landed on the chip branch) | commit SHA · what landed · standing-policy triggers (e.g. stack-sync per profile) — non-blocking, no reply owed (ratified 2026-07-16; M-01 used it 2× unnamed) |
| `ACK` | hub sent mid-flight correction | one line |

**Chip prompt MUST carry, verbatim-strength:** (a) §4 obligations numbered; (b) "read the core
doctrine §4–§5 AND the repo profile before implementing"; (c) evidence dispatch-ledger
requirement (closures listing zero planner/implementer/reviewer dispatches fail hub acceptance);
(d) task-board obligation; (e) comms contract (`HUB_SESSION_ID` + title-match fallback); (f) the
milestone's mission paths (`.mnfs/<mission>/<milestone>/milestone.md`, its
`validation-contract.md`, feature briefs, owning ICs) and accepted base SHA; (g) its
collision-matrix ownership (exclusive files, contract-lock status, migration block); (h) skill
pin: name the binding doctrine files (core + profile paths) and the profile's superseded-protocol
denylist — propagated verbatim into every nested worker dispatch (field finding: worker
skill-discovery auto-resolved to a stale skill — never rely on on-disk skill discovery in
worktrees; the pin travels verbatim in every dispatch prompt).

**Remediation is a message, not a new chip:** ACCEPT-WITH-CONDITIONS / REJECT findings go back to
the same milestone session; new corrective dispatch only on 2× reject.

## 3. Parallel-track execution (quality AND speed)

Order governed by the real dependency DAG, never row number. **The true parallelism axis is
hub-dispatched sibling milestone/feature tracks** — one worktree/branch/chip each.

**Nested-child misrouting (proven 2026-07-13; sharpened 2026-07-15):** a BACKGROUND
**Agent/Task-tool** nested child of a chip completes to the HUB's loop, never to its parent —
parent deadlocks. The artifact is Agent/Task routing, NOT parallelism itself. Rules:
- Agent/Task-tool nested children: SYNC only (`run_in_background: false`).
- **OS-process codex dispatch** (background shell: stdin closed, prompt from file, output
  teed to a scratchpad log, `-o` last-message file, `.done` sentinel) completes to the
  DISPATCHING session's own loop (field-verified 2026-07-15) — allowed intra-milestone,
  including backgrounded, and MANDATED for long dispatches per §1; subject to: one writer per
  seam still holds; every worker in the dispatch ledger; slice review before any dependent
  slice starts.
A milestone whose internal parallelism needs a second WRITER on a shared seam still emits
`SPLIT-REQUEST`; the hub adjudicates against the collision matrix and forks a sibling worktree
if clean.

**Collision matrix — two tracks run concurrently ONLY when disjoint on ALL six axes.**
The axes are method-level; their INSTANTIATION (which files, which contract spec, which seams)
is profile-owned. Source of truth for per-mission ownership: the mission's
`## Parallel Execution Plan` (mission.md) + each milestone's `## Ownership & Concurrency` block
(authored at planning P5); the hub verifies at dispatch time instead of deriving from scratch.
Missions planned before these blocks existed: the hub derives the matrix itself and persists the
block at chip-authoring time (lazy retrofit).

| Axis | Collision test | If collide |
|---|---|---|
| Files | same source file edited by both | serialize or split ownership |
| Contract artifacts | both edit the API contract spec / generated SDK (paths per profile) | contract lock: one owner at a time, or hub pre-assigns disjoint sections and resolves regen conflict at merge |
| FE surface | same frontend component/route tree (owned seams per profile) | serialize the FE-touching pair |
| Migration | both add a schema migration | hub pre-allocates disjoint number blocks in the chip prompts; unplanned need = `REQUEST migration-number`, never grab blind |
| DB shape | both alter same table / module registration | one exclusive owner; other `REQUEST`s |
| Module | both mutate same code module internals | serialize; cross-module edges via published interfaces are safe |

**Additive contract-lock (named mechanism — proven 3× in the field, ratified 2026-07-16):**
when a track needs a small addition to a module/port/registration surface another owner holds,
the hub may grant a TEMPORARY ADDITIVE-ONLY lock instead of serializing the tracks: additions
only (new method, new contract section, new registration line — never edits to existing
lines), scoped to named files/sections, time-boxed to the milestone, released at CLOSED, and
the resulting diff called out explicitly in the CLOSED payload. Planning (P2 slice cards, P5
ownership blocks) pre-identifies these locks as OUTPUTS; discovering one mid-flight is a
planning gap worth a retro line, not a normal event.

**Merge protocol:** every track branches off the same current default branch; merge-back
serialized through the ONE hub acceptance gate, smallest/lowest-risk first; post-merge ladder
runs on the INTEGRATED default branch (green branch that reddens it = REJECT); still-in-flight
tracks sharing moved infra rebase when the hub says so.

**Shared test DB:** integration runs across tracks with divergent migrations get SERIALIZED by
the hub (3D000/template-collision field finding); same-fingerprint runs are safe concurrent.
The profile documents the repo's test-database strategy (per-run vs session reuse).

## 4. Implementation standards — anti-slop contract

Milestone-session obligations, checkable:

1. Planning is a **P2 BATCH up-front phase**: ONE Sol-medium planner pass per milestone emits
   slice cards for ALL of the milestone's features + the shared module seam, BEFORE any
   implementation — never one-at-a-time at implement time. Batch-of-planning ≠
   batch-of-implementation: implementation still respects one-writer-per-seam. Plan quality is
   the speed lever; skipping planning to "go fast" is a violation. **Required plan OUTPUTS
   (ratified 2026-07-16):** slice cards + a per-feature WRITE-SET (files/dirs each slice
   touches — the write-DAG) + a CONTRACT-SATISFIABILITY check (every claimed contract
   path/section diffed against the CURRENT contract state and sibling-track claims; a
   colliding or already-occupied path is a planning defect, not an implementation discovery)
   + pre-identified additive contract-locks (§3). M-01 field: 2 wasted dispatches + 2
   escalations were plan-time-detectable contract conflicts.
2. Code slices implemented by dispatched codex workers (Luna high standard / Sol low complex).
   The orchestrating session writes inline ONLY trivial glue (≤ ~10 lines, no new behavior).
3. Every slice reviewed by an **independent Claude reviewer** before it is merged and before
   any DEPENDENT slice starts; a disjoint next slice may be implemented while the review runs
   (REVIEW-STANDARD §15 overlap rule). Implementer ≠ reviewer, non-negotiable.
4. **Dual gate at CLOSED:** full Opus review + independent GPT-5.6 Sol medium review (git
   read-only: diff/show/log — never checkout/apply/stash) on the fixed-SHA milestone diff.
   `CLOSED` only after BOTH clear; disagreement = both verdicts + reconciliation in the event.
5. Bulk reads/inventory → Luna-medium codex investigator (or haiku for trivial greps) returning
   compressed report; the orchestrating session never tree-crawls.
6. Mechanical work → haiku.
7. Evidence lists dispatches per slice: planner, implementer, reviewer(s), verdicts. Zero
   dispatches listed = fails hub acceptance.
8. Native task board live at all times: in_progress at dispatch, completed only reviewed-green.

**Every code review (slice, dual gate, hub spot-check) follows `REVIEW-STANDARD.md` — BINDING:**
fixed review order (design → correctness → complexity → tests → naming → docs; style is
machine-owned), explicit global-vs-local-maximum design questions (G1-G3, alternatives-considered
notes on non-trivial decisions), Beck simplicity rules (YAGNI + DRY rule-of-three), two-axis
severity on every finding (`blocking|important|suggestion|nit|question` + anchored `path:line`),
anchor-or-abstain with receipts, deterministic pre-pass before judgment, dual-gate agreement
merge, delta-only re-review, learnings memory, ≤~300-line slices. Execution model per
REVIEW-STANDARD §13-§16: prompt-pack dispatch (one reviewer per slice, never a crew; dual gate
dispatched simultaneously), disjoint-slice overlap cadence, artifact-gate (★ crew) noise
control (FAIL-restraint, advisory cap, learnings suppression).

**AI-slop checklist — any hit = REJECT the slice:** speculative abstraction / one-impl
interfaces with no named consumer · comment narration / PR-voice comments · blanket
recover/try-catch, fallbacks on integrity-critical reads (unknown ≠ zero — fail honest; the
profile may bind this to a named ADR) · idiom mismatch with the surrounding module · dead code /
commented blocks / unanchored TODOs · hand-rolled platform equivalents · generated-file edits
(contract-first or nothing) · test theater (asserting the mock; missing negative/cross-tenant
case where the profile defines tenancy) · permanent stub/nil dependency wired into a composition
root live path (a stub on a live path is legal ONLY with a dated deferral naming the slice that
wires the real dependency, or explicit operator authorization — otherwise it is a defect, not a
placeholder) · duplication of an existing helper/pattern past the rule of three (reviewer cites
the existing symbol `path:line`; third occurrence must refactor to shared).

**Reviews verify, never generate scope.** New scope wanted = finding for the hub queue.

## 5. Verification ladder — every level from clean state

Level SEMANTICS are core; exact commands, ports, and evidence paths are profile bindings.

| Level | What (semantics) | Gate |
|---|---|---|
| L0 | full build + typecheck + governance/boundary lanes (commands per profile) | zero findings |
| L1 | test suites — touched packages + guard suites; full sweep only when migrations/platform touched (commands per profile) | green; flaky = fix or delete |
| L2 | dev stack up (per profile) · smoke: target routes, error shapes, contract ↔ SDK ↔ handler parity | green, evidence captured |
| L3 | browser QA persona on the milestone VC Drive blocks | GREEN verdict artifact |
| L4 | Milestone-close QA live-drive vs `validation-contract.md` (fresh persona; the ★ crew half of `/milestone-validate` is superseded at close by the P6 dual gate — operator-ratified 2026-07-16; only QA passes a milestone) | PASS written to `<milestone-root>/validation-result.md` |

**Integration honesty (operator-ratified 2026-07-15):** validation contracts and tests NEVER
fall back to stub/mock/fake for an integration seam unless the operator explicitly authorizes
the substitution. Mocks/fakes prove contract SHAPE only; any criterion that claims integration
works must be driven against the REAL dependency (live or operator-provisioned env). Mission
planning must declare real-integration bindings up front — which seams need live proof, what env
they need — so implementation wires real from the start instead of shipping stubs that force
delaying refactors later. A planned stub is only valid with a dated deferral naming the slice
that replaces it.

The profile MUST additionally document (as they get ratified): fresh-workspace bootstrap steps
(hermetic caches, module warms), the integration test-database strategy (isolation guarantees +
session-reuse mechanics if any), and any known first-boot races with their absorb/retry rules —
these are exactly the findings that produce false-alarm failures in fresh chip worktrees.

**Per-endpoint non-negotiables re-checked at L0–L2:** defined in the profile (tenancy
predicates, adapter boundaries, contract/SDK atomicity, write-path gates). Core rule: mocks
never prove live integration.

## 6. Repo invariants (survive any harness)

Generic never-list: never reset, revert, stash, clean, delete unknown state, expose
secrets/PII, cold-clone, purge caches, or dep-install as ritual (dep change = `REQUEST`).
Never push without explicit operator permission; commit after verified work is standing
authorization. Never read/print/commit `.env*` contents.

Profile-bound invariants (the profile defines): the repo's truth order (which artifacts win a
conflict — stop and classify conflicts against it), architecture layer boundaries, shell/OS
binding, and human-gated write surfaces (e.g. live external-system writes require explicit
operator authorization per mission Validation Strategy).

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

**Operator visibility (recommended, not obligatory):** a session running multiple OS-process
workers may serve a local live dashboard (pattern: scratchpad `live-server.mjs`, bound to
127.0.0.1 only, SSE-tailing the per-worker teed logs with live/idle/done state).
Scratchpad-local, per-session, never committed, never exposed beyond localhost.
