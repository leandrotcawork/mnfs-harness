# Milestone Artifact Reference

## Purpose

Use this reference when creating or updating a milestone brief from Mission Planning.

## Load When

Load only when the write set includes `MIS-<nn>-<slug>/M-<nn>-<slug>/milestone.md`.

## Target Path

`MIS-<nn>-<slug>/M-<nn>-<slug>/milestone.md`

## Required Metadata

```yaml
id: M-<nn>
type: milestone
status: planned | ready | in_progress | validating | correction_needed | blocked | passed | skipped
owner: Mission Strategist
parent: MIS-<nn>
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0 | QA-1 | QA-2 | QA-3 | QA-4
lifecycle_scope: milestone
```

## Artifact Shape

~~~markdown
# M-<nn>-<slug>

```yaml
id: M-<nn>
type: milestone
status: planned
owner: Mission Strategist
parent: MIS-<nn>
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0
lifecycle_scope: milestone
```

## Mission

## Outcome

## Why This Milestone Exists

## Features

| ID | Name | Brief |
| --- | --- | --- |

## Dependencies

## Ownership & Concurrency

- Exclusive surfaces (only this milestone writes): <files/modules, OpenAPI sections, FE routes, DB tables>
- Migration block: <pre-allocated range or `none`>
- Predicted seam locks: <shared interfaces this milestone must ADD to — named per the additive
  contract-lock pattern — or `none`>
- Runs in parallel with: <milestone IDs from the mission Parallel Execution Plan, or `none`>
- Internal feature DAG: <F-xx → F-yy edges; mark independent features `F-aa ∥ F-bb` so the
  orchestrator can dispatch them to concurrent workers>

## Risks

## Done Means

## Handoff

- Current status:
- Next owner:
- Next action:
- Required files/evidence:
- Blockers or open decisions:

## Correction Handoff

- QA failure summary:
- Correction scope:
- Attempts used/remaining:
- Next artifact:
- Revalidation evidence required:
````

## Writing Rules

- Define the milestone outcome as an observable result.
- Keep feature rows as briefs, not implementation plans.
- Name dependencies that affect ordering or parallelization.
- Fill `Ownership & Concurrency` from the mission Parallel Execution Plan row: exclusive
  surfaces concrete (paths/sections/tables, not module names alone), migration block explicit
  (`none` counts), predicted seam locks named, internal feature DAG with `∥` marks where
  features are worker-independent.
- Keep correction handoff empty or marked not applicable during initial planning.

## Anti-Bloat Boundary

- Do not redefine mission scope.
- Do not include feature `spec.md`, `plan.md`, or validation logs.
- Do not record milestone QA verdicts.

## Validation Check

- Outcome, dependencies, feature queue, risks, done means, and handoff are filled.
- Feature rows point to lightweight `feature.md` briefs.
- Next owner is Milestone Orchestrator unless blocked.
````
