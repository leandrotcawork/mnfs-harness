# Feature Brief Reference

## Purpose

Use this reference when creating a lightweight feature brief during Mission Planning.

## Load When

Load only when the write set includes `MIS-<nn>-<slug>/M-<nn>-<slug>/F-<nn>-<slug>/feature.md`.

## Target Path

`MIS-<nn>-<slug>/M-<nn>-<slug>/F-<nn>-<slug>/feature.md`

## Required Metadata

```yaml
id: F-<nn>
type: feature-brief
status: briefed
owner: Mission Strategist
parent: M-<nn>
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0 | QA-1 | QA-2 | QA-3 | QA-4
lifecycle_scope: feature
```

## Artifact Shape

~~~markdown
# F-<nn>-<slug>

```yaml
id: F-<nn>
type: feature-brief
status: briefed
owner: Mission Strategist
parent: M-<nn>
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0
lifecycle_scope: feature
```

## Mission

## Milestone

## Brief

## Inputs

## Expected Output

## Constraints

## Validation Expectations

## Execution Artifact Rules

`spec.md`, `plan.md`, and `validation.md` are created during feature execution, not mission planning.

## Handoff

- Current status:
- Next owner:
- Next action:
- Required files/evidence:
- Blockers or open decisions:
````

## Writing Rules

- Keep the brief outcome-focused.
- List inputs that the future Feature Implementer needs.
- State constraints and non-goals that prevent scope drift.
- State contract-derived values definitively — one status, one shape, one code per case. Never hedge with "X or Y" (e.g. "400 or 409"); resolve it against the interface contract and name the single value.
- Add boundary-driven adapt-in sections (mandatory when the type applies, mirroring the mission-planning density rules): **Inputs/Outputs** for API/data/event/file-format features (exact request/response shape, fields, status codes — reference the interface contract, do not restate it); **Negative Scenarios** for any feature with invalid-path behavior, including internal helpers that can fail (name the failure trigger, the rejection/rollback behavior, and the error code); **State Model** or **Interaction Model** for UI features where ownership, refetch, or stale-state could drift.
- Validation expectations name the minimum inspectable proof at feature quick-validation level — the concrete observable (exact status code, JSON shape/field values, or visible UI result), not where the evidence will live. "Transcripts in validation.md" is a location, not a proof.

## Anti-Bloat Boundary

- Do not write `spec.md`, `plan.md`, or `validation.md`.
- Do not include step-by-step implementation instructions.
- Do not record milestone acceptance or QA verdicts.

## Validation Check

- Brief, inputs, expected output, constraints, validation expectations, and handoff are filled.
- Validation expectations name concrete observables (status / shape / field values / visible result), not file locations or generic labels.
- Boundary-required adapt-in sections are present (Inputs/Outputs, Negative Scenarios, State/Interaction Model as the feature type demands).
- No contract value is hedged ("X or Y").
- The feature can start in a fresh session without loading full mission history.
- The next action points to Feature Implementer creating `spec.md`.
````
