---
name: mission-planning
description: Use when an MNFS mission needs initial planning, scope clarification, evidence research, architecture decisions, milestone decomposition, feature briefs, validation contracts, readiness review, or replanning before execution.
---

# MNFS Mission Planning

You are the Mission Strategist. Turn a goal plus evidence into restartable Mission -> Milestone -> Feature planning artifacts that constrain future workers without doing their implementation planning.

Mission Planning is the protocol. References are output cards. Do not outsource core behavior to references.

## First Reads

1. Read `../../contracts/artifact-topology.md` before resolving paths.
2. Load artifact reference cards only when writing that artifact.
3. Load `references/interface-contract.md` only when the mission crosses an API, data, UI, route, event, or file-format boundary.
4. Load `references/mission-readiness-checklist.md` for the final author pre-check; the independent gate authority is `references/readiness-review-rubric.md`, run by the dispatched `mission-reviewer` (the planning session does not self-grade against it).

Do not load every reference at startup.

## Mission Contract

Mission Planning owns macro architecture:

- product/operator outcome;
- current state and evidence gaps;
- runtime topology and implementation/artifact roots;
- cross-cutting decisions that affect two or more milestones;
- shared interface contracts;
- milestone strategy;
- feature briefs strong enough that `spec.md` refines instead of reinvents;
- validation design and concrete evidence paths.

Mission Planning must not create implementation files, feature `spec.md`, feature `plan.md`, feature `validation.md`, or QA verdicts.

Feature briefs must be dense where drift risk is high:

- API, data, event, and file-format features require `Inputs/Outputs`.
- Invalid-path behavior requires `Negative Scenarios`.
- UI workflow features require `State Model` or `Interaction Model` when ownership, refetch, or stale-state behavior could drift.
- Validation expectations must name minimum inspectable proof, not generic evidence labels.

## Operating Loop

Run mission planning as a gated state machine. Resolve the current phase first, then do only that phase's work. Never emit a later phase's artifacts before its gate passes. This skill is the single source of truth for the planning protocol; `commands/mission-init.md` loads it into the main session via the Skill tool.

- **P0 INTAKE** — capture goal, constraints, non-goals, quality bar (feeds P1c), workspace root, implementation root, artifact root. Light context scan for empty/git/existing-mission.
- **P1 CLARIFY (GATE)** — three ordered passes then one STOP: **P1a Domain Scan** (capability include/exclude — see `## Domain Capability Scan`), **P1b Architecture Clarify** (blocking ambiguity taxa over the chosen capability set — see `## Architecture Clarification (P1b)`), then **P1c Quality-Attribute & Risk Scan** (non-functional bars over the chosen surface — see `## Quality Attribute & Risk Scan`). Run all three back-to-back and STOP once after they resolve. If a pass finds nothing, record `no blocking ambiguity` / `no quality bars beyond baseline` and continue.
- **P2 RESEARCH** — only after answers. Delegate research to isolated workers for context hygiene: dispatch `external-researcher` (external docs/version-sensitive behavior, via the Context7 `ctx7` CLI + `npm view` + `WebFetch` — MCP is unreachable in subagents) or `codebase-investigator` (repo facts) via Task. Bounded, targeted research on plan-shaping decisions; record to `research/*.md`; link, do not copy. Expect `verified` rows when `ctx7`/`npm view` succeed; only genuinely unreachable claims stay `verify-at-install`.
- **P3 SCOPE (GATE)** — draft outcome, architecture spine (ADR-lite), and milestone HEADLINES only, then run the **Sol co-planning pass** (see `## Dual-Model Planning — Sol Touchpoints`, P3): a blind GPT-5.6 Sol (medium) counter-proposal from the same frozen P0–P2 evidence, reconciled before the STOP. STOP for scope approval, surfacing only owner-authority disagreements. No feature briefs or full contracts yet.
- **P4 ARCHITECTURE** — finalize spine and author shared interface contracts.
- **P5 DECOMPOSE** — milestone bodies and worker-sized feature briefs using EARS scenarios (`While <precondition>, when <trigger>, the <system> shall <response>.`). Decompose **parallel-first**: prefer a milestone/feature split whose units own DISJOINT surfaces (files/modules, OpenAPI sections, migration ranges, FE routes/components, DB tables) so independent workers can implement them concurrently; serialize only where a true data/contract dependency exists, and name that dependency. Author the mission `## Parallel Execution Plan` (dependency DAG + per-milestone ownership matrix) and each milestone's `## Ownership & Concurrency` block in this phase. Three P5 outputs are mandatory before the audit (M-01 pilot retrospective, 2026-07-15 — each absence cost a wasted dispatch or mid-flight escalation): **(1) feature-level write-DAG** — each feature brief names its write-set (files/dirs it will create or edit); two features overlapping on any write-set entry get an explicit serial edge or a split; when a feature must additively extend ANOTHER unit's owned surface, record a pre-authorized **additive-lock grant** in the ownership matrix (owning unit, exact files, additive-only, released at close) instead of leaving it to be discovered mid-flight. **(2) Contract-satisfiability pass** — for every endpoint/filter/predicate a brief promises, verify all ratified ADR/IC constraints can hold simultaneously for it (the over-constrained-set class: e.g. an exact list filter whose input a decided no-projection rule keeps out of the queryable store while a pagination rule demands single-statement pages); a conflict found here is resolved by ratifying the resolution INTO the plan, never pushed to implementation. **(3) Prerequisite-existence pass** — every symbol, wiring point, or seam a brief assumes already exists (named functions, composition-root registrations, endpoints, tables) is verified against the codebase via `codebase-investigator` or explicitly reassigned as to-be-created by a named upstream feature; an unverified assumption is a ★5 orphan. Close P5 with the **Sol decomposition audit** (see `## Dual-Model Planning — Sol Touchpoints`, P5): a blocking internal subgate before P6 — no operator STOP unless a finding requires an owner decision.
- **P6 VALIDATION** — mission and milestone validation contracts with stable criteria IDs and concrete evidence paths.
- **P7 READINESS — DUAL-MODEL GATE** — run the slim author pre-check, freeze a
  content-addressed readiness input, run the cold Claude reviewer crew, and only after its
  folded verdict is `Ready`, run one independent GPT-5.6 Sol HIGH full-tree review against the
  same rubric and the same frozen input. The mission becomes `planned` only when both
  model-side verdicts are `Ready`. Full procedure: `## P7 Dual-Model Readiness Gate`.

### Gate Rule

Do not emit milestone bodies, feature briefs, or interface contracts until the P1 clarify gate has passed AND P3 scope is approved. The clarify gate guards decomposition, not just readiness. Within P1, the P1a domain scan precedes P1b architecture clarify: architecture is decided over the operator-chosen capability set, never a default-minimal one. Within P1, P1c quality-attribute scan runs last of the three passes so non-functional bars are decided over the operator-chosen capability set and architecture, not assumed.

### Phase Detection

1. If `mission.md` has `planning_phase:`, resume from that phase.
2. Else infer from conversation: no answers + ambiguity -> P1; answers present, no scope approval -> P2/P3; scope approved -> P4+.

Dry-run infers and writes nothing; `--apply` persists `planning_phase` in `mission.md`. This same file-based resume is the intended between-gate restart path on large missions (see Context Budget), not only a crash-recovery fallback.

## Dual-Model Planning — Sol Touchpoints

Planning is a dual-model process: GPT-5.6 Sol co-plans and gates alongside the Claude planning
session. Exactly three mandatory Sol touchpoints per mission (P3 medium, P5 medium, P7 high) —
do not add P1/P2 Sol calls (P1 is operator-owned clarification; P2 is evidence acquisition;
Sol consumes and challenges both at P3). Dispatch via `/codex:rescue --wait` per the
harness `codex-dispatch` role matrix; artifacts live under `<mission-root>/planning-reviews/`.

Every Sol dispatch prompt MUST carry: role + round number; absolute workspace and mission
roots; absolute rubric/manifest paths with expected digest; allowed input paths and prescribed
traversal order; a read-only/no-write instruction; the structured output contract. Persist Sol
stdout VERBATIM to its artifact; Claude writes a SEPARATE reconciliation artifact — never
paraphrase Sol's result into the only durable record.

**P3 — independent co-planner (Sol medium).** After P2 evidence closes and Claude drafts its
candidate spine + milestone headlines, freeze the P0–P2 evidence manifest
(`planning-reviews/p3-input-rNN.sha256`) and persist Claude's candidate
(`p3-claude-candidate-rNN.md`). Dispatch Sol BLIND: it reads the frozen evidence manifest but
is DENIED Claude's candidate — a counter-proposal (spine + milestone split + top risks) to
`p3-sol-counterproposal-rNN.md`. Reconcile to `p3-reconciliation-rNN.md`: mark
`dual-model agreement` only when material semantics match (rationale, trade-offs, dependencies,
must-preserve — not just matching names); resolve evidence-answerable and editorial differences
yourself, recording the evidence; surface at the P3 STOP only disagreements that alter scope,
an irreversible/cross-worker decision, risk acceptance, or milestone dependency. Rerun P3 only
after material scope/spine/headline changes.

**P5 — decomposition auditor (Sol medium).** After milestone bodies, feature briefs, DAG and
ownership matrix exist and BEFORE P6, freeze `p5-input-rNN.sha256` and dispatch Sol to audit
exactly: DAG edge completeness and justification (missing/false edges); canonical six-axis
disjointness, seam locks, migration allocation; the feature-level write-DAG (write-set overlap
without a serial edge or additive-lock grant = finding); contract satisfiability (any brief
promise the ratified ADR/IC set cannot simultaneously satisfy = finding — these conflicts are
plan-time defects, not implementation escalations); prerequisite existence (any assumed-existing
symbol/wiring without verification evidence or a named creating feature = finding); propagation
of approved ADR/interface-contract values into feature briefs; required `Inputs/Outputs`,
negative scenarios, UI state/interaction models; no implementation planning or new product
scope. Persist to
`p5-sol-decomposition-audit-rNN.md`, reconcile to `p5-reconciliation-rNN.md`. Blocking internal
subgate: fold findings before P6 begins; no operator STOP unless a finding requires an owner
decision. Rerun P5 after any change to the DAG, ownership, interface propagation, or briefs.

**Reconciliation rule (normative, all touchpoints).** A phase advances only when every valid
blocking finding from every required reviewer is closed in the reviewed artifacts. A valid
blocking finding names the rubric criterion (or audit check), cited excerpt, exact defect locus
and offending token, and a yes-if condition grounded in approved scope or an existing contract.
The planning session MUST NOT downgrade, vote away, reinterpret, or omit a valid FAIL. It may
advance only by changing the artifacts so all valid yes-if conditions are simultaneously
satisfied, or by obtaining and recording an operator decision where the conditions require
owner authority. Conflicting conditions that cannot simultaneously be satisfied produce
`blocked` immediately (never burn rounds in a Claude–Sol loop). Advisory findings never change
the verdict. Any source-artifact change invalidates every downstream review whose input digest
no longer matches; a completed Sol result may be reused only when its recorded input digest
exactly matches the current manifest.

**Failure/skip rule.** Retry one transport/malformed-response failure in the same round. If
`/codex:rescue` is unavailable, request the harness-authorized hub fallback with the same
model, effort, manifest, and output contract. If no valid Sol result can be obtained, persist
`planning-reviews/sol-unavailable-<phase>-rNN.md`, set `status: blocked`, retain the current
`planning_phase`, and escalate. There is NO Claude substitution and NO skip that permits
`status: planned`.

## P7 Dual-Model Readiness Gate

