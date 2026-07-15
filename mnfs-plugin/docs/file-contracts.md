# File Contracts

## Purpose

Define MNFS artifact ownership, required metadata, lifecycle expectations, and anti-bloat rules.

## Ownership Matrix

| File | Primary owner | Review / handoff |
| --- | --- | --- |
| `mission.md` | Mission Strategist | Human owner may accept or redirect. |
| `mission-validation-contract.md` | Mission Strategist | QA Validator judges mission output against it. |
| `mission-validation-result.md` | QA Validator | Mission Strategist records closeout handoff after verdict. |
| `research/*.md` | Investigator / research roles | Mission Strategist uses findings for decisions. |
| `execution-guide.md` | Mission Strategist | Milestone Orchestrator owns milestone execution guides during execution. |
| `milestone.md` | Mission Strategist | Later owned by Milestone Orchestrator during execution. |
| `milestone-validation-contract.md` | Mission Strategist | The milestone-reviewer cold crew judges milestone output against it. |
| `milestone-validation-result.md` | Milestone gate (milestone-reviewer crew) | Milestone Orchestrator consumes verdict for correction routing. |
| `feature.md` | Mission Strategist | Milestone Orchestrator dispatches it to execution. |
| `spec.md` | Feature Implementer | Milestone Orchestrator may reject or request revision. |
| `plan.md` | Feature Implementer | Milestone Orchestrator may reject or request revision. |
| `validation.md` | Feature Implementer | Reviewed and accepted/rejected/blocked by Milestone Orchestrator. |
| `corrections/correction-task.md` | Milestone Orchestrator | QA Validator supplies failure evidence; Correction Worker executes scoped correction; QA Validator revalidates. |
| Correction feature folders | Milestone Orchestrator | QA Validator supplies failure evidence; Correction Worker executes scoped correction; QA Validator revalidates. |
| `blocked-report.md` | Orchestrator or Validator | Human owner resolves or redirects. |

This matrix names each artifact by its template identity. Generated validation files stay path-scoped: mission and milestone validation contracts and results are written as `validation-contract.md` and `validation-result.md` inside their own folder (see Canonical Template Paths).

## Required Metadata

Every operational artifact starts with:

```yaml
id:
type:
status:
owner:
parent:
created:
updated:
validation_level:
lifecycle_scope:
```

Rules:

- `id` uses the MNFS identifier when one exists, such as `MIS-01`, `M-01`, or `F-01`. Blocked reports use a `B-<nn>` id.
- `type` must be one of: `mission`, `mission-validation-contract`, `mission-validation-result`, `research`, `milestone`, `milestone-validation-contract`, `milestone-validation-result`, `execution-guide`, `feature-brief`, `feature-spec`, `feature-plan`, `feature-validation`, `correction-task`, `correction-feature`, `blocked-report`.
- `status` must use [state-model.md](state-model.md) where the artifact maps to mission, milestone, or feature lifecycle status.
- `owner` names the accountable role, not a tool.
- `parent` records the parent ID, or `none` for a mission root.
- `created` and `updated` use `YYYY-MM-DD`.
- `validation_level` uses [validation-system.md](validation-system.md) QA levels: `QA-0` through `QA-4`.
- `lifecycle_scope` must be one of: `mission`, `milestone`, `feature`, or `support`. Validation contracts and results carry the `lifecycle_scope` of the artifact they validate (`mission`/`milestone`/`feature`); `support` is for cross-cutting artifacts not bound to one lifecycle layer, such as `blocked-report`.

## Artifact Lifecycle Scope

- Mission, milestone, and feature artifacts use the lifecycle statuses defined in [state-model.md](state-model.md).
- Lifecycle-support artifacts (`research`, `execution-guide`, validation contracts, validation results, `correction-task`, and `blocked-report`) mirror the owning artifact's lifecycle status unless their template defines a more specific initial status such as `draft`, `validating`, `correction_needed`, or `blocked`. Their `lifecycle_scope` still names the layer they belong to, per the rule above.
- `blocked-report` always records a blocked state and does not advance on its own.
- `correction-task` and `correction-feature` are owned by the milestone correction loop and must not invent independent lifecycle transitions.
- Feature planning does not create `spec.md`, `plan.md`, or `validation.md`; feature execution creates or updates them after the brief is accepted.

## Artifact Lifecycle

- Mission planning creates `mission.md`, mission validation contract, research notes as needed, milestone briefs, feature briefs, and execution guidance.
- Mission and milestone validation create/update their validation contract and validation result artifacts as separate files.
- Feature execution creates or updates `spec.md`, then `plan.md`, then `validation.md`.
- Milestone validation uses feature evidence plus the milestone validation contract.
- Mission validation uses milestone results plus the mission validation contract.
- Blocked states require `blocked-report.md` when progress depends on human decision, unavailable dependency, or exhausted retry policy.

## Handoff Sections

Operational files should include a handoff section that names:

- current status;
- next owner;
- next action;
- required files or evidence;
- blockers or open decisions.

The mission handoff may additionally name the current owner and split required artifact paths from required evidence paths.

## Anti-Bloat Rule

- Mission, milestone, and feature files summarize decisions and link evidence.
- Keep exploratory detail to max 5 bullets or about 150 words per section.
- If there are repeated alternatives, long source notes, command logs, or more than 5 evidence bullets, move detail to `research/`, `validation.md`, or linked artifacts.
- Keep operational files focused on current decision, status, next action, and evidence links.

## Canonical Template Paths

- Template filenames may be prefixed for clarity when multiple artifact types share a base name.
- Generated artifact paths stay path-scoped: mission and milestone validation contracts/results live in the mission or milestone folder as `validation-contract.md` and `validation-result.md`.
- A plugin or scaffold must not invent alternate filenames once the canonical target path has been chosen.
