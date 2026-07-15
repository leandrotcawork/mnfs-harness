# MNFS Workflow PRD

## Purpose

MNFS is a development workflow for building systems from zero with consistent planning, isolated execution, and professional validation.

The topology is:

```text
Mission -> Milestone -> Feature
```

The workflow exists to prevent large, context-heavy executions from drifting in style, quality, scope, or validation. Each level has a clear responsibility, written artifacts, and blocking validation gates.

## Core Principles

- Mission defines the complete strategic map and final validation contract.
- Milestone coordinates execution and validates product/engineering readiness.
- Feature is the unit of implementation and must run in a fresh session.
- Advancement happens only through written validation contracts.
- Improvements are professionalizing, not reforming: improve architecture, libraries, and patterns when they reduce risk or increase quality without turning the mission into an unlimited rewrite.
- Research is used when it affects decision quality: codebase analysis first, official docs and external research when libraries, frameworks, architecture, or industry practices matter.
- Outputs must stay concise and structured to protect context.

## Specialized Modules

- [agents.md](agents.md): agent contracts and handoff rules.
- [skills-map.md](skills-map.md): researched skill/plugin strategy, future MNFS skills, and tooling rules.
- [state-model.md](state-model.md): lifecycle statuses, transitions, retry fields, and ownership.
- [validation-system.md](validation-system.md): validation criterion grammar, QA levels, evidence rules, and verdict ownership.
- [validation-roadmap.md](validation-roadmap.md): step-by-step roadmap for auditing and improving MNFS agents, skills, commands, templates, and docs.
- [mission-research.md](mission-research.md): mission-stage research flow, related files, and operating rules.
- [file-contracts.md](file-contracts.md): file ownership, metadata fields, artifact lifecycle, and anti-bloat rules.
- [future-plugin-spec.md](future-plugin-spec.md): future skill/plugin architecture, commands, phases, and non-goals.

## Naming

```text
MIS-<nn>-<slug>  Mission root
M-<nn>-<slug>    Milestone
F-<nn>-<slug>    Feature
```

Rules:

- IDs are stable after creation.
- Slugs are short, lowercase, and descriptive.
- Internal references use the ID first.
- Correction features use the next available feature ID.

Example:

```text
MIS-01-connect-all-modules/
  M-01-module-inventory-and-architecture-map/
    F-01-discover-current-modules/
```

## Artifact Structure

```text
MIS-01-example-mission/
  mission.md
  validation-contract.md
  validation-result.md
  execution-guide.md
  research/
    codebase-audit.md
    architecture-analysis.md
    external-research.md
    improvement-analysis.md
  M-01-example-milestone/
    milestone.md
    validation-contract.md
    validation-result.md
    execution-guide.md
    corrections/
      correction-task.md
    F-01-example-feature/
      feature.md
      spec.md
      plan.md
      validation.md
```

`spec.md`, `plan.md`, and `validation.md` are created or updated during feature execution, not during initial mission planning.

Mission planning and all later workflow skills use skill-owned reference files under `skills/<skill>/references/` for artifact shapes. Package-level `templates/` was temporary development scaffold and is not part of the final runtime surface.

## Mission Responsibilities

A Mission must:

- Understand the requested business/product/engineering outcome.
- Audit the current system and identify real implementation state.
- Analyze architecture, module boundaries, integration contracts, data flow, and risks.
- Research official docs, libraries, frameworks, and industry practices when useful.
- Decide whether existing work should be reused, completed, replaced, or improved.
- Define milestones, features, dependencies, and validation gates.
- Produce the final mission validation contract.
- Create restartable execution guidance for future sessions.

A Mission must not:

- Pretend implementation details are known before feature execution.
- Create overly detailed feature specs too early.
- Accept vague final validation criteria.
- Expand into broad rewrites unless required by the mission outcome.

## Milestone Responsibilities

A Milestone must:

- Execute features in order or in explicitly safe parallel groups.
- Start each feature in a fresh session with minimal required context.
- Review feature outputs against the feature brief/spec.
- Coordinate the milestone validation gate after all features are complete and run orchestration checks as needed.
- Dispatch correction workers only after QA reports blocking failures and correction scope is defined.
- Produce a blocked report after retry limits are reached.

A Milestone must not:

- Merge incomplete feature outputs by assumption.
- Advance without passing its validation contract.
- Redefine the mission goal.

## Feature Responsibilities

A Feature must:

- Start from `feature.md`, mission context, milestone context, and relevant contracts.
- Write `spec.md` before implementation.
- Write `plan.md` before implementation.
- Implement only its scoped work.
- Run quick validation and write `validation.md`.
- Return concise evidence to the milestone.

A Feature must not:

- Redesign the mission.
- Take unrelated refactors.
- Leave validation implicit.

## Roles

Roles may be humans, the main Codex session, or future subagents.

- Mission Strategist: designs the mission and final contract.
- Codebase Investigator: audits current implementation state.
- Architecture Analyst: evaluates boundaries, integration, data flow, and risks.
- External Researcher: checks official docs, frameworks, libraries, and practices.
- Improvement Analyst: recommends professionalizing improvements within scope.
- Milestone Orchestrator: runs features, accepts/rejects feature outputs, routes milestone validation to the independent gate, and decides when to invoke QA Validator for feature review.
- Feature Implementer: creates/updates spec, plan, validation, and implementation in a fresh session.
- Milestone Reviewer: independent cold crew that owns the milestone validation verdict against the milestone review rubric.
- QA Validator: owns the mission validation verdict and explicitly invoked formal feature review (fallback single cold pass for the milestone gate); may block advancement.
- Correction Worker: fixes scoped validation failures with retry limits.
- Mission Reviewer: independent cold reviewer that owns the planning-readiness gate (P7) verdict against the binary readiness rubric; plans and implements nothing.
- Mission Planner: optional CLI-only planner persona that runs the mission-planning protocol as the main thread with native clarify/scope gates; same protocol as `/mission-init`.

## Validation Gates

### Feature Gate

Answers:

- Did the feature implement its spec?
- What changed?
- Which tests/checks passed?
- What risks remain?
- Is it acceptable for milestone integration?

### Milestone Gate

Answers:

- Do all features work together?
- Are mechanical checks passing?
- Are integration contracts satisfied?
- Does the product behavior match the milestone contract?
- Was QA performed where applicable?

Mechanical checks may include tests, lint, typecheck, build, CI, migrations, browser/app flows, screenshots, logs, or manual QA notes.

### Mission Gate

Answers:

- Does the final system satisfy the mission validation contract?
- Are all milestones complete and traceable?
- Are critical gaps closed?
- Is documentation updated?
- Is the product ready at the quality level required by the mission?

## Failure Handling

When a milestone fails validation:

1. QA Validator reports blocking failures and recommended correction scope.
2. Milestone Orchestrator creates a correction task or correction feature.
3. Dispatch a Correction Worker.
4. Re-run the milestone gate.
5. Retry up to two times by default.
6. If still failing, create `blocked-report.md` and stop for human decision.

Correction artifact rules:

- A correction task is a scoped remediation note inside the milestone execution/validation notes when no new feature folder is needed.
- A correction feature is a new `F-<nn>-<slug>` folder when the fix needs implementation scope, spec/plan, or durable traceability.
- Correction features use the next available feature ID.

## Future Automation Requirements

The methodology should later be convertible into a Codex skill or plugin.

Future automation should provide:

- Mission creation command.
- Milestone execution command.
- Feature fresh-session prompt generator.
- Validation runner prompt.
- Correction worker prompt.
- Mission closeout and ownership handoff prompt.
- Template scaffolding.
- Status tracking across IDs.
- Optional GitHub/CI integration.
- Optional browser QA integration for frontend/app work.

## Success Criteria

This workflow is successful when:

- A complex system can be planned as a mission without losing strategic clarity.
- Each milestone can be resumed independently.
- Each feature can be executed in a fresh session with enough context and no excess.
- Validation contracts are specific enough for engineering and QA.
- Failures produce correction loops or blocked reports, not silent drift.
- The workflow can later become a skill/plugin without redesigning the methodology.
