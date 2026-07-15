# Mission Artifact Card

Use when writing `<mission-root>mission.md`.

## Metadata

```yaml
id: MIS-<nn>
type: mission
status: draft | needs_revision | planned | in_progress | validating | blocked | complete | abandoned
owner: Mission Strategist
parent: none
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0 | QA-1 | QA-2 | QA-3 | QA-4
lifecycle_scope: mission
planning_phase: intake | clarify | scope | architecture | decompose | validation | ready
```

## Mandatory Spine

~~~markdown
# MIS-<nn>-<slug>

```yaml
id: MIS-<nn>
type: mission
status: draft
owner: Mission Strategist
parent: none
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0
lifecycle_scope: mission
planning_phase: intake
```

## Objective

## Outcome

## Scope

## Domain Scope

Capabilities included from the P1a capability scan, grouped by dimension. Each line names a
dimension and the included capabilities. Excluded capabilities are listed under Non-Scope
with a reason.

## Non-Scope

## Current State

## Clarified Decisions

- Resolved:
- Accepted assumptions: <each forced default the plan adopts without an operator answer — what is assumed and why it is reversible; `None - because <reason>` when the plan invents nothing>
- Owner decisions still open: None - because <reason>
- Blocked items: None - because <reason>

### Clarification Interview

| # | Taxon | Question | Proposed default | Operator answer |
| --- | --- | --- | --- | --- |

Taxon is one of: actor model, lifecycle/transitions, persistence/reset, UI convergence, validation expectations, build/runtime conventions. These are the P1b architecture taxa; they run after the P1a domain capability scan (recorded under `## Domain Scope`). Leave the table empty with a `No blocking ambiguity` note when the clarify gate found nothing to ask.

## Architecture Spine

### System Shape

### Runtime Topology

### Runtime Contract

### Cross-Cutting Decisions

| Decision | Status | Prevents | Must preserve | Validation impact |
| --- | --- | --- | --- | --- |

## Shared Contracts

| Contract | Boundary | Path | Why it exists |
| --- | --- | --- | --- |

## Milestone Strategy

| ID | Name | System change | Why this order | Path |
| --- | --- | --- | --- | --- |

## Quality Attributes

Non-functional bars chosen in the P1c scan, one row each. Declined attributes go under
Non-Functional Scope.

| Attribute | Target (concrete) | Owner (ADR/seam) | Validation criterion |
| --- | --- | --- | --- |

## Non-Functional Scope

| Declined attribute | Reason |
| --- | --- |

## Validation Strategy

## Risks

| id | risk | likelihood (L/M/H) | impact (L/M/H) | mitigation | trigger | owner |
| --- | --- | --- | --- | --- | --- | --- |

## Handoff

- Current status:
- Current owner:
- Next owner:
- Next action:
- Required artifact paths:
- Required evidence paths:
- Blocked decisions: None - because <reason>
```
~~~

## Adapt-Ins

Add only when useful:

- `Product Intent` for user-facing products where feel or workflow matters.
- Mermaid system/workflow diagrams when they compress boundary or flow ambiguity.
- `ADR Summary` for decisions with real tradeoffs (per-decision `Trade-off:` line, when the table's consolidated trade-offs list is not enough).
- `Research Links` when evidence lives in `research/*.md`.
- `Deferred Scope` when future work is tempting enough to cause drift.
- `Migration/Compatibility Notes` for brownfield work.
- `Readiness Checklist Notes` when the mission is near-ready but specific checks still need justification.

## Writing Rules

- Make the objective observable.
- Describe how the system should work, not just what the user requested.
- Architecture spine records decisions and invariants that prevent worker drift.
- Every cross-cutting decision with a real trade-off records its knowingly-accepted negative consequence — either a per-decision `Trade-off:` note or a consolidated `Accepted trade-offs:` list below the table. A decision with no trade-off says so.
- Every in-scope quality attribute (P1c) has a concrete target (a number, a policy, or a named control), an owning ADR/seam, and ≥1 validation criterion. Declined attributes are listed under `## Non-Functional Scope` with a one-line reason. Security on an auth/PII surface is targeted or explicitly declined — never silently absent.
- `## Risks` is a structured register: one row per risk with likelihood, impact, mitigation, trigger, and owner. No bare prose risks.
- Every decision the plan adopts without an operator answer is recorded under `Clarified Decisions` -> `Accepted assumptions:` (what is assumed + why it is reversible). Recording it is enough — a recorded assumption is an accepted, explicit risk. Silently inventing a cross-worker decision without recording it is a traceability defect.
- Runtime topology names roots, processes, stores, and ownership.
- Runtime contract states who owns data, writes, routes, files, and source of truth.
- Milestones are ordered engineering outcomes, not task buckets.
- Shared contracts are required when backend/frontend, producer/consumer, data, UI, route, event, or file-format drift is possible.
- Evidence paths must name concrete artifacts, not generic directories.
- Mission evidence paths should point to final validation result artifacts, not only research notes.
- Keep long rationale in research notes.
- `planning_phase` records the gated-planning state (intake -> clarify -> scope -> architecture -> decompose -> validation -> ready); it is orthogonal to lifecycle `status` and exists so a fresh session can resume planning.

## Good Pattern

```markdown
## Architecture Spine

The system has three boundaries: React browser client, Express API, and SQLite file database.
The browser never reads SQLite. The API is the only writer to SQLite. Ticket field names,
status values, and error shape are fixed in `research/ticket-api-interface-contract.md`.
```

## Bad Pattern

```markdown
## Architecture Spine

Use a generic app architecture with frontend, backend, and database. Later features will
implement the needed details.
```

This is not ready because it does not prevent incompatible worker decisions.

## Validation Check

- Mission explains final behavior and system operation.
- Architecture spine fixes non-obvious cross-worker decisions.
- Each cross-cutting decision with a trade-off records its negative consequence (per-decision or consolidated list).
- Every in-scope quality attribute names a concrete target + owner + ≥1 validation criterion; declined attributes carry a reason; security is not silently absent on an auth/PII surface.
- Risk register is structured (one row per risk with mitigation + owner), not bare prose.
- Every decision adopted without an operator answer is recorded under Accepted assumptions (what + why-reversible); none is silently invented.
- Runtime topology and contracts are concrete.
- Interface contracts exist when shared boundaries exist.
- Milestones have concrete system changes and order reasons.
- Handoff names exact artifact/evidence paths.
