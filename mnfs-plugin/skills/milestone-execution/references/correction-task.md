# Correction Task

```yaml
id: M-00-COR-01
type: correction-task
status: correction_needed
owner: Milestone Orchestrator
parent: M-00
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0
lifecycle_scope: milestone
```

## Failed Criteria

- Criterion:
- Validation result:
- Evidence path:

## Assigned Scope

State the exact files, behavior, or document sections the correction worker may touch.

## Allowed Paths

- Path:

## Retry Fields

- correction_attempts:
- max_correction_attempts:
- last_validation_result:

## Correction Log (append-only)

One row per correction cycle. APPEND only — never rewrite, delete, or renumber a prior row. The independent milestone gate (★6 Correction Integrity) reads this log; rewritten history FAILS the gate.

| Round | Attempt | Scope dispatched | Defect locus (file:line + token) | Correction result | New `ran` evidence path | Re-gate verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |  |

## Required Commands Or QA

- Command:
- Expected result:

## Handoff

- Current status: `correction_needed`
- Next owner: Correction Worker
- Next action: Fix only the assigned failure and return evidence.
- Required files/evidence: failed criteria, QA evidence path, allowed paths, rerun evidence
- Blockers or open decisions:
