# Milestone Validation Contract Reference

## Purpose

Use this reference when defining milestone-level validation criteria during Mission Planning.

## Load When

Load only when the write set includes `MIS-<nn>-<slug>/M-<nn>-<slug>/validation-contract.md`.

## Target Path

`MIS-<nn>-<slug>/M-<nn>-<slug>/validation-contract.md`

## Required Metadata

```yaml
id: M-<nn>
type: milestone-validation-contract
status: planned
owner: Mission Strategist
parent: MIS-<nn>
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0 | QA-1 | QA-2 | QA-3 | QA-4
lifecycle_scope: milestone
```

## Artifact Shape

~~~markdown
# Milestone Validation Contract

```yaml
id: M-<nn>
type: milestone-validation-contract
status: planned
owner: Mission Strategist
parent: MIS-<nn>
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0
lifecycle_scope: milestone
```

## Milestone ID

## QA Level

## Required Outcome

## Criteria

## Criterion: <name>
ID: <stable code, e.g. M-01-C03; immutable>
Level: Milestone
Type: Functional | Engineering | Architecture | QA | Documentation | Security | Performance
Required: Yes | No
Status: Pending
Evidence:
- Command:
- Expected:
- Actual:
- Artifact:
Blocking failure:
Blocking failure observed: No
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

## Evidence Requirements

## Blocking Failures

## Retry Policy

- correction_attempts:
- max_correction_attempts: 2
- last_validation_result:

## Handoff

- Current status:
- Next owner:
- Next action:
- Required files/evidence:
- Blockers or open decisions:
````

## Writing Rules

- Criteria must prove milestone integration, not individual feature intent only.
- Assign every criterion a stable, unique `ID` and never renumber it; feature context packs reference criteria by this ID.
- Any quality attribute the mission targets for this milestone has ≥1 criterion here, typed `Performance` / `Security` / etc., with a concrete observable target (a number, a status code, or a named control) — never a generic stand-in.
- `Expected:` names concrete observable values — exact status code, JSON shape/field values, or precise UI location/text. Never use a generic verb as a stand-in for the value: write `from_value='open', to_value='in_progress'`, not "correct from/to"; write "409 in a red banner above the status selector", not "surfaces inline". Banned stand-ins: `correct`, `works`, `proper`, `valid`, `handles`, `inline`.
- Keep status `Pending` during planning.
- Use QA Validator as verdict owner.
- Include retry policy fields without consuming attempts during planning.

## Anti-Bloat Boundary

- Do not include actual validation result evidence.
- Do not assign correction work before QA reports failure.
- Do not repeat feature-level quick validation details.

## Validation Check

- Every criterion has a stable, unique `ID`.
- Required outcome maps to criteria.
- Each quality attribute this milestone owns is covered by ≥1 criterion with a concrete observable target.
- Criteria name expected evidence and blocking failure.
- No `Expected:` uses a generic stand-in (`correct`/`works`/`proper`/`valid`/`handles`/`inline`) in place of a concrete observable value.
- Retry fields exist and do not record a consumed attempt during planning.
````
