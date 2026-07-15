---
name: validation
description: Validate MNFS mission or milestone outputs against explicit contracts, evidence, verdict, blocker, and correction-scope rules.
---

# MNFS Validation

## Purpose

Use this skill when a mission or milestone validation verdict is requested. It may also guide formal feature review only when Milestone Orchestrator explicitly invokes QA Validator for that feature.

The milestone gate is an independent cold-reviewer crew plus an execution-grounded qa-validator pass: `/milestone-validate` dispatches `milestone-reviewer` cold subagents against the milestone review rubric AND a `qa-validator` pass that (a) re-executes a sample of the milestone contract checks against the current integrated milestone state, and (b) for user-facing/runnable milestones drives the running milestone live (agent-browser headless for UI; real endpoints for API) through its acceptance flows to confirm the UI and API actually work end to end. The gate folds all of it (a sub-reviewer FAIL, a re-run mismatch, or a live defect is never downgraded to PASS; a user-facing milestone with no live-driven evidence is Blocked) and computes the verdict — never self-graded by the orchestrator or implementer that produced the evidence. QA Validator owns mission validation verdicts, owns feature-level verdicts only when Milestone Orchestrator explicitly invokes formal feature validation review, and is the fallback identity for executing a single cold milestone pass when the crew cannot be dispatched.

When this skill runs the milestone gate as the fallback (Task or `milestone-reviewer` unavailable), execute a single cold full pass over all seven ★ criteria in `references/milestone-review-rubric.md` PLUS the ★2 (evidence honesty) + ★4 (integration) adversarial second pass, applying the same fold-and-compute verdict rule.

## Required Inputs

- Validation scope: mission, milestone, or explicitly invoked formal feature review.
- Scope path or ID.
- Active validation contract.
- Relevant artifacts and accepted outputs.
- Evidence from commands, logs, screenshots, CI, rendered artifacts, manual QA, or linked reports.
- Required QA level, if defined.
- Apply/write authorization if validation artifacts may be updated.

## Inspect

Inspect only the invoked scope, its validation contract, and evidence needed to judge each criterion. Do not inspect unrelated missions, milestones, features, development references, prompt drafts, or implementation files unless the active validation contract or evidence package requires them.

## Workflow

1. Confirm the validation scope and contract are available.
2. Extract criteria, required flags, expected outcomes, blocking failure rules, owners, and evidence requirements.
3. Inspect actual evidence for each criterion.
4. Mark each criterion as Pass, Fail, Blocked, Not run, or Pending according to evidence.
5. Treat missing required evidence as blocking advancement.
6. Treat observed blocking failure as blocking advancement even when the criterion is optional.
7. Issue exactly one verdict: Pass, Fail, or Blocked.
8. When failed or blocked, report blocking failures and recommended correction scope.
9. Do not create correction assignments and do not fix defects.
10. Hand the result to the appropriate owner.

## Allowed Outputs

With explicit apply/write authorization, update only the validation result or blocked report artifact for the invoked scope. For milestone validation, correction-scope references may be recorded for Milestone Orchestrator to consume. Do not create correction tasks or correction features from this skill.

## Reference Routing

Load only references needed for the current write set:

- `references/mission-validation-contract.md` when mission criteria need shape guidance.
- `references/mission-validation-result.md` when writing mission validation results.
- `references/milestone-validation-contract.md` when milestone criteria need shape guidance.
- `references/milestone-review-rubric.md` when running the milestone gate (crew dispatch or fallback cold pass).
- `references/milestone-validation-result.md` when writing milestone validation results.
- `references/feature-validation.md` when formal feature review is explicitly invoked.
- `references/blocked-report.md` when validation cannot advance.

## Hard Limits

- Do not pass validation with missing required evidence.
- Do not fix implementation defects.
- Do not create correction work.
- Do not change validation criteria to match existing output.
- Do not run deployment, release, or environment mutation as evidence collection.

## Completion Checks

Before handing off, confirm:

- verdict is exactly Pass, Fail, or Blocked;
- contract checked is named;
- artifact paths are listed;
- evidence and commands are named;
- blocking failures are listed or explicitly absent;
- recommended correction scope is specific when validation failed;
- next owner and handoff reason are stated.

## Stop / Block

Stop with blocked when the validation contract, required evidence, command access, environment, credential, artifact, or owner decision is missing.

## Output

Use:

- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff
