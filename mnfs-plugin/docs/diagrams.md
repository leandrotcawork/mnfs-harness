# MNFS Workflow Diagrams

## Topology

```mermaid
flowchart TD
    MIS["MIS-01 Mission"] --> M1["M-01 Milestone"]
    MIS --> M2["M-02 Milestone"]
    M1 --> F1["F-01 Feature"]
    M1 --> F2["F-02 Feature"]
    F1 --> S1["spec.md"]
    F1 --> P1["plan.md"]
    F1 --> V1["validation.md"]
```

## Mission Planning

```mermaid
flowchart TD
    A["Mission request"] --> P0["P0 intake: goal, constraints, non-goals, quality bar, roots"]
    P0 --> P1a["P1a domain capability scan"]
    P1a --> P1b["P1b architecture clarify"]
    P1b --> P1c["P1c quality-attribute and risk scan"]
    P1c --> G1{"P1 clarify STOP gate (single user gate)"}
    G1 -- "Resolved" --> P2["P2 research"]
    G1 -- "Ambiguous: ask user" --> P1a
    P2 --> P3["P3 scope: outcome, ADR-lite spine, milestone headlines"]
    P3 --> P4["P4 architecture / ADR-lite + shared interface contracts"]
    P4 --> P5["P5 decompose: milestone bodies + feature briefs"]
    P5 --> P6["P6 validation contracts (mission + milestone)"]
    P6 --> P7["P7 readiness gate: cold mission-reviewer crew (binary)"]
    P7 --> V{"Readiness verdict"}
    V -- "Ready" --> R["status: planned (ready for execution)"]
    V -- "Needs revision" --> P5
    V -- "Blocked" --> B["Mission blocked: owner decision"]
```

## Feature Execution Loop

```mermaid
flowchart TD
    A["Orchestrator dispatches feature (mode: full)"] --> B["Fresh feature session"]
    B --> C["Read feature brief and contracts"]
    C --> D["Write spec.md"]
    D --> E["Write plan.md"]
    E --> S{"at planned: build_large(plan)?"}
    S -- "single (small)" --> F["Implement (same session)"]
    S -- "split (large): record split_decision, STOP at planned" --> T["Orchestrator dispatches build session (mode: build)"]
    T --> U["Fresh ctx: read spec.md + plan.md only"]
    U --> F
    F --> G["Run quick validation"]
    G --> H["Write validation.md"]
    H --> I{"Feature outcome"}
    I -- "Evidence satisfies spec" --> J["quick_validation_passed: return result to milestone"]
    J --> N{"Milestone Orchestrator review"}
    N -- "Accepts evidence and scope" --> O["accepted: integrate with milestone"]
    N -- "Rejects spec, plan, or scope" --> L
    N -- "Missing evidence or blocker" --> M
    I -- "Small same-session fixup and attempts remain" --> K["Increment fixup_attempts"]
    K --> F
    I -- "Spec, plan, or scope must change" --> L["rejected: re-dispatch from brief/spec/plan"]
    L --> B
    I -- "Missing context, dependency, decision, or retry limit reached" --> M["blocked: escalate to Milestone Orchestrator"]
```

## Milestone Validation And Correction

```mermaid
flowchart TD
    A["All features complete"] --> B["Run milestone gate"]
    B --> C{"Pass?"}
    C -- "Yes" --> D["Advance to next milestone"]
    C -- "No" --> E["Create correction task or correction feature"]
    E --> F["Correction worker"]
    F --> G["Re-run milestone gate"]
    G --> H{"Pass?"}
    H -- "Yes" --> D
    H -- "No, retries left" --> E
    H -- "No, retry limit reached" --> I["blocked-report.md"]
```

## Mission Completion

```mermaid
flowchart TD
    A["All milestones passed"] --> B["Run mission gate"]
    B --> C{"Milestone gate verdict"}
    C -- "Pass" --> D["Mission complete"]
    C -- "Fail: correction is scoped" --> E["Mission Strategist routes correction"]
    E --> F["Return to mission in_progress or milestone correction"]
    F --> B
    C -- "Fail: owner decision needed" --> G["Mission blocked"]
    G --> H{"Owner decision"}
    H -- "Resolve and authorize re-validation" --> B
    H -- "Abandon" --> I["Mission abandoned"]
```

## Lifecycle State: Mission

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> planned
    draft --> abandoned
    planned --> in_progress
    planned --> blocked
    planned --> abandoned
    in_progress --> validating
    in_progress --> blocked
    in_progress --> abandoned
    validating --> complete: QA pass
    validating --> in_progress: QA fail, correction scoped
    validating --> blocked: QA fail, owner decision needed
    validating --> abandoned
    blocked --> planned
    blocked --> in_progress
    blocked --> validating: resolution evidence + owner authorization
    blocked --> abandoned
    complete --> [*]
    abandoned --> [*]
```

## Lifecycle State: Milestone

```mermaid
stateDiagram-v2
    [*] --> planned
    planned --> ready
    planned --> skipped
    planned --> blocked
    ready --> in_progress
    ready --> skipped
    ready --> blocked
    in_progress --> validating: ready for QA
    in_progress --> blocked
    validating --> passed: QA pass
    validating --> correction_needed: QA fail, attempts remain
    validating --> blocked: QA fail, retry limit or blocker
    correction_needed --> in_progress: dispatch correction, increment attempts
    correction_needed --> blocked: attempts >= max
    correction_needed --> skipped
    blocked --> ready
    blocked --> in_progress
    blocked --> validating: evidence + orchestrator or human owner authorization
    blocked --> skipped
    passed --> [*]
    skipped --> [*]
```

## Lifecycle State: Feature

```mermaid
stateDiagram-v2
    [*] --> briefed
    briefed --> spec_ready
    briefed --> blocked
    briefed --> rejected
    spec_ready --> planned
    spec_ready --> blocked
    spec_ready --> rejected
    planned --> in_progress
    planned --> blocked
    planned --> rejected
    in_progress --> quick_validating: run quick checks
    in_progress --> blocked
    in_progress --> rejected
    quick_validating --> quick_validation_passed: evidence satisfies spec
    quick_validating --> rejected: revise spec, plan, or scope
    quick_validating --> blocked: missing input or retry limit
    quick_validating --> in_progress: same-session fixup, attempts remain
    quick_validation_passed --> accepted: Milestone Orchestrator accepts
    quick_validation_passed --> rejected: Milestone Orchestrator rejects
    quick_validation_passed --> blocked: Milestone Orchestrator blocks
    rejected --> briefed
    rejected --> spec_ready
    rejected --> planned
    rejected --> blocked
    blocked --> briefed
    blocked --> spec_ready
    blocked --> planned
    blocked --> in_progress
    blocked --> quick_validating
    blocked --> rejected
    accepted --> [*]
```
