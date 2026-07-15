---
name: feature-execution
description: Use this skill when a Feature Implementer needs to execute one MNFS feature through spec, plan, scoped implementation, quick validation, validation evidence, and handoff.
---

# MNFS Feature Execution

## Purpose

Execute exactly one MNFS feature from a minimal context pack through `spec.md`, `plan.md`, scoped implementation, quick validation, `validation.md`, and handoff to Milestone Orchestrator.

Feature Implementer owns quick validation evidence. Milestone Orchestrator owns feature acceptance for milestone integration. QA Validator owns formal verdicts only when explicitly invoked.

Note: the feature-implementer agent's inlined process is authoritative; this skill is auxiliary reference, auto-discovered when available.

## Required Inputs

- Feature path and feature brief.
- Minimal feature context pack.
- Relevant milestone constraints and supplied validation expectations when provided.
- Allowed paths or explicit file ownership.
- Dispatch mode: `full` (default) or `build` (spec.md + plan.md already exist; implement only).
- Existing `spec.md`, `plan.md`, or `validation.md` when resuming.
- Required commands, manual QA expectations, or evidence requirements when provided.

## Inspect

Inspect only what is needed to execute the assigned feature:

- feature `feature.md`;
- existing feature `spec.md`, `plan.md`, and `validation.md` when present;
- in `build` mode, treat existing `spec.md` and `plan.md` as authoritative — inspect them, do not re-plan;
- files named by the feature context pack, plan, or allowed path list;
- directly relevant parent constraints included in the context pack.

Do not load development docs, prompt docs, agent files, skill files, package scaffold, unrelated features, unrelated milestones, or full mission history as runtime dependencies.

## Feature Execution Modes

- `full` (default): spec → plan → build → quick-validate in one session. Used for small features.
- `build`: dispatched after a `full` session stopped at `planned` for a split feature; `spec.md` + `plan.md` already exist and are authoritative. Read the distilled plan, implement only, quick-validate, hand off. Fresh context by design.

`build_large(plan)` — split if ANY: more than 6 ordered steps; OR more than 4 expected changed paths; OR an unresolved exploration/unknown step. Override in either direction is allowed but must record `split_decision: single | split` with a reason; a planner `execution_mode_hint` biases but does not bind.

## Workflow

1. Confirm feature identity, parent milestone, assigned scope, allowed paths, current status, and validation expectations.
2. Separate confirmed facts, assumptions, missing evidence, risks, and owner decisions.
3. Stop before implementation if scope, allowed paths, or feature brief is missing.
4. Create or update `spec.md` before implementation:
   - problem;
   - requirements;
   - acceptance evidence;
   - non-goals;
   - design;
   - edge cases;
   - acceptance criteria.
5. Create or update `plan.md` before implementation:
   - ordered steps;
   - expected changed paths;
   - verification commands;
   - a verification command or QA step for every spec acceptance criterion, leaving none unmapped;
   - manual QA steps when applicable;
   - rollback or risk notes;
   - a minimal quick-validation plan derived from the feature scope and context when explicit validation expectations are not provided.
6. At the `planned` state, determine the split. In `build` mode, skip to step 7. In `full` mode, evaluate `build_large(plan)`, apply any planner `execution_mode_hint` as a non-binding prior, and record `split_decision: single | split` with a one-line reason. If `split`: stop at `planned`, return `status: planned` with the recorded `split_decision` and handoff reason "split — dispatch fresh build session"; do not implement. If `single`: continue.
7. Implement only the scoped feature work.
8. Run the planned quick validation. Use exact command text and observable results.
9. If quick validation finds an implementation defect, first reproduce the failure, then use at most one same-session fixup by default unless an explicit higher limit is assigned. Record the reproduction, the change made, and the result in `validation.md`, then rerun the full quick-validation plan (not only the failed check) to catch regressions before returning to scoped implementation.
10. If quick validation fails because of a command, environment, dependency, or access problem, stop as `blocked` and name the failing command or missing access, dependency, or owner decision.
11. When validation fails because spec, plan, or scope must change, stop as `rejected` and name the return point: `briefed`, `spec_ready`, or `planned`.
12. When validation or implementation is blocked by missing context, dependency, access, command failure, or owner decision, stop as `blocked` and name the missing input and owner.
13. Create or update `validation.md` with:
    - feature status as `quick_validation_passed`, `blocked`, or `rejected`;
    - quick validation result;
    - spec adherence;
    - changed paths;
    - commands run;
    - manual QA when applicable;
    - evidence artifacts;
    - an evidence type (`ran`, `assumed`, or `could-not-run`) for every command, QA step, and artifact, recording `Pass` only on `ran` with an artifact path and never on `assumed` or `could-not-run`;
    - same-session fixup attempts and results when any occur;
    - risks;
    - handoff to Milestone Orchestrator.
14. End successful feature work at `quick_validation_passed`, not `accepted`.
15. Record the same feature status in the final handoff response.
16. Hand off status, feature ID/path, artifact paths, changed paths, evidence/commands, validation result, required next inputs, handoff target, and handoff reason to Milestone Orchestrator.

## Reference Routing

Load only references needed for the current write set:

- `references/feature.md` when updating feature status or handoff fields.
- `references/feature-spec.md` when creating or updating `spec.md`.
- `references/feature-plan.md` when creating or updating `plan.md`.
- `references/feature-validation.md` when creating or updating `validation.md`.
- `references/blocked-report.md` when feature execution cannot advance.

## Allowed Outputs

Create or update within assigned scope:

- feature `spec.md`;
- feature `plan.md`;
- implementation or document/package files inside assigned scope;
- feature `validation.md`;
- feature `feature.md` handoff or status fields when explicitly requested.

## Hard Limits

- Do not redesign mission or milestone scope.
- Do not change validation criteria to fit the output.
- Do not take unrelated refactors or opportunistic fixes.
- Do not skip `spec.md`, `plan.md`, or `validation.md`.
- Do not claim feature acceptance, milestone pass, or mission pass.
- Do not keep fixing after fixup limits are reached.
- Do not require development docs, prompt docs, skill files, agent files, or package scaffold at runtime.

## Context Rules

- Keep feature artifacts focused on current scope, decisions, changed paths, evidence, risks, and next owner.
- Link evidence instead of copying long logs.
- Keep speculative alternatives out of `spec.md` and `plan.md` unless they are needed to explain the chosen path.
- Record missing context as blocked instead of expanding scope by guesswork.

## Completion Validation

Before handing off, verify:

- `spec.md` exists and has acceptance criteria;
- every `spec.md` acceptance criterion traces to a milestone criterion ID and maps to at least one verification command in `plan.md`;
- `plan.md` exists and names expected changed paths and validation steps;
- implementation changed only assigned paths or explains any justified exception;
- `validation.md` names exact commands, expected results, actual results, and artifacts;
- no `validation.md` result is recorded `Pass` on `assumed` or `could-not-run` evidence;
- `validation.md` records feature status as `quick_validation_passed`, `blocked`, or `rejected`;
- the final handoff response repeats the same feature status;
- handoff target is Milestone Orchestrator;
- no milestone or mission QA verdict is claimed.

## Stop / Block

Stop and report blocked when:

- feature path or brief is missing;
- allowed paths or ownership boundaries are required but absent;
- required dependency or command access is unavailable;
- quick validation cannot run because the command, environment, or access path is unavailable;
- artifact write access is unavailable;
- fixup attempts are exhausted;
- owner decision is required.

## Output

Use:

- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff

Require these handoff fields in the final response:

- Status
- Feature ID/path
- Artifact paths
- Changed paths
- Evidence/commands
- Validation result
- Required next inputs
- Handoff target
- Handoff reason
