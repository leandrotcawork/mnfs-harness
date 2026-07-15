# MNFS Artifact Topology

Canonical path conventions for MNFS missions. Resolve every artifact path from here before writing or reporting paths.

## Roots

- **Workspace root** — the directory the operator works in (from `$ARGUMENTS` or cwd).
- **Mission artifact root** — `<workspace>/.mnfs/MIS-<nn>-<slug>/`. Planning artifacts live under `.mnfs/` so they never mix with implementation source. No `missions/`/`milestones/`/`features/` wrapper directories: the ID chain `MIS-<nn> → M-<nn> → F-<nn>` IS the directory nesting.
- **Implementation roots** — created at the workspace root (for example `<workspace>/frontend/`, `<workspace>/backend/`), never inside `.mnfs/`.

## Mission tree

```text
<workspace>/.mnfs/MIS-<nn>-<slug>/
  mission.md
  validation-contract.md
  validation-result.md
  research/
    <topic>.md
    <topic>-interface-contract.md
  M-<nn>-<slug>/
    milestone.md
    validation-contract.md
    validation-result.md
    execution-guide.md
    corrections/correction-task.md
    F-<nn>-<slug>/
      feature.md
      spec.md
      plan.md
      validation.md
```

## Evidence paths

- Feature execution evidence: `<feature-root>/validation.md`
- Milestone QA rollup: `<milestone-root>/validation-result.md`
- Mission QA rollup: `<mission-root>/validation-result.md`

## Rules

- IDs are stable after creation; slugs are short, lowercase, descriptive.
- Generated artifact paths stay path-scoped; do not invent alternate filenames once a canonical target exists.
- `.mnfs/` is the only planning-state location. No hidden state elsewhere.
- Dry-run resolves and reports these paths but writes nothing.
- `spec.md`, `plan.md`, and `validation.md` are created during feature execution, not mission planning.
