---
name: feature-validation-review
description: Use this skill when a Milestone Orchestrator needs to review one returned MNFS feature output against its brief, spec, plan, changed paths, quick validation evidence, and milestone constraints before accepting, rejecting, or blocking it.
---

# MNFS Feature Validation Review

## Purpose

Review one returned feature output for milestone integration. This is Milestone Orchestrator acceptance review, not a QA Validator verdict. Acceptance is evidence-bound: do not accept a feature whose load-bearing acceptance criteria rest on `assumed`/`could-not-run` evidence or lack a cited `ran` artifact, and route any auth/PII/secret/multi-role or high cross-feature integration feature to independent QA Validator formal feature review before acceptance. The independent milestone gate re-checks all accepted evidence later, so acceptance must feed it honest, citable inputs.

## Required Inputs

- Feature path.
- `feature.md` brief.
- `spec.md`.
- `plan.md`.
- `validation.md`.
- Changed paths or implementation summary.
- Relevant milestone brief and milestone validation contract constraints.
- Relevant mission constraints when they affect this feature.

## Inspect

Inspect only the artifacts needed for this feature review:

- feature `feature.md`;
- feature `spec.md`;
- feature `plan.md`;
- feature `validation.md`;
- changed paths or changed-path summary;
- milestone constraints referenced by the feature or validation evidence;
- `../../docs/shared-standards.md`, `../../docs/state-model.md`, `../../docs/validation-system.md`, and `../../docs/file-contracts.md` when state or evidence rules are unclear.

Do not load prompt drafts as runtime workflow instructions.
Do not inspect unrelated features unless the returned work claims integration with them.

## Workflow

1. Confirm feature identity, parent milestone, current status, and expected return point.
2. Confirm `feature.md`, `spec.md`, `plan.md`, and `validation.md` are present and inspectable.
3. Separate confirmed facts, missing evidence, assumptions, risks, and the acceptance recommendation.
4. Compare `spec.md` to the original feature brief.
5. Compare `plan.md` to the implemented or changed paths.
6. Compare `validation.md` evidence to the spec, feature acceptance criteria, and relevant milestone constraints.
7. Check that changed paths stay inside feature scope or have an explicit justification.
8. Recommend `accepted` only when scope, implementation evidence, and quick validation are sufficient for milestone integration AND every load-bearing acceptance criterion is proven by `ran` evidence with a cited artifact. Never accept on `assumed`/`could-not-run` evidence; route auth/PII/secret/multi-role or high-integration features to independent QA Validator review before acceptance.
9. Recommend `rejected` when the feature brief, spec, plan, or implementation must be revised before integration.
10. Recommend `blocked` when missing evidence, dependency, validation access, or owner decision prevents acceptance or rejection.
11. Include the return point when rejected: `briefed`, `spec_ready`, or `planned`.
12. Include the re-entry point when blocked: `briefed`, `spec_ready`, `planned`, `in_progress`, `quick_validating`, or `rejected`.
13. Hand back to Milestone Orchestrator with the decision, evidence, risks, and next owner.

## Reference Routing

Load only references needed for the current write set:

- `references/feature.md` when updating feature status or handoff fields.
- `references/feature-validation.md` when writing the milestone acceptance review section.
- `references/execution-guide.md` when updating milestone integration handoff notes.

## Allowed Outputs

With explicit write, apply, or create approval, update:

- feature `validation.md` milestone acceptance review section;
- feature `feature.md` status or handoff section;
- milestone `execution-guide.md` integration handoff section.

Do not edit implementation files, feature `spec.md`, feature `plan.md`, or quick-validation evidence during acceptance review.

## Hard Limits

- Do not implement fixes.
- Do not issue milestone pass/fail verdicts.
- Do not accept missing required evidence.
- Do not accept on `assumed` or `could-not-run` evidence, or without a cited `ran` artifact.
- Do not self-accept an auth/PII/security-surface or high-integration feature without independent QA Validator review.
- Do not change validation criteria to fit the output.
- Do not turn formal QA into Milestone Orchestrator acceptance.
- Do not require runtime prompt docs.

## Context Rules

- Keep the review focused on one feature.
- Link evidence instead of copying long logs.
- Report changed paths explicitly.
- Keep rejected and blocked outcomes actionable by naming the return point and missing input.

## Review Validation

Before handing off, verify:

- `feature.md`, `spec.md`, `plan.md`, and `validation.md` were inspected;
- changed paths are listed or linked;
- evidence/commands are named;
- decision is exactly `accepted`, `rejected`, or `blocked`;
- no `accepted` decision rests on `assumed`/`could-not-run` evidence or an uncited artifact;
- auth/PII/security-surface or high-integration features were routed to independent QA Validator review before acceptance;
- rejected or blocked decisions include a return point;
- formal QA needs, if any, are routed to QA Validator.

## Stop / Block

Stop and report blocked when:

- the feature path is missing;
- required feature artifacts cannot be inspected;
- changed paths or validation evidence are missing;
- milestone constraints needed for review are unavailable;
- the decision requires QA Validator or human owner input.

## Output

Use:

- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff
