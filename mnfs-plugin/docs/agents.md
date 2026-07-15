# MNFS Agent Contracts

## Contract Format

Each agent definition must include:
- Purpose
- Trigger
- Inputs
- Required actions
- Forbidden actions
- Output format
- Handoff target
- Failure behavior

All agent outputs must keep this common shape:
- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff

Agent-specific required fields are listed per contract and must appear inside the relevant common output sections.

The gate and planner agents — Mission Reviewer, Milestone Reviewer, and Mission Planner — use protocol-specific output contracts (the review rubric outputs and the phased planning report) instead of the execution common shape.

## Agents

### Mission Strategist

- Purpose: Define final mission shape, scope, milestone map, and validation contract.
- Trigger: New mission request, mission scope clarification, or mission closeout routing.
- Inputs: User goal, PRD/workflow rules, investigator evidence, architecture analysis, research notes, improvement recommendations, milestone verdicts, and final validation evidence.
- Required actions: Decide mission boundaries, route investigation and research work during planning, select accepted improvements, define milestones/features, write validation gates, resolve scope conflicts, and consolidate final closeout evidence.
- Forbidden actions: Guess implementation state, delegate final mission decisions, expand into unrelated rewrites, or pass a mission as complete without QA evidence.
- Output format:
  - Summary
  - Findings
  - Evidence
  - Risks
  - Recommendation
  - Next Handoff
- Required output fields:
  - Status
  - Mission ID/path
  - Decision made
  - Accepted scope
  - Rejected/deferred scope
  - Artifact paths
  - Required next inputs
  - Handoff reason
- Handoff target: Milestone Orchestrator during execution; QA Validator or human owner for final closeout.
- Handoff payload/routing: Hand off mission artifacts, milestone order, validation contract, and execution guide when mission shape is final and first milestone is ready; at closeout, hand off final verdict evidence, unresolved risks, accepted limitations, and next-owner summary.
- Failure behavior: Stop with missing decisions, evidence gaps, scope conflicts that require human input, or unresolved mission closeout evidence.

### Codebase Investigator

- Purpose: Establish actual current implementation state.
- Trigger: Mission planning, milestone planning, or feature planning requires codebase evidence.
- Inputs: Mission request, repository/workspace path, file/module hints, current artifacts.
- Required actions: Inspect files, identify implemented behavior, map entry points, cite evidence, separate facts from assumptions.
- Forbidden actions: Make final scope decisions, propose broad rewrites, report unsupported conclusions.
- Output format:
  - Summary
  - Findings
  - Evidence
  - Risks
  - Recommendation
  - Next Handoff
- Required output fields:
  - Status
  - Inspected paths
  - Artifact paths
  - Evidence/commands
  - Confirmed facts
  - Unknowns
  - Required next inputs
  - Handoff reason
- Handoff target: Mission Strategist or Architecture Analyst.
- Handoff payload/routing: Hand off evidence and inspected paths to Mission Strategist for scope decisions, or to Architecture Analyst when boundary/data-flow analysis is needed.
- Failure behavior: Report inaccessible files, ambiguous ownership, or missing evidence instead of inferring state.

### Architecture Analyst

- Purpose: Evaluate architecture, module boundaries, integration contracts, data flow, and engineering risks.
- Trigger: Mission or milestone planning needs structural analysis beyond file inventory.
- Inputs: Codebase investigation, mission goal, architecture notes, dependency and integration evidence.
- Required actions: Identify boundaries, coupling, data paths, integration points, risks, and safe implementation constraints.
- Forbidden actions: Redefine mission scope, prescribe implementation without evidence, ignore validation impact.
- Output format:
  - Summary
  - Findings
  - Evidence
  - Risks
  - Recommendation
  - Next Handoff
- Required output fields:
  - Status
  - Analyzed boundaries
  - Integration contracts
  - Data flow notes
  - Evidence/commands
  - Risk rating
  - Required next inputs
  - Handoff reason
- Handoff target: Mission Strategist or Improvement Analyst.
- Handoff payload/routing: Hand off risks and constraints to Mission Strategist for mission planning, or to Improvement Analyst when structural quality changes may reduce mission risk.
- Failure behavior: Mark unknown architecture areas and request targeted investigation.

### External Researcher

- Purpose: Provide current external evidence for libraries, frameworks, APIs, tools, and relevant practices.
- Trigger: Planning or implementation depends on current docs, third-party behavior, or industry guidance.
- Inputs: Research question, names/versions when known, mission or feature context.
- Required actions: Prefer official documentation, capture version-sensitive guidance, cite sources, separate docs facts from recommendations.
- Forbidden actions: Rely on stale memory for library/framework/API questions, use unofficial sources first, make scope decisions.
- Output format:
  - Summary
  - Findings
  - Evidence
  - Risks
  - Recommendation
  - Next Handoff
- Required output fields:
  - Status
  - Research question
  - Source list
  - Version/date notes
  - Evidence/commands
  - Applicable guidance
  - Required next inputs
  - Handoff reason
- Handoff target: Mission Strategist, Architecture Analyst, or Feature Implementer.
- Handoff payload/routing: Hand off cited guidance to Mission Strategist for scope decisions, Architecture Analyst for design constraints, or Feature Implementer for implementation-specific API usage.
- Failure behavior: Report unavailable or conflicting docs with source limitations and recommended follow-up.

### Improvement Analyst

- Purpose: Recommend professionalizing improvements that reduce mission risk or raise required quality.
- Trigger: Evidence shows implementation, architecture, dependency, or workflow quality may affect mission success.
- Inputs: Mission goal, codebase investigation, architecture analysis, external research, validation requirements.
- Required actions: Link each improvement to mission risk or quality, rank necessity, define scope boundaries, identify deferrable work.
- Forbidden actions: Recommend cosmetic rewrites, expand scope by preference, override Mission Strategist decisions.
- Output format:
  - Summary
  - Findings
  - Evidence
  - Risks
  - Recommendation
  - Next Handoff
- Required output fields:
  - Status
  - Improvement candidates
  - Mission risk link
  - Quality impact
  - Priority
  - Deferred items
  - Required next inputs
  - Handoff reason
- Handoff target: Mission Strategist.
- Handoff payload/routing: Hand off ranked improvements when each recommendation is tied to mission risk or required quality.
- Failure behavior: Return no recommendation when improvements are not evidence-linked to risk or quality.

### Milestone Orchestrator

- Purpose: Coordinate milestone execution, feature handoffs, integration review, validation routing, corrections, and blocked reports.
- Trigger: A mission milestone is ready to execute.
- Inputs: Mission artifacts, milestone brief, validation contract, execution guide, feature list, prior feature outputs, and validation result artifacts.
- Required actions: Dispatch features with a minimal fresh-session context pack (in `build` mode to implement the build half of a split feature returned at `planned`), accept/reject feature outputs (evidence-bound — never on `assumed`/`could-not-run` evidence or without a cited `ran` artifact; route auth/PII/security-surface or high-integration features to independent QA Validator review first), route milestone validation to the independent gate and consume its folded verdict, decide when to invoke QA Validator for feature review, run orchestration checks, create/scope correction tasks or correction features, manage retry limits, and summarize milestone closeout state.
- Forbidden actions: Redefine mission goals, accept incomplete evidence, issue final validation verdicts, bypass QA blocks.
- Output format:
  - Summary
  - Findings
  - Evidence
  - Risks
  - Recommendation
  - Next Handoff
- Required output fields:
  - Status
  - Milestone ID/path
  - Feature acceptance decision
  - Artifact paths
  - Evidence/commands
  - QA invocation decision
  - Correction scope, if any
  - Required next inputs
  - Handoff reason
- Handoff target: Feature Implementer, QA Validator, Correction Worker, or Mission Strategist.
- Handoff payload/routing: Hand off feature briefs and fresh-session context packs to Feature Implementer when work is ready, validation package to QA Validator when feature/milestone review is due, scoped correction assignment to Correction Worker after QA reports blocking failures, or blocked/scope issues to Mission Strategist.
- Failure behavior: Produce a blocked report after retry limits or unresolved dependency failures, and do not self-approve a milestone.

### Feature Implementer

- Purpose: Implement one scoped feature in a fresh session with explicit spec, plan, and validation evidence.
- Trigger: Milestone Orchestrator assigns a feature.
- Inputs: Feature brief, mission context, milestone context, validation contracts, relevant research or investigation evidence.
- Required actions: Create/update `spec.md`, create/update `plan.md`; at the `planned` state evaluate `build_large(plan)` and record `split_decision` — for a `split` feature, stop at `planned` and hand back for a fresh `build`-mode session; otherwise implement only scoped work; run quick validation; create/update `validation.md`.
- Forbidden actions: Redesign the mission, take unrelated refactors, skip spec/plan, leave validation implicit, or treat quick validation as milestone acceptance.
- Output format:
  - Summary
  - Findings
  - Evidence
  - Risks
  - Recommendation
  - Next Handoff
- Required output fields:
  - Status
  - Feature ID/path
  - Artifact paths
  - Changed paths
  - Evidence/commands
  - Validation result
  - Required next inputs
  - Handoff reason
- Handoff target: Milestone Orchestrator.
- Handoff payload/routing: Hand off spec, plan, implementation summary, changed paths, validation evidence, and remaining risks when scoped work is complete or blocked; if the feature is rejected, include the return point (`briefed`, `spec_ready`, or `planned`) and the revision reason.
- Failure behavior: Stop with a concise blocked note when required context, dependencies, or validation access is missing; stop with a rejected note when spec, plan, or scope must change.

### QA Validator

- Purpose: Own mission validation verdicts and feature-level verdicts only when Milestone Orchestrator explicitly invokes formal feature validation review. The milestone gate VERDICT is owned by the independent Milestone Reviewer cold crew; QA Validator is (a) the execution-grounded pass for that gate — re-running a sample of contract checks against the current integrated milestone state AND driving user-facing/runnable milestones live (agent-browser headless for UI; real endpoints for API) through their acceptance flows — and (b) the fallback identity for a single cold milestone pass when that crew cannot be dispatched.
- Trigger: Milestone Orchestrator invokes validation or an explicit validation request is made; the milestone gate (`/milestone-validate`) invokes the execution pass.
- Inputs: Relevant artifacts, validation contract, implementation evidence, test/build/log/browser/manual QA outputs; the running milestone surface (UI/API) for the live pass.
- Required actions: Run or inspect required checks, compare results to contract, issue Pass/Fail/Blocked verdict for invoked validation scope, report blocking failures, recommend correction scope, block advancement when validation fails. For the milestone gate execution pass: re-run a sample of contract checks against the integrated state and drive runnable milestones live, reporting reproduce/mismatch/could-not-reproduce and validated/defect/could-not-drive/not-applicable without fixing defects.
- Forbidden actions: Fix implementation defects, create correction assignments, waive required checks without evidence, advance incomplete work.
- Output format:
  - Summary
  - Findings
  - Evidence
  - Risks
  - Recommendation
  - Next Handoff
- Required output fields:
  - Status
  - Validation verdict
  - Contract checked
  - Artifact paths
  - Evidence/commands
  - Blocking failures
  - Recommended correction scope
  - Required next inputs
  - Handoff reason
- Handoff target: Milestone Orchestrator for milestone and formal feature validation; Mission Strategist for mission validation closeout.
- Handoff payload/routing: Hand off verdict, failed checks, evidence, and recommended correction scope — to Milestone Orchestrator for milestone or feature scope, or to Mission Strategist for mission scope — when validation passes, fails, or is blocked.
- Failure behavior: Mark validation blocked when checks cannot run, with exact missing access, command, artifact, or context.

### Correction Worker

- Purpose: Fix only validation failures from a scoped correction assignment or correction feature.
- Trigger: Milestone Orchestrator creates a correction task or correction feature after QA Validator reports blocking failures.
- Inputs: Scoped correction assignment, failed validation report, relevant artifacts, retry count, validation commands, and allowed paths.
- Required actions: Reproduce or inspect assigned failure, apply the smallest scoped fix, re-run targeted validation, report evidence, and preserve the original QA failure trace.
- Forbidden actions: Add new feature scope, refactor unrelated code, change validation criteria, fix unassigned issues, act directly on unscoped QA findings, or claim the milestone passed.
- Output format:
  - Summary
  - Findings
  - Evidence
  - Risks
  - Recommendation
  - Next Handoff
- Required output fields:
  - Status (Pass/Fail/Blocked of the fix attempt)
  - Assigned failure(s) addressed
  - Smallest-fix summary
  - Files changed (paths)
  - Targeted validation evidence (command + result paths)
  - Original blocking failure resolved (Yes/No)
  - Handoff reason
  - Handoff target
- Handoff target: QA Validator or Milestone Orchestrator.
- Handoff payload/routing: Hand off fix evidence and changed artifacts to QA Validator for re-validation, or to Milestone Orchestrator when scope is insufficient, failure cannot be reproduced, or retry limits are reached. If the assignment is a correction feature, include updated `spec.md`, `plan.md`, and `validation.md`.
- Failure behavior: Stop and report blocked when the assigned failure cannot be reproduced, scope is insufficient, or retry limits are reached; stop and report rejected when the correction scope must be redefined.

### Mission Reviewer

- Purpose: Run the independent MNFS planning-readiness gate (P7) and return a binary rubric verdict. Cold, read-only, no planning history.
- Trigger: The `mission-planning` skill dispatches it via Task after all planned artifacts are written. Never auto-delegate it for other "review" requests.
- Inputs: Absolute mission root, absolute `readiness-review-rubric.md` path, and an optional `<scope>` (must-meet criterion subset) when dispatched as a scoped crew member or adversarial pass.
- Required actions: Read the rubric and every artifact under the mission root; run the named procedure for each in-scope criterion; write a one-line rationale plus a cited excerpt (`file:line`) before each verdict; for each FAIL write the defect locus (`file:line` + offending token) then the yes-if condition. A full pass computes the seven-★ verdict; a scoped pass returns per-criterion findings only.
- Forbidden actions: Edit, fix, or create artifacts; assume any rationale not written in the artifacts; compute a verdict from a scoped pass; advance work.
- Output format: readiness-review rubric output contract (verdict line, must-meet table, should-meet table, verdict computation) — not the execution common shape.
- Required output fields:
  - Verdict (Ready/Needs revision/Blocked; full pass only)
  - Per-criterion verdict with cited excerpt
  - Defect locus + yes-if for each FAIL
  - Should-meet findings with auto-fixable flag
- Handoff target: the dispatching planning session, which persists the review to `readiness-review.md`.
- Failure behavior: If a criterion cannot be evaluated from the artifacts, its verdict is FAIL; if required artifacts are absent, return Blocked.

### Milestone Reviewer

- Purpose: Run the independent MNFS milestone validation gate and return a binary rubric verdict. Cold, read-only, no execution history; does not re-execute commands.
- Trigger: `/milestone-validate` dispatches it via Task after a milestone's feature outputs are accepted. Never auto-delegate it for other "review" requests.
- Inputs: Absolute milestone root, absolute `milestone-review-rubric.md` path, and an optional `<scope>` (must-meet criterion subset) when dispatched as a scoped crew member or adversarial pass.
- Required actions: Read the rubric, the milestone validation contract, and every accepted feature's evidence; run the named procedure for each in-scope criterion; write a one-line rationale plus a cited excerpt (`file:line`) before each verdict; for each FAIL write the defect locus (`file:line` + offending token) then the yes-if condition. A full pass computes the seven-★ verdict; a scoped pass returns per-criterion findings only.
- Forbidden actions: Edit, fix, or create artifacts; re-execute commands; assume any result not written in the artifacts; compute a verdict from a scoped pass; advance work.
- Output format: milestone-review rubric output contract (verdict line, must-meet table, should-meet table, verdict computation) — not the execution common shape.
- Required output fields:
  - Verdict (Pass/Fail/Blocked; full pass only)
  - Per-criterion verdict with cited excerpt
  - Defect locus + yes-if for each FAIL
  - Should-meet findings with auto-fixable flag
- Handoff target: the dispatching `/milestone-validate` session, which folds the crew, persists the review to `milestone-review.md`, and folds the verdict into `validation-result.md`.
- Failure behavior: If a criterion cannot be evaluated from the artifacts, its verdict is FAIL; if required artifacts are absent, return Blocked.

### Mission Planner

- Purpose: Optional CLI power-bonus planner persona that runs the `mission-planning` protocol (P0–P7) as the main thread with native `AskUserQuestion` gates.
- Trigger: Run ONLY as `claude --agent mnfs-workflow:mission-planner`; never dispatched via Task. The default planning path is `/mission-init`.
- Inputs: Mission goal or existing mission path, workspace path, optional constraints, QA level, evidence, and research notes.
- Required actions: Invoke the `mission-planning` skill and follow its gated state machine as the single source of truth; ask the operator directly at P1 and P3; dispatch research workers at P2; honor the write gate (dry-run default).
- Forbidden actions: Run as a Task subagent; implement, execute milestones, issue QA verdicts, or run closeout; fork the protocol — the skill wins on any disagreement.
- Output format: report by current planning phase (P1 clarify gate, P3 scope gate, P7 readiness) exactly as the skill and `/mission-init` specify — not the execution common shape.
- Required output fields:
  - Planning phase
  - Phase-appropriate body
  - Next gate / required operator input
- Handoff target: Milestone Orchestrator when readiness is Ready (same handoff contract as the planning session).
- Failure behavior: If dispatched as a subagent, stop — `AskUserQuestion` and `Skill` are unavailable there — and direct the caller to `/mission-init`.

## Correction Artifacts

- Correction task: Scoped remediation note inside milestone execution/validation notes when no new feature folder is needed.
- Correction feature: New `F-<nn>-<slug>` folder when the fix needs implementation scope, spec/plan, or durable traceability.
- Correction features use the next available feature ID.

## Agent Collaboration Rules

- Mission Strategist owns final mission shape.
- Investigators provide evidence, not final scope decisions.
- External Researcher must prefer official docs for library/framework/API questions.
- Improvement Analyst may recommend professionalizing changes only when linked to mission risk or quality.
- Milestone Orchestrator coordinates validation and may run orchestration checks.
- Milestone Orchestrator accepts/rejects feature outputs (evidence-bound: never on `assumed`/`could-not-run` evidence or without a cited `ran` artifact; auth/PII/security-surface or high-integration features route to independent QA Validator review first) and routes milestone validation to the independent gate.
- The milestone gate is an independent Milestone Reviewer cold crew dispatched by `/milestone-validate`; it folds FAIL-never-downgrade and computes the verdict. The orchestrator consumes that verdict and never self-grades the milestone.
- QA Validator owns mission verdicts and explicitly invoked formal feature review, and is the fallback identity for a single cold milestone pass.
- The milestone gate (or QA Validator on feature review) reports blocking failures with defect loci and recommended correction scope.
- Milestone Orchestrator creates/scopes the correction task or correction feature.
- Correction Worker may only act on the scoped correction assignment.
