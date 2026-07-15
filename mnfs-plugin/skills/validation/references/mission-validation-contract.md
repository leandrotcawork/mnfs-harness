# Mission Validation Contract

```yaml
id: MIS-00
type: mission-validation-contract
status: draft
owner: Mission Strategist
parent: MIS-00
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0
lifecycle_scope: mission
```

## Mission ID

MIS-00-mission-name

## QA Level

QA-0 | QA-1 | QA-2 | QA-3 | QA-4

## Required Final State

List the conditions that must be true at mission completion.

## Criteria

Use the validation criterion grammar from `validation-system.md`.

```markdown
## Criterion: <name>
ID: <stable code, e.g. MIS-01-C03; immutable>
Level: Mission
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
Owner: QA Validator
```

## Evidence Requirements

- Required criteria must include actual evidence before mission completion.
- Evidence may include commands, CI, integration checks, browser/app logs, screenshots, rendered artifacts, or documentation diffs.
- Missing required evidence blocks advancement.

## Blocking Failures

Summarize per-criterion blocking failures and list any global blockers not tied to a single criterion. A failed blocking criterion blocks advancement until corrected or formally re-scoped, regardless of `Required` value.

## Retry Policy

Mission retries are governed by milestone/correction policy unless a human owner explicitly defines a mission-level retry policy. If correction scope is unclear, dependency is unavailable, or retry limits are exhausted, create `blocked-report.md`.

## Handoff

- Current status: `draft`
- Next owner: Mission Strategist or QA Validator
- Next action: Finalize criteria, capture evidence, or hand off to mission validation.
- Required files/evidence: mission validation result, milestone verdicts, evidence links, unresolved risks
- Blockers or open decisions:
