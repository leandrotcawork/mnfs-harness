# Execution Guide

```yaml
id:
type: execution-guide
status:
owner:
parent:
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0
lifecycle_scope: support
```

Metadata guidance:

- `status` inherits the parent mission or milestone status from `state-model.md`.
- `owner` is `Mission Strategist` for a mission execution guide initially.
- `owner` is `Milestone Orchestrator` for a milestone execution guide during execution.

## Scope

Mission/Milestone ID:

## How To Resume

Describe the minimum context needed to continue this mission or milestone.

## Execution Order

1. Step
2. Step
3. Step

## Context Package For Next Session

- Required files:
- Required contracts:
- Current status:
- Next action:

## Handoff

- Current status:
- Next owner:
- Next action:
- Required files/evidence:
- Blockers or open decisions:

## Advancement Rules

List the gates that must pass before moving forward.

## Failure Rules

Describe when to retry, create a correction task, or write `blocked-report.md`.

- correction_attempts: increments when Milestone Orchestrator dispatches scoped correction after QA failure.
- max_correction_attempts: default 2 unless mission/milestone contract says otherwise.
- last_validation_result: latest QA verdict, blocking failures, evidence links, and recommended correction scope.
- correction scope owner: Milestone Orchestrator
- blocked-report trigger: retry exhausted, missing dependency/credential/environment, unreproducible failure, or human decision required.
- evidence required before revalidation: correction summary, changed paths/artifacts, commands/manual QA rerun, and owner authorization where applicable.

## Notes For Future Automation

List anything a future skill/plugin should automate.
