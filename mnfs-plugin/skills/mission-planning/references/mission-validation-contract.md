# Mission Validation Contract Reference

## Purpose

Use this reference when defining the final mission validation contract before milestone execution begins.

## Load When

Load only when the write set includes `MIS-<nn>-<slug>/validation-contract.md`.

## Target Path

`MIS-<nn>-<slug>/validation-contract.md`

## Required Metadata

```yaml
id: MIS-<nn>
type: mission-validation-contract
status: draft
owner: Mission Strategist
parent: MIS-<nn>
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0 | QA-1 | QA-2 | QA-3 | QA-4
lifecycle_scope: mission
```

## Artifact Shape

~~~markdown
# Mission Validation Contract

```yaml
id: MIS-<nn>
type: mission-validation-contract
status: draft
owner: Mission Strategist
parent: MIS-<nn>
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0
lifecycle_scope: mission
```

## Mission ID

## QA Level

## Required Final State

## Criteria

## Criterion: <name>
ID: <stable code, e.g. MIS-01-C03; immutable>
Level: Mission
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
Owner: QA Validator

## Evidence Requirements

## Blocking Failures

## Retry Policy

## Handoff

- Current status:
- Next owner:
- Next action:
- Required files/evidence:
- Blockers or open decisions:
````

## Writing Rules

- Define observable final-state criteria, not implementation wishes.
- Assign every criterion a stable, unique `ID` and never renumber it; feature context packs reference criteria by this ID.
- Every in-scope quality attribute from the mission `## Quality Attributes` table has ≥1 criterion here or in a milestone contract, typed `Performance` / `Security` / etc., with a concrete observable target (e.g. "list endpoint p95 < 200ms over 100 seeded rows, measured by <command>"; "GET with a revoked token → 404"). A targeted attribute with no criterion is a gap.
- `Expected:` names concrete observable values — exact status code, JSON shape/field values, or precise UI location/text — never a generic stand-in (`correct`/`works`/`proper`/`valid`/`handles`/`inline`).
- Set criterion status to `Pending` during planning.
- Use `Owner: QA Validator` for mission verdict criteria.
- Include required evidence types and blocking failure conditions before execution starts.

## Anti-Bloat Boundary

- Do not include actual test output or final verdicts.
- Do not define correction assignments here.
- Link to milestone contracts instead of duplicating every milestone criterion.

## Validation Check

- Every criterion has a stable, unique `ID`.
- Every required final state has at least one criterion.
- Every in-scope quality attribute is covered by ≥1 criterion with a concrete observable target.
- Every required criterion names expected evidence and a blocking failure.
- No `Expected:` uses a generic stand-in (`correct`/`works`/`proper`/`valid`/`handles`/`inline`) in place of a concrete observable value.
- No criterion records a Pass, Fail, or Blocked verdict during mission planning.
````
