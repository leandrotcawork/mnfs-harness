# Feature Validation

```yaml
id: F-00
type: feature-validation
status: quick_validating
owner: Feature Implementer
parent: F-00
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0
lifecycle_scope: feature
```

## Feature ID

F-00-feature-name

## Summary

State whether quick validation passed, failed, or is blocked.

## Quick Validation Result

- Result: Pass | Fail | Blocked
- Result owner: Feature Implementer
- Decision date:
- Final feature state for handoff: quick_validation_passed | rejected | blocked

Feature quick validation is recorded by the Feature Implementer. Milestone Orchestrator accepts, rejects, or blocks the feature output later during milestone integration review. QA Validator owns a feature-level verdict only when Milestone Orchestrator explicitly invokes formal feature validation review.

## Evidence Honesty

- Tag every command, QA step, and artifact with an `Evidence type`: `ran` (executed this session, real output captured), `assumed` (expected but not executed), or `could-not-run` (attempted but blocked; name the reason).
- Record `Pass` only when `Evidence type: ran` and an artifact path or pasted output is present. Never record `Pass` on `assumed` or `could-not-run`.
- A load-bearing check that is `assumed` or `could-not-run` makes the result `Blocked`, not `Pass`.

## Quick Validation State

- fixup_attempts:
- max_fixup_attempts:
- last_feature_validation_result:

These fields support `quick_validating` fixups. If fixups fail or the limit is reached, escalate to Milestone Orchestrator for rejection, blocking, or milestone correction handling.

## Spec Adherence

- Spec satisfied: Yes | No | Blocked
- Deviations:
- Reason:

## Changes Made

- File:
- Change:

## Commands Run

- Command:
- Status: Pass | Fail | Blocked | Not run
- Evidence type: ran | assumed | could-not-run
- Owner:
- Expected:
- Actual:
- Artifact:
- Blocking condition:

## Manual QA

- QA level: QA-0 | QA-1 | QA-2 | QA-3 | QA-4
- Flow or step:
- Status: Pass | Fail | Blocked | Not run
- Evidence type: ran | assumed | could-not-run
- Owner:
- Expected:
- Actual:
- Blocking condition:

## Evidence

- Artifact:
- Status: Pass | Fail | Blocked | Not run
- Evidence type: ran | assumed | could-not-run
- Owner:
- Blocking condition:

## Risks

List risks that Milestone Orchestrator must consider during feature acceptance review.

## Handoff

- Current status: `quick_validation_passed | rejected | blocked`
- Next owner: Milestone Orchestrator
- Next action: Review spec, plan, changed paths, and validation evidence.
- Required files/evidence: feature brief, spec, plan, changed paths, validation evidence
- Blockers or open decisions:
