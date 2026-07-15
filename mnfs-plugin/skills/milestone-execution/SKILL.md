---
name: milestone-execution
description: Use this skill when a Milestone Orchestrator needs to start or coordinate a milestone, review readiness, order features, dispatch fresh feature sessions, process returned feature evidence, invoke QA, scope corrections, or report blocked milestone execution.
---

# MNFS Milestone Execution

## Purpose

Coordinate one MNFS milestone from planned work through feature execution, feature acceptance review, QA routing, correction scoping, and blocked handling.

This skill is the milestone workflow. The Milestone Orchestrator owns coordination decisions. Feature Implementer owns feature `spec.md`, `plan.md`, implementation, and `validation.md`. The independent `milestone-reviewer` cold crew (dispatched by `/milestone-validate`) owns the milestone verdict; the Orchestrator consumes that folded verdict and never self-grades it. QA Validator owns formal mission verdicts and explicitly invoked formal feature review.

## Required Inputs

- Mission path and milestone path.
- Mission artifacts relevant to the milestone.
- Milestone brief, milestone validation contract, and milestone execution guide.
- Feature briefs from Mission Planning.
- Current milestone status, retry fields, blockers, and prior validation result when present.
- Returned feature artifacts when reviewing feature output: `feature.md`, `spec.md`, `plan.md`, `validation.md`, changed paths, and evidence/commands.
- QA Validator findings when creating correction work.

## Inspect

Inspect only what is needed for the current milestone decision:

- `mission.md`, mission validation contract, and mission execution guide when they constrain this milestone;
- milestone `milestone.md`, `validation-contract.md`, `execution-guide.md`, and `validation-result.md` when present;
- feature `feature.md`, `spec.md`, `plan.md`, and `validation.md` for returned feature review;
- `../../docs/shared-standards.md`, `../../docs/state-model.md`, `../../docs/validation-system.md`, and `../../docs/file-contracts.md` for source-of-truth rules;
- matching references from `## Reference Routing` only when creating or updating the matching artifact.

Do not load prompt drafts as runtime workflow instructions.
Do not load unrelated milestones, old phase history, or broad research unless it affects the current milestone decision.

## Workflow

1. Identify the requested milestone action: readiness, feature dispatch, feature output review, QA invocation, correction scoping, or blocked routing.
2. Confirm milestone identity, status, parent mission, validation contract, feature list, dependencies, and available evidence.
3. Separate facts, assumptions, missing evidence, recommendations, and decisions.
4. Run readiness review:
   - milestone brief exists;
   - milestone validation contract exists;
   - feature briefs exist;
   - dependencies and required previous milestones are satisfied or explicitly blocked;
   - execution guide or handoff has enough context for the next owner.
5. Review feature dependencies before ordering work.
6. Choose the next executable feature or a safe parallel group only when there are no shared-state, ordering, or integration conflicts.
7. Dispatch feature work with minimal fresh-session context:
   - feature brief;
   - relevant mission and milestone constraints;
   - validation contract excerpts needed for the feature;
   - required files or paths;
   - expected return artifacts: `spec.md`, `plan.md`, changed paths, and `validation.md`.
8. When feature output returns: if it is `status: planned` with `split_decision: split`, dispatch a fresh `feature-implementer` in `build` mode (its `spec.md` + `plan.md` exist on disk) to implement — do not treat the planned-stop as blocked or rejected. Otherwise inspect `feature.md`, `spec.md`, `plan.md`, changed paths, and `validation.md` for acceptance review.
9. Accept feature output only when scope, implementation evidence, and quick validation satisfy the feature brief and milestone constraints, and every load-bearing acceptance criterion is proven by `ran` evidence with a cited artifact. Never accept on `assumed`/`could-not-run` evidence; route auth/PII/security-surface or high-integration features to independent QA Validator review before acceptance.
10. Reject feature output when the feature scope, spec, plan, or implementation must be revised; include the return point: `briefed`, `spec_ready`, or `planned`.
11. Block feature output when missing context, dependencies, evidence, validation access, or owner decisions prevent acceptance or rejection.
12. Route the milestone to the independent gate (`/milestone-validate`, the cold `milestone-reviewer` crew) when all required feature outputs are accepted, and consume its folded verdict; invoke QA Validator for formal feature review when required by the contract or risk.
13. Scope correction work only after the milestone gate (or QA Validator feature review) reports blocking failures with defect loci and recommended correction scope. Append each correction cycle to the correction task's append-only Correction Log; never rewrite, delete, or renumber a prior row.
14. Create a correction task for narrow remediation that does not need a full feature folder.
15. Create a correction feature in the next available `F-<nn>-<slug>` feature folder when the correction needs feature-level `spec.md`, `plan.md`, implementation, and `validation.md` traceability.
16. After a correction returns, route the milestone back through the FULL independent gate (`/milestone-validate` — fresh cold crew + re-run + live runtime pass over the whole milestone, never a spot-check of the corrected criterion), consume the folded re-gate verdict, and read (never reset) the retry fields. A failed re-gate consumes the dispatched attempt.
17. Write or recommend `blocked-report.md` when retry limits are exhausted or progress depends on missing dependency, missing context, external failure, or human decision. When the blocker is retry exhaustion (failed re-gate at `correction_attempts >= max_correction_attempts`), copy the blocked report's Gate Attestation from the final `milestone-review.md` (verdict, round, still-failing ★ with defect loci, never-downgrade confirmation) — do not self-recall it.
18. Hand off to Feature Implementer, QA Validator, Correction Worker, Mission Strategist, or human owner with exact required inputs and reason.

There is no standalone correction command by design — Correction Worker dispatch stays behind Milestone Orchestrator scoping. To resume a correction interrupted after scoping, re-enter via `/correction-create` (or `/milestone-start`); the fresh orchestrator reads the persisted `corrections/correction-task.md` and milestone retry state, then re-dispatches the Correction Worker via Task without resetting retry counters.

## Reference Routing

Load only references needed for the current write set:

- `references/milestone.md` when updating milestone status, retry fields, or handoff.
- `references/milestone-validation-contract.md` when milestone validation criteria need shape guidance.
- `references/milestone-validation-result.md` when recording validation results or correction-scope references.
- `references/execution-guide.md` when writing readiness, dispatch, integration, correction, or blocked handoff sections.
- `references/feature.md` when creating or updating a feature handoff.
- `references/feature-validation.md` when writing milestone acceptance review into feature validation evidence.
- `references/correction-task.md` when creating a narrow correction task.
- `references/blocked-report.md` when milestone progress is blocked.

## Allowed Outputs

With explicit write, apply, or create approval, create or update:

- milestone `milestone.md` status, retry fields, and handoff sections;
- milestone `execution-guide.md` readiness, dispatch, integration, correction, or blocked handoff sections;
- feature `feature.md` status or handoff section;
- feature `validation.md` milestone acceptance review section;
- milestone `validation-result.md` correction scope reference after QA Validator findings;
- milestone `corrections/correction-task.md`;
- correction feature `F-<nn>-<slug>/feature.md`;
- milestone `blocked-report.md`.

Do not create or update feature `spec.md`, `plan.md`, or quick-validation evidence as Milestone Orchestrator.

## Hard Limits

- Do not redefine mission scope or milestone validation criteria.
- Do not implement feature work.
- Do not create feature `spec.md`, `plan.md`, or `validation.md` for the Feature Implementer.
- Do not accept feature output without inspectable evidence.
- Do not issue milestone or mission QA verdicts.
- Do not reach a milestone verdict outside `/milestone-validate`. A verdict assembled from directly-dispatched reviewer/QA returns is un-filed and does not count; only the persisted `validation-result.md` is the verdict.
- Do not scope correction work before QA Validator reports blocking failures.
- Do not reset retry counters or rewrite/delete prior rows of the append-only correction log.
- Do not re-gate a corrected milestone with a partial spot-check; route it through the full independent gate.
- Do not self-write a retry-exhausted blocked report; attest it from the final milestone gate review.
- Do not set or imply milestone `status: passed` without a backing `validation-result.md` (`Verdict: Pass`, folded from an on-disk `milestone-review.md`, `7/7`, no failing `★`); status is derived from that artifact, verifiable with `scripts/status-integrity.sh` (`STATUS-INTEGRITY OK`), never asserted.
- Do not convert correction work into hidden new product scope.
- Do not require runtime prompt docs.

## Context Rules

- Keep milestone notes focused on current status, decision, evidence paths, changed paths, risks, and next owner.
- Prefer artifact links and concise summaries over copied logs.
- Keep feature dispatch packets minimal enough for a fresh session.
- Keep formal validation criteria in validation contracts and validation results, not in orchestration prose.

## Planning Validation

Before handing off, verify:

- milestone readiness decision is explicit;
- dependency and ordering decision is evidence-based;
- next feature or safe parallel group is named;
- dispatch context is minimal and sufficient;
- feature acceptance decision is supported by `spec.md`, `plan.md`, changed paths, and `validation.md`;
- QA invocation decision is clear;
- correction scope is tied to QA Validator findings;
- retry and blocked behavior follows `state-model.md`;
- next owner and next action are clear.

## Stop / Block

Stop and report blocked when:

- milestone identity or path is missing;
- required milestone artifacts cannot be inspected;
- dependencies are unresolved;
- feature output is missing `spec.md`, `plan.md`, changed paths, or `validation.md`;
- validation evidence cannot be inspected;
- QA Validator findings are missing for correction scoping;
- retry limits are exhausted;
- a human owner or Mission Strategist decision is required.

## Output

Use:

- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff
