# Milestone Validation Contract

```yaml
id: M-00
type: milestone-validation-contract
status: planned
owner: Mission Strategist
parent: MIS-00
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0
lifecycle_scope: milestone
```

## Milestone ID

M-00-milestone-name

## QA Level

QA-0 | QA-1 | QA-2 | QA-3 | QA-4

## Required Outcome

Define what must be true when this milestone passes.

## Criteria

Use the validation criterion grammar from `validation-system.md`.

```markdown
## Criterion: <name>
ID: <stable code, e.g. M-01-C03; immutable>
Level: Milestone
Type: Functional | Engineering | Architecture | QA | Documentation | Security | Performance
Required: Yes | No
Status: Pending | Pass | Fail | Blocked | Not run
Evidence:
- Command:
- Expected:
- Actual:
- Artifact:
Blocking failure:
Blocking failure observed: Yes | No
Drive (UI — agent-browser; UI criteria only; omit for non-UI):
- Fixture: <pinned seed — roster (id/username/role) + password; one canonical set per milestone>
- Steps:
  - open <url>
  - fill <label|@ref> "<value>"
  - click <label|@ref>
  - assert url ~ <pattern>
  - assert text "<expected>"
- Expected: <user-observable outcome>
Owner: QA Validator
```

## Evidence Requirements

- Required criteria must include actual evidence before milestone advancement.
- Evidence may include tests, lint, typecheck, build, CI, migrations, browser/app flows, screenshots, logs, integration output, or manual QA notes.
- Missing required evidence blocks advancement.

## Blocking Failures

Summarize per-criterion blocking failures and list any global blockers not tied to a single criterion. A failed blocking criterion blocks advancement until corrected or formally re-scoped, regardless of `Required` value.

## Retry Policy

Default: up to 2 correction attempts, then create `blocked-report.md`.

Track:

- correction_attempts:
- max_correction_attempts: 2
- last_validation_result:

## Handoff

- Current status: `planned`
- Next owner: Milestone Orchestrator or QA Validator
- Next action: Prepare milestone validation result or dispatch correction.
- Required files/evidence: milestone validation result, feature evidence, correction scope if failed
- Blockers or open decisions:
