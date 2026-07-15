---
name: feature-context-pack
description: Use this skill when a Milestone Orchestrator needs to prepare a minimal fresh-session context pack for exactly one MNFS feature before Feature Implementer work begins.
---

# MNFS Feature Context Pack

## Purpose

Prepare one minimal handoff packet that lets a Feature Implementer run in a fresh session without loading broad mission history.

This skill is a context-pack workflow, not implementation. Milestone Orchestrator owns feature dispatch. Feature Implementer owns `spec.md`, `plan.md`, implementation, and `validation.md`.

## Required Inputs

- Mission path.
- Milestone path or milestone ID.
- Feature path or feature ID.
- Feature `feature.md` brief.
- Relevant milestone constraints plus the verbatim milestone validation-contract criteria IDs (each with its observable) this feature must satisfy. Copy the criteria; do not paraphrase them — the implementer must build to the exact bar QA will later judge.
- Consume-only contracts: shared interface contracts or seams owned elsewhere that this feature must consume and must not redefine (path + section anchor).
- Owner-reserved decisions this feature must not make on its own (block instead of assuming).
- Relevant mission constraints only when they affect this feature.
- Allowed paths or ownership boundaries, or the explicit owner decision still needed to define them.
- Known evidence, blockers, dependencies, or open decisions.

## Inspect

Inspect only what is needed for this feature handoff:

- assigned feature `feature.md`;
- parent milestone brief, validation contract, and execution guide excerpts that constrain the feature;
- parent mission constraints only when referenced by the milestone or feature;
- directly relevant evidence files named by the feature brief or milestone handoff.

Do not load development docs, prompt docs, agent files, skill files, package scaffold, unrelated milestones, unrelated features, or full mission history as runtime dependencies.

## Workflow

1. Confirm mission, milestone, and feature identity.
2. Confirm the feature is ready for Feature Implementer work or name the blocker.
3. Gather only the feature brief, constraints, allowed paths or ownership boundaries, validation expectations, dependencies, and known evidence needed for this feature.
4. Separate facts, assumptions, missing evidence, constraints, and out-of-scope work.
5. Produce a fresh-session context pack with (binding constraints first):
   - feature ID/path;
   - feature outcome;
   - verbatim milestone validation-contract criteria IDs (with observable) this feature must satisfy — copied, not paraphrased;
   - consume-only contracts: shared seams to consume and not redefine (path + anchor);
   - owner-reserved decisions: decisions to block on, not assume;
   - allowed paths or ownership boundaries;
   - required inputs;
   - relevant constraints and non-goals;
   - known evidence or dependencies;
   - expected return artifacts: `spec.md`, `plan.md`, changed paths, and `validation.md`.
6. Order the pack with the load-bearing constraints first (criteria IDs, consume-only contracts, owner-reserved decisions) before background; keep it short enough to paste into a fresh session and within a tight budget. Lead with the few binding constraints rather than dumping whole artifacts, so the one constraint that matters is not buried mid-context.
7. Stop and report blocked when the required feature brief, parent constraints, verbatim milestone criteria IDs, consume-only contract references, validation expectations, or the owner decision needed to define allowed paths or ownership boundaries is missing.

## Reference Routing

Load only references needed for the current write set:

- `references/feature.md` when updating the feature handoff section.
- `references/execution-guide.md` when updating milestone feature dispatch notes.

Do not load references when returning a context pack without file writes.

## Allowed Outputs

With explicit write, apply, or create approval, update:

- feature `feature.md` handoff section;
- milestone `execution-guide.md` feature dispatch section.

Do not create or update feature `spec.md`, `plan.md`, implementation files, or `validation.md`.

## Hard Limits

- Do not implement the feature.
- Do not expand feature scope.
- Do not copy full mission history.
- Do not mark the feature accepted.
- Do not issue QA verdicts.
- Do not require development docs, prompt docs, skill files, agent files, or package scaffold at runtime.

## Context Rules

- Prefer artifact paths and concise constraints over copied prose, with one exception: copy the milestone validation-contract criteria IDs (and their observables) verbatim — never summarize the bar the feature is judged against.
- For each boundary this feature crosses, cite the exact consume-only contract slice (path + section anchor) so the implementer consumes the seam instead of re-inventing it.
- Lead the pack with the load-bearing constraints; keep background minimal so the binding constraint is not lost in the middle of a long pack.
- Keep research, architecture, or prior investigation notes to the minimum needed for this feature.
- Name missing context instead of inventing it.
- If allowed paths or ownership boundaries are not yet defined, name the exact owner decision required instead of inventing one.
- Name owner-reserved decisions explicitly so the implementer blocks on them rather than assuming.
- Include out-of-scope boundaries whenever scope drift is likely.

## Planning Validation

Before handing off, verify:

- exactly one feature is named;
- feature brief is inspectable;
- parent constraints are sufficient;
- the verbatim milestone validation-contract criteria IDs this feature must satisfy are present and copied, not paraphrased;
- consume-only contracts (seams owned elsewhere) are named with path + anchor;
- owner-reserved decisions the feature must not make are named;
- allowed paths or ownership boundaries are explicit, or the exact owner decision still required to define them is named;
- validation expectations are explicit;
- expected return artifacts are listed;
- next owner is Feature Implementer.

## Stop / Block

Stop and report blocked when:

- feature path or ID is missing;
- feature brief cannot be inspected;
- parent milestone constraints are unavailable;
- the verbatim milestone validation-contract criteria IDs this feature must satisfy are unavailable;
- consume-only contract references the feature must honor are unavailable;
- validation expectations are missing;
- allowed paths or ownership boundaries are required for safe dispatch but neither they nor the exact owner decision needed to define them are available;
- owner decision needed to define allowed paths or ownership boundaries is unavailable before dispatch.

## Output

Use:

- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff

The output must explicitly include:

- feature ID/path;
- feature outcome;
- verbatim milestone validation-contract criteria IDs (with observable) the feature must satisfy — copied, not paraphrased;
- consume-only contracts: shared seams to consume and not redefine (path + anchor);
- owner-reserved decisions: decisions the feature must block on, not assume;
- required inputs used for the handoff;
- allowed paths or ownership boundaries, or the exact missing owner decision needed to define them;
- relevant constraints and non-goals;
- validation expectations;
- known evidence, blockers, or dependencies;
- expected return artifacts: `spec.md`, `plan.md`, changed paths, and `validation.md`;
- next owner: Feature Implementer.