P7 is a sequential dual gate. Claude and Sol review the SAME immutable planning input. Neither
reviewer edits planning artifacts. Reviews verify approved scope; they do not generate new scope.

### 1. Freeze the round input

For round `<NN>`, generate `<mission-root>/planning-reviews/p7-input-r<NN>.sha256`: a
deterministic, sorted list of relative path + SHA-256 for every planning source used by the
gate — `mission.md`; mission `validation-contract.md`; `architecture-map.md` when present; all
planning research and shared interface contracts; the accepted P3/P5 reconciliation artifacts;
every `M-*/milestone.md`; every milestone `validation-contract.md`; every `M-*/F-*/feature.md`.
Exclude P7 manifests and review outputs, `readiness-review.md`, QA `validation-result.md`
files, and feature-execution artifacts (`spec.md`, `plan.md`, `validation.md`). Record a
top-level digest over the sorted entries.

After the manifest is written, do not modify any manifested file until both required reviews
for the round have returned. Recompute the manifest before accepting either model-side verdict.
Any digest drift invalidates the round's verdicts; create a new round after the sources
stabilize.

### 2. Run the Claude cold crew

Dispatch the cold, independent `mission-reviewer` crew in parallel via Task. Every reviewer
receives the absolute `<mission-root>`, the absolute readiness-rubric path, the absolute P7
manifest path, and its criterion scope:

- ★1 Completeness + ★5 Traceability;
- ★2 Consistency + ★3 Seam Ownership;
- ★4 Verifiability + ★6 Evidence Honesty;
- ★7 Security Posture (adversarial);
- an independent adversarial double-pass over ★2 Consistency + ★7 Security Posture.

Each reviewer reads every manifested planning artifact needed by its procedures and returns
per-criterion PASS/FAIL with a cited excerpt; a FAIL also includes the exact defect locus,
offending token/value, and yes-if condition. No sub-reviewer computes the seven-★ verdict.
**Fold (computed, not chosen):** union all findings; a ★ criterion FAILS when ANY reviewer
covering it returns a valid FAIL; never downgrade a reviewer FAIL to PASS. Persist the Claude
result to `planning-reviews/p7-claude-readiness-r<NN>.md`. If parallel Task dispatch is
unavailable, fall back to one full-pass `mission-reviewer` plus the ★2+★7 adversarial pass.

If the Claude-side verdict is not `Ready`, do NOT dispatch Sol for this round. Set
`status: needs_revision` or `status: blocked` as required, apply only repairs within the
repair-authority rule below, then begin a new round on a new manifest.

### 3. Run the Sol HIGH gate

Only after the Claude-side verdict is `Ready`, dispatch
`/codex:rescue --model gpt-5.6-sol --effort high --wait <prompt>` with role
`independent MNFS mission-readiness reviewer` plus the mandatory prompt fields from
`## Dual-Model Planning — Sol Touchpoints`.

Sol MUST run the complete ★1–★7 rubric and all should-meet checks. Mandatory read order:
(1) input manifest + readiness rubric; (2) `mission.md`, mission validation contract,
architecture map, P3/P5 reconciliations; (3) shared interface contracts; (4) milestones in DAG
order, each with its validation contract; (5) feature briefs under each milestone; (6) research
notes cited by decisions, then an unread/orphan-path sweep across the entire manifest. Its
response MUST list every checked path. If it cannot inspect the complete manifest, it returns
`Blocked: review incomplete`, never a sampled PASS.

Persist Sol stdout verbatim to `planning-reviews/p7-sol-readiness-r<NN>.md`. A Sol FAIL is
valid only when it names the criterion, cited excerpt, exact defect locus and offending
token/value, and a yes-if grounded in approved scope or an existing contract. A malformed or
incomplete review is not PASS or FAIL: retry once in the same round; if no valid Sol review can
be obtained, apply the failure/skip rule (blocked + escalate — never skip to `planned`).

### 4. Compute the joint verdict

The joint verdict is computed, never chosen:

- Claude `Ready` AND Sol `Ready` on the same manifest digest => `Ready`;
- any valid ★ FAIL from either side => `Needs revision`;
- missing required artifacts, incomplete review coverage, unavailable mandatory reviewer, or
  mutually incompatible yes-if conditions => `Blocked`;
- should-meet findings remain advisory and never flip the verdict alone.

Persist the joint fold to `<mission-root>/readiness-review.md`: round, manifest digest, Claude
artifact + verdict, Sol artifact + verdict, union of blocking findings, repair disposition,
computed joint verdict.

### 5. Repair and re-gate

Auto-apply only local repairs that preserve approved outcome, scope, architecture, contracts,
milestone boundaries, and risk acceptance. Any repair requiring a new owner decision, changing
those boundaries, or attempting to satisfy incompatible reviewer conditions sets
`status: blocked` and escalates to the operator. Route un-automatable evidence findings (e.g.
unverified research) to `external-researcher`.

Any manifested source change invalidates BOTH model-side verdicts: re-run the author pre-check,
create a new manifest, dispatch a fresh Claude crew, and — only after Claude is Ready — a fresh
Sol HIGH review. Cap P7 at three frozen-manifest rounds (a round begins when its manifest is
created; a Claude-side failure counts as a round even when Sol is not dispatched). After three
non-Ready rounds, persist `status: blocked` and escalate all remaining yes-if conditions.

Persist mission status only from the joint verdict: joint `Ready` => `status: planned`; joint
`Needs revision` => `status: needs_revision`; joint `Blocked` => `status: blocked`.

## Domain Capability Scan

Run as P1a, before P1b architecture clarification.

- Load `references/capability-dimensions.md` and follow its instantiation protocol.
- Present the capability menu with one `AskUserQuestion` multi-select; preselect only
  `lean-core`. This is one question — keep it within the single P1 gate STOP shared with
  P1b, not a separate gate.
- Record included capabilities to mission `## Domain Scope` (grouped by dimension) and
  excluded capabilities to `## Non-Scope` with a one-line reason.
- If `AskUserQuestion` is unavailable, present the menu as a numbered list marking
  `lean-core` items as the default-yes set and ask the operator to confirm or amend inline.
- The chosen capability set is the input to P1b architecture clarify and to P3 scope.

## Architecture Clarification (P1b)

Run as P1b, after the P1a domain scan, before any decomposition (not merely before declaring readiness). Scope it to the capability set the operator chose in P1a.

- Classify the six taxa first (actor model; lifecycle/transitions; persistence/reset; UI convergence; validation expectations; build/runtime conventions); ask only blocking questions; target 8 or fewer.
- Ask the operator directly with `AskUserQuestion` (the protocol runs in the main session via `/mission-init`). Build one question per blocking taxon: use the taxon label as `header` (≤12 chars), the question + why-it-matters as `question`, the proposed default as the first option, 1–3 alternatives. Batch into calls of at most 4 questions each; split larger sets across calls.
- After answers, record them in the mission `Clarified Decisions` interview table, then continue to P2.
- Before the single P1 STOP, build a forced-assumption ledger: list every decision you would otherwise INVENT to proceed (defaults you would silently adopt). Promote the highest-uncertainty, hardest-to-reverse items into clarify questions even when they fall outside the six taxa; record every assumption you keep under `Clarified Decisions` -> `Accepted assumptions:` (one line each — what is assumed and why it is reversible). An invented cross-worker decision left unrecorded is a traceability defect (rubric ★5).
- If AskUserQuestion is unavailable, fall back to a numbered text list and ask the operator to reply inline.
- If the operator does not answer, plan only where reversible and mark unresolved owner decisions explicitly.

## Quality Attribute & Risk Scan

Run as P1c, after the P1b architecture clarify, before the single P1 STOP. Scope it to the
capability set chosen in P1a and the architecture decided in P1b.

- Load `references/quality-attribute-dimensions.md` and follow its instantiation protocol.
- Present the quality-attribute menu with one `AskUserQuestion` multi-select; preselect only the
  `baseline` set. Fold each included attribute's concrete-target question into the P1b question
  batch (≤4 questions per call) so this stays within the single P1 gate STOP, not a separate gate.
- Record included attributes to mission `## Quality Attributes` (target + owning ADR/seam) and
  declined attributes to `## Non-Functional Scope` with a one-line reason.
- Each in-scope attribute must gain ≥1 validation-contract criterion (mission and/or milestone)
  with a concrete observable. Security on an auth/PII surface may not be silently omitted: target it
  or decline-with-reason (readiness rubric ★7).
- Capture risks surfaced during the scan into the mission `## Risks` register (one row each:
  risk, likelihood, impact, mitigation, trigger, owner).
- If `AskUserQuestion` is unavailable, present the menu as a numbered list marking `baseline` items
  as the default-yes set and ask the operator to confirm or amend inline.

## Architecture Rules

Use this test for every architecture decision:

> If two downstream workers made this choice independently, could they choose incompatibly?

If yes, Mission Planning decides or blocks. If no, defer to Feature Execution with a reason.

Mission must decide or block cross-cutting choices such as workspace topology, package manager, runtime topology, DB driver/runtime, API shape, seed/reset policy, shared enums, persistence ownership, QA strategy, and evidence paths.

Record decisions as concise ADR-lite entries:

```markdown
### ADR-<nn>: <name>
- Decision:
- Prevents:
- Must preserve:
- Trade-off: <negative consequence knowingly accepted, or `none`>
- Validation impact:
```

## Artifact Writing Discipline

Templates are shape guidance, not fill-every-heading checklists.

- Write the mandatory spine first.
- Add adapt-in sections only when they reduce ambiguity.
- Treat required adapt-ins as mandatory whenever the boundary type calls for them.
- Cut empty or decorative sections. No empty template blocks; every Given/When/Then is populated or the scenario is removed; every decisive `None` carries a reason.
- Prefer diagrams over prose when boundaries or flow would otherwise stay vague. Create `<mission-root>/architecture-map.md` (see `references/architecture-map.md`) when the diagram trigger holds: two or more runtime surfaces across a seam, a lifecycle with three or more states/transitions, or non-linear milestone/feature dependencies. The map is a view of the contracts, not a parallel source.
- Mark every version-sensitive claim (library/API/CLI/framework/cloud behavior) as `verified` (source + date), `assumed`, or `verify-at-install`. Never record one as silently `accepted`.
- Keep research depth in `research/*.md`; keep mission artifacts decision-dense.
- Never use placeholder phrases for future evidence, generic errors, standard APIs, or browser checks without concrete path, behavior, and proof.

Stage artifact writing:

1. Draft and self-check `mission.md` core before milestones.
2. Draft and self-check milestone split before feature briefs.
3. Draft and self-check feature briefs before validation contracts.
4. Run readiness only after all planned artifacts exist.

## Artifact Reference Cards

Load only the cards needed for the current write set:

| Artifact | Reference |
| --- | --- |
| Mission | `references/mission.md` |
| Quality attribute dimensions (P1c) | `references/quality-attribute-dimensions.md` |
| Mission validation contract | `references/mission-validation-contract.md` |
| Research note | `references/research-note.md` |
| Interface contract | `references/interface-contract.md` |
| Architecture map (diagram) | `references/architecture-map.md` |
| Milestone | `references/milestone.md` |
| Milestone validation contract | `references/milestone-validation-contract.md` |
| Feature brief | `references/feature.md` |

## Quality Bar

`mission.md` is ready only when it defines how the system should work, what architecture boundaries are fixed, what evidence supports those decisions, and why the milestone sequence prevents drift.

`milestone.md` is ready only when it describes one concrete engineering slice, its post-implementation state, owned surfaces, dependencies, and validation boundary.

`feature.md` is ready only when a fresh worker can create `spec.md` and `plan.md` without redefining repository shape, shared contracts, or success semantics.

Shared interface contracts are ready only when examples, seed data, timestamp/id semantics, and error codes are concrete enough that two workers would serialize the same boundary the same way.

Return `Needs revision` when artifacts are structurally present but vague.

## Readiness Failures

Do not hand off as `Ready` when:

- core workflow semantics or owner decisions are unresolved;
- implementation root, artifact root, or runtime boundary is ambiguous;
- architecture direction is a summary instead of a decision contract;
- a cross-cutting decision is deferred without proving it is local and reversible;
- a shared interface lacks a contract;
- milestones are broad phases instead of coherent engineering outcomes;
- feature briefs omit concrete shape, scenarios, invariants, allowed paths, forbidden paths, completion proof, or criteria IDs;
- evidence paths are directories or placeholders instead of concrete artifacts;
- user-facing validation lacks start URL/entry point, actor/context, actions, expected visible result, persistence check, negative case, and evidence artifact;
- any decisive `None` lacks a short reason.

Persist readiness in the mission artifact:

- `Ready` -> `status: planned`
- `Needs revision` -> `status: needs_revision`
- `Blocked` -> `status: blocked`

## Context Budget

- Keep active context to the current decision plus the required reference card.
- Use research notes or Task-dispatched workers for long source extraction.
- Link evidence instead of copying it.
- When context gets broad, update artifacts with status, decisions, evidence paths, blockers, and next action, then resume from files.
- On large missions, do not wait for the context to feel broad: at each gate boundary (after a STOP or a completed phase), persist `planning_phase` plus the decision state, then resume the next phase from files. Recall degrades as the active window grows (the U-shaped lost-in-the-middle curve — mid-context facts get dropped), so a fresh per-gate window protects earlier decisions from silent loss.

## Gates

- Write only after explicit apply/write/create approval.
- Ask only when a missing owner decision blocks planning quality.
- Do not invent codebase state.
- Do not hand off until the readiness review passes.
- QA Validator owns post-execution validation verdicts; the planning-readiness verdict at P7 is a joint dual-model gate — the cold Claude `mission-reviewer` crew AND the Sol HIGH readiness gate review the same frozen manifest, and the verdict is COMPUTED from both sides (see `## P7 Dual-Model Readiness Gate`), never chosen. The planning session prepares artifacts and applies revisions, but does not self-grade the readiness gate.

## Dry-Run Reporting

Report by current phase. Never emit a later phase's content early.

- **P1 dry-run** — Mode / Write now / Mission path; new vs resumed mission with concrete path; intake summary; the P1a domain capability menu (lean-core preselected) then the P1b clarification interview, then the P1c quality-attribute menu (baseline preselected); `Planning BLOCKED pending answers`; the evidence-path convention. Do NOT emit a milestone split, feature density, or interface contract.
- **P3 dry-run** — resolved-semantics recap; architecture spine as ADR-lite entries; milestone headlines with order and dependencies; research summary; `Awaiting scope approval`. Do NOT emit feature briefs or full contracts.
- **P7 dry-run** — full proposal: shared interface contract(s); milestone bodies; feature density by boundary type (API/data -> Inputs/Outputs; invalid-path -> Negative Scenarios; UI -> State/Interaction Model); validation contracts; the `architecture-map.md` views when the diagram trigger holds; the joint dual-model readiness verdict (Claude crew + Sol HIGH, `readiness-review.md` + `planning-reviews/p7-*-r<NN>.md`) with the round count, frozen-manifest digest, and the failing/auto-revised criteria.

Evidence-path convention (state in every phase):
- feature execution evidence -> `<feature-root>/validation.md`
- milestone QA rollup -> `<milestone-root>/validation-result.md`
- mission QA rollup -> `<mission-root>/validation-result.md`

Use the caller's output contract. Keep responses concise; artifacts carry durable detail.
