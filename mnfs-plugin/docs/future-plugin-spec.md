# Future Plugin/Skill Architecture

## Purpose

This document defines a future MNFS plugin and skill architecture. It is a target architecture only: it does not create a plugin, install skills, or introduce executable automation.

Future MNFS tooling should scaffold, guide, and validate Mission -> Milestone -> Feature workflows. It should reduce repetitive setup, enforce artifact contracts, summarize status, and make validation evidence harder to skip. It must not replace engineering judgment, role ownership, or human decisions when scope, risk, quality, or validation evidence is ambiguous.

The current `outputs/mnfs-workflow` instruction set is the human-authored source for this package. The future layout below is the canonical command/skill surface the plugin would expose when it is eventually packaged.

## Package Goal

The future package should help workers:

- create correctly named MNFS missions, milestones, features, corrections, and validation artifacts;
- generate concise context prompts for fresh feature sessions;
- check required metadata, state transitions, retry fields, and validation evidence;
- report status across tracked workflow files;
- adapt compatible local skills, plugins, and tools inside MNFS rules.

The package should keep MNFS artifacts as the source of truth. Any helper state must be derived from, or written into, tracked workflow files defined by [file-contracts.md](file-contracts.md), [state-model.md](state-model.md), and [validation-system.md](validation-system.md).

## Research Conclusion

[skills-map.md](skills-map.md) concludes that existing skills and plugins should be treated as reuse or adaptation candidates, not as the default MNFS engine. Superpowers, Browser, Context7, GitNexus, GitHub, worktree helpers, and similar tools may be invoked when they fit a phase and satisfy MNFS ownership and validation rules.

Future MNFS skills should not hardcode Superpowers as mandatory behavior. They should describe when compatible skills can be reused, when they must be wrapped by MNFS artifact rules, and when MNFS should proceed without them.

## Future Commands

Command mutation bounds:

- Commands default to dry-run/recommendation mode.
- File writes and status mutations require `--apply` or an equivalent explicit confirmation.
- State updates must follow [state-model.md](state-model.md) allowed transitions.
- `mnfs milestone start` and `mnfs feature accept` may only mutate status fields with explicit apply/confirmation.
- When a template-backed target path is not configured, commands must report the missing target and write nothing hidden.

### `mnfs mission init`

Inputs:

- mission goal or source prompt;
- target mission ID and slug, or permission to allocate the next available ID;
- workspace path;
- optional constraints, QA level, existing evidence, and research notes.

Outputs:

- mission folder scaffold;
- `mission.md`;
- mission `validation-contract.md`;
- optional shared interface-contract research notes when boundaries need them;
- initial milestone and feature brief skeletons when scope is known;
- concise next-step summary.

Files touched:

- `MIS-<nn>-<slug>/mission.md`;
- `MIS-<nn>-<slug>/validation-contract.md`;
- optional `MIS-<nn>-<slug>/research/<topic>-interface-contract.md`;
- optional `MIS-<nn>-<slug>/research/*.md`;
- optional `MIS-<nn>-<slug>/M-<nn>-<slug>/milestone.md`;
- optional `MIS-<nn>-<slug>/M-<nn>-<slug>/validation-contract.md`;
- optional `MIS-<nn>-<slug>/M-<nn>-<slug>/F-<nn>-<slug>/feature.md`.

Non-goals:

- no implementation work;
- no fabricated research or validation evidence;
- no final feature `spec.md`, `plan.md`, or `validation.md` during mission planning.

### `mnfs mission validate`

Inputs:

- mission path;
- mission validation contract;
- milestone verdicts and evidence;
- optional CI, test, browser, or release evidence links as read-only evidence inputs.

Outputs:

- Pass, Fail, or Blocked mission verdict;
- evidence index;
- unresolved risks;
- required correction or blocked-report recommendation.

Files touched:

- `MIS-<nn>-<slug>/validation-result.md` evidence and verdict sections with `--apply`;
- `MIS-<nn>-<slug>/blocked-report.md` when validation cannot advance and the blocked-report template is configured;
- no hidden mission validation notes; report missing template targets instead.

Non-goals:

- no silent pass when required evidence is missing;
- no override of QA Validator ownership;
- no production deployment;
- no release, deployment, or environment mutation from CI/test/browser/release evidence.

### `mnfs mission closeout`

Inputs:

- mission path;
- final mission verdict;
- milestone verdicts and evidence;
- unresolved risks;
- next owner or next-session audience.

Outputs:

- final mission summary;
- evidence index;
- unresolved risks and accepted limitations;
- next-session prompt;
- ownership handoff with next owner, next action, and required files.

Files touched:

- `MIS-<nn>-<slug>/validation-result.md` final evidence index or verdict reference with `--apply`;
- `MIS-<nn>-<slug>/blocked-report.md` if closeout is blocked and the blocked-report template is configured;
- report missing closeout/handoff template target instead of writing hidden state.

Non-goals:

- no deployment or release execution;
- no changing validation verdicts;
- no closing a mission with missing required evidence unless it is explicitly marked blocked.

### `mnfs milestone start`

Inputs:

- mission path;
- milestone ID;
- milestone brief and validation contract;
- feature list, dependencies, and current state.

Outputs:

- readiness summary;
- ordered or safely parallelized feature execution queue;
- fresh-session prompt or context pack for the next feature;
- missing-context or blocker report when the milestone is not ready.

Files touched:

- `MIS-<nn>-<slug>/M-<nn>-<slug>/execution-guide.md` readiness and handoff sections with `--apply`;
- `MIS-<nn>-<slug>/M-<nn>-<slug>/milestone.md` status field with explicit apply/confirmation only;
- `MIS-<nn>-<slug>/M-<nn>-<slug>/F-<nn>-<slug>/feature.md` handoff section for the next feature when the template defines one;
- report missing execution-guide or handoff target instead of creating hidden prompt files.

Non-goals:

- no automatic execution of all features without acceptance gates;
- no dependency-blind parallelization;
- no mission goal redefinition.

### `mnfs milestone validate`

Inputs:

- milestone path;
- milestone validation contract;
- completed feature artifacts and validation evidence;
- correction attempt fields.

Outputs:

- pass, correction_needed, or blocked verdict;
- blocking failure list;
- correction scope recommendation;
- retry accounting update.

Files touched:

- `MIS-<nn>-<slug>/M-<nn>-<slug>/validation-result.md` evidence and verdict sections with `--apply`;
- `MIS-<nn>-<slug>/M-<nn>-<slug>/milestone.md` retry/state fields with `--apply`;
- `MIS-<nn>-<slug>/M-<nn>-<slug>/execution-guide.md` correction scope or handoff section when configured;
- `MIS-<nn>-<slug>/M-<nn>-<slug>/blocked-report.md` when retry limits or external blockers stop progress.

Non-goals:

- no passing without required evidence;
- no broad rewrite recommendation outside the milestone contract;
- no correction execution by the validator command.

### `mnfs feature context`

Inputs:

- mission path;
- milestone ID;
- feature ID;
- relevant parent contracts, feature brief, constraints, and known evidence.

Outputs:

- minimal fresh-session context pack;
- required files list;
- validation commands or evidence expectations;
- explicit out-of-scope boundaries.

Files touched:

- `MIS-<nn>-<slug>/M-<nn>-<slug>/F-<nn>-<slug>/feature.md` context/handoff section only when the feature template defines it and `--apply` is used;
- otherwise no files; print or return the context pack and report missing configured prompt target instead of writing hidden state.

Non-goals:

- no implementation;
- no expansion of feature scope;
- no dumping full mission history into feature context.

### `mnfs feature accept`

Inputs:

- feature path;
- `spec.md`, `plan.md`, and `validation.md`;
- changed-file summary;
- feature acceptance criteria and milestone contract references.

Outputs:

- accepted, rejected, or blocked recommendation;
- missing evidence list;
- risks and follow-up notes;
- state transition recommendation.

Files touched:

- `MIS-<nn>-<slug>/M-<nn>-<slug>/F-<nn>-<slug>/validation.md` acceptance review section with explicit apply/confirmation;
- `MIS-<nn>-<slug>/M-<nn>-<slug>/F-<nn>-<slug>/feature.md` status field with explicit apply/confirmation only;
- `MIS-<nn>-<slug>/M-<nn>-<slug>/execution-guide.md` integration handoff section when configured;
- report missing feature validation or milestone handoff target instead of writing hidden acceptance state.

Non-goals:

- no automatic merge or deployment;
- no acceptance when validation evidence cannot be inspected;
- no rewrite of feature implementation.

### `mnfs correction create`

Inputs:

- failed validation report;
- milestone path;
- correction scope;
- retry count and limit;
- decision on correction task versus correction feature.

Outputs:

- correction task note or correction feature scaffold;
- scoped Correction Worker prompt;
- required evidence and rerun commands;
- updated retry/state fields.

Files touched:

- `MIS-<nn>-<slug>/M-<nn>-<slug>/validation-result.md` correction scope reference with `--apply`;
- `MIS-<nn>-<slug>/M-<nn>-<slug>/milestone.md` retry/state fields with `--apply`;
- `MIS-<nn>-<slug>/M-<nn>-<slug>/execution-guide.md` correction handoff section when configured;
- `MIS-<nn>-<slug>/M-<nn>-<slug>/corrections/correction-task.md`, or `MIS-<nn>-<slug>/M-<nn>-<slug>/F-<nn>-<slug>/feature.md` for a correction feature;
- `MIS-<nn>-<slug>/M-<nn>-<slug>/blocked-report.md` if retry limits are exhausted before creation.

Non-goals:

- no unscoped fixes;
- no new product scope hidden as correction work;
- no reset of retry counters.

### `mnfs status`

Inputs:

- mission path or workspace root;
- optional mission, milestone, or feature filter.

Outputs:

- concise status tree;
- current owner and next action per active artifact;
- blocked items and missing evidence;
- retry counters and validation verdicts.

Files touched:

- none by default;
- optional generated status report only when explicitly requested with a configured tracked output path.

Non-goals:

- no hidden cache as source of truth;
- no status mutation;
- no inference of pass/fail without recorded verdicts.

## Expected Future Package Layout

```text
mnfs-plugin/
  docs/
    prd.md
    agents.md
    skills-map.md
    state-model.md
    validation-system.md
    file-contracts.md
    future-plugin-spec.md
  agents/
    mission-strategist.md
    codebase-investigator.md
    architecture-analyst.md
    external-researcher.md
    improvement-analyst.md
    milestone-orchestrator.md
    feature-implementer.md
    qa-validator.md
    correction-worker.md
  skills/
    mission-planning/SKILL.md
    mission-planning/references/
      mission.md
      mission-validation-contract.md
      research/
      milestone.md
      milestone-validation-contract.md
      feature.md
      research-note.md
    feature-context-pack/SKILL.md
    feature-context-pack/references/
      <artifact-shape>.md
    feature-validation-review/SKILL.md
    feature-validation-review/references/
      <artifact-shape>.md
    milestone-execution/SKILL.md
    milestone-execution/references/
      <artifact-shape>.md
    feature-execution/SKILL.md
    feature-execution/references/
      <artifact-shape>.md
    validation/SKILL.md
    validation/references/
      <artifact-shape>.md
    correction-worker/SKILL.md
    correction-worker/references/
      <artifact-shape>.md
    mission-closeout/SKILL.md
    mission-closeout/references/
      <artifact-shape>.md
  commands/
    mission-init.md
    mission-validate.md
    mission-closeout.md
    milestone-start.md
    milestone-validate.md
    feature-context.md
    feature-accept.md
    correction-create.md
    status.md
```

Template filenames stay prefixed when needed to avoid collisions, but generated artifact paths remain path-scoped inside the mission or milestone folder. For example, `mission-validation-contract.md` scaffolds `MIS-<nn>-<slug>/validation-contract.md`.

## Package Mapping

### Agent Packages

| Role | Agent file | Primary skill(s) | Runtime references |
| --- | --- | --- | --- |
| Mission Strategist | `agents/mission-strategist.md` | `mission-closeout` (agent); `mission-planning` runs in main session via `/mission-init` | `skills/mission-closeout/references/*` |
| Codebase Investigator | `agents/codebase-investigator.md` | research-only handoff support | mission-planning references |
| Architecture Analyst | `agents/architecture-analyst.md` | research-only handoff support | mission-planning references |
| External Researcher | `agents/external-researcher.md` | Context7 and vendor-doc research | mission-planning and feature-context references |
| Improvement Analyst | `agents/improvement-analyst.md` | risk and quality analysis support | mission-planning references |
| Milestone Orchestrator | `agents/milestone-orchestrator.md` | `milestone-execution`, `validation`, `feature-validation-review` | milestone, validation, and feature-review references |
| Feature Implementer | `agents/feature-implementer.md` | `feature-context-pack`, `feature-execution` | feature-context and feature-execution references |
| QA Validator | `agents/qa-validator.md` | `validation`, `feature-validation-review` | validation and feature-review references |
| Correction Worker | `agents/correction-worker.md` | `correction-worker` | correction references |

### Command Surface

| Command | Runtime references | Owner | Notes |
| --- | --- | --- | --- |
| `mnfs mission init` | `skills/mission-planning/references/*` | Mission Strategist | Planning and closeout share the same role, not the same session state. |
| `mnfs milestone start` | `skills/milestone-execution/references/*` | Milestone Orchestrator | Produces the next fresh-session feature packet. |
| `mnfs milestone validate` | `skills/validation/references/*` | Milestone Reviewer crew (QA Validator fallback) | Dispatches the cold reviewer crew, folds the verdict, writes the milestone review + validation result artifacts. |
| `mnfs feature context` | `skills/feature-context-pack/references/*` | Feature Implementer | Returns a minimal fresh-session context pack. |
| `mnfs feature accept` | `skills/feature-validation-review/references/*` | Milestone Orchestrator | Reviews feature output against spec and contract. |
| `mnfs correction create` | `skills/correction-worker/references/*` | Correction Worker | Acts only on a scoped correction assignment. |
| `mnfs mission closeout` | `skills/mission-closeout/references/*` | Mission Strategist | Final handoff and ownership closeout. |
| `mnfs status` | command-only | Milestone Orchestrator | Read-only status aggregation from artifact metadata. |

## Future Skill Layout

```text
skills/
  mission-planning/SKILL.md
  milestone-execution/SKILL.md
  feature-context-pack/SKILL.md
  feature-validation-review/SKILL.md
  feature-execution/SKILL.md
  validation/SKILL.md
  correction-worker/SKILL.md
  mission-closeout/SKILL.md
```

The skill set is intentionally complete at eight roles. Any smaller list is a partial package and should be treated as incomplete for the MNFS base.

### `skills/mission-planning/SKILL.md`

Purpose:

- guide mission discovery, research, milestone decomposition, feature brief creation, and mission validation contract drafting.

Source docs:

- [prd.md](prd.md);
- [agents.md](agents.md);
- [skills-map.md](skills-map.md);
- [state-model.md](state-model.md);
- [validation-system.md](validation-system.md);
- [file-contracts.md](file-contracts.md);
- mission, validation contract, interface-contract, milestone, feature, and research references.

### `skills/feature-context-pack/SKILL.md`

Purpose:

- build a minimal fresh-session context pack for one feature without expanding scope, usually as the implementation-side output of `mnfs feature context`.

Source docs:

- [prd.md](prd.md);
- [agents.md](agents.md);
- [state-model.md](state-model.md);
- [validation-system.md](validation-system.md);
- [file-contracts.md](file-contracts.md);
- feature, milestone, and validation templates.

### `skills/feature-validation-review/SKILL.md`

Purpose:

- review feature output against the spec, feature brief, and milestone contract before milestone integration or QA invocation, usually as the review engine behind `mnfs feature accept`.

Source docs:

- [prd.md](prd.md);
- [agents.md](agents.md);
- [state-model.md](state-model.md);
- [validation-system.md](validation-system.md);
- [file-contracts.md](file-contracts.md);
- feature validation and milestone validation templates.

### `skills/milestone-execution/SKILL.md`

Purpose:

- guide milestone readiness checks, feature ordering, fresh-session dispatch, feature acceptance, integration notes, correction routing, and milestone handoff.

Source docs:

- [prd.md](prd.md);
- [agents.md](agents.md);
- [state-model.md](state-model.md);
- [validation-system.md](validation-system.md);
- [file-contracts.md](file-contracts.md);
- milestone, execution guide, feature, feature validation, correction, and blocked-report templates.

### `skills/feature-execution/SKILL.md`

Purpose:

- guide a Feature Implementer through scoped context intake, `spec.md`, `plan.md`, implementation, quick validation, and concise handoff.

Source docs:

- [prd.md](prd.md);
- [agents.md](agents.md);
- [skills-map.md](skills-map.md);
- [state-model.md](state-model.md);
- [validation-system.md](validation-system.md);
- [file-contracts.md](file-contracts.md);
- feature, feature spec, feature plan, feature validation, and blocked-report templates.

### `skills/validation/SKILL.md`

Purpose:

- guide Feature, Milestone, and Mission validation against explicit contracts, evidence requirements, QA levels, verdict ownership, and blocked advancement rules.

Source docs:

- [prd.md](prd.md);
- [agents.md](agents.md);
- [state-model.md](state-model.md);
- [validation-system.md](validation-system.md);
- [file-contracts.md](file-contracts.md);
- validation contract, feature validation, and blocked-report templates.

### `skills/correction-worker/SKILL.md`

Purpose:

- guide scoped correction work after validation failure, including failure reproduction, retry limits, targeted fixes, rerun evidence, and escalation to blocked state when needed.

Source docs:

- [prd.md](prd.md);
- [agents.md](agents.md);
- [skills-map.md](skills-map.md);
- [state-model.md](state-model.md);
- [validation-system.md](validation-system.md);
- [file-contracts.md](file-contracts.md);
- correction task, correction feature, feature spec, feature plan, feature validation, and blocked-report templates.

### `skills/mission-closeout/SKILL.md`

Purpose:

- close a mission with final evidence, unresolved risks, ownership handoff, and next-session summary, usually as the engine behind `mnfs mission closeout`.

Source docs:

- [prd.md](prd.md);
- [agents.md](agents.md);
- [state-model.md](state-model.md);
- [validation-system.md](validation-system.md);
- [file-contracts.md](file-contracts.md);
- mission validation, blocked-report, and handoff templates.

## Non-Goals

- No autonomous production deployment.
- No silent validation passing.
- No broad rewrite automation.
- No hidden state outside tracked workflow files.
- No replacement of Mission Strategist, Milestone Orchestrator, Feature Implementer, QA Validator, Correction Worker, or human owner judgment.
- No plugin or skill directory implementation in this task.

## Packaging Maturity

### Instruction Runtime

- Publish MNFS agents, commands, skills, and skill-owned references as the runtime package.
- Keep artifacts human-readable and manually editable.
- Use compatible external skills/plugins only when they fit MNFS rules.
- Validate by reviewing generated artifacts and handoffs, not by relying on helper state.

### Conservative Helpers

- Add scaffolding, status, metadata, and validation helpers only after runtime contracts remain stable under real use.
- Keep helpers conservative: report problems before changing state.
- Continue treating tracked workflow files as the source of truth.

### Optional Integrations

- Integrate with Browser, Context7, GitHub, GitNexus, CI, or app-specific tools only when available and relevant.
- Make integrations evidence-producing, not verdict-owning.
- Preserve manual override and blocked-report paths for ambiguous scope, missing dependencies, or exhausted retries.
