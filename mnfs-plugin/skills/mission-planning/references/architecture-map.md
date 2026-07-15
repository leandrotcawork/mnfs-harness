# Architecture Map Card

Use only when the mission meets the diagram trigger. Target path: `<mission-root>/architecture-map.md`.

A view of the contracts — never a parallel source of truth. Interface contracts + ADRs + runtime topology stay authoritative; this file visualizes them.

## Trigger (create the artifact iff ≥1 holds)

1. Two or more runtime surfaces communicate across a seam (client / server / store).
2. A stateful lifecycle has three or more states/transitions.
3. Milestone or feature dependency order is non-linear (parallel tracks or fan-out).

Single-surface, linear, stateless missions skip this artifact — no decoration.

## Views (include only those that apply)

### Topology (trigger 1) — `graph TD`
```mermaid
graph TD
  client["Client :PORT"] -->|HTTP /api| server["Server :PORT"]
  server --> store[("Store")]
```

### Behavior flow (request/response crosses a seam) — `sequenceDiagram`
```mermaid
sequenceDiagram
  actor User
  User->>Client: action
  Client->>Server: METHOD /api/path
  Server->>Store: query/write
  Store-->>Server: rows
  Server-->>Client: status + body
  Client-->>User: visible result
```

### Lifecycle (trigger 2) — `stateDiagram-v2`
```mermaid
stateDiagram-v2
  [*] --> stateA
  stateA --> stateB: trigger
  stateB --> stateC: trigger
```

### Build order (trigger 3) — `graph LR`
```mermaid
graph LR
  M01[M-01] --> M02[M-02]
  M01 --> M03[M-03]
  M02 --> M04[M-04]
  M03 --> M04
```

## Truthfulness rules

- Node/edge labels must match interface-contract operation names, ports, and route prefixes.
- State nodes must match the IC enum exactly.
- Build-order edges must match milestone dependencies.
- mission.md's architecture section links here; execution never reads this file for semantics.
- The reviewer checks this map under ★2 Consistency; drift is a defect.
