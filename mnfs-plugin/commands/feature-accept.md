---
description: Review and accept, reject, or block an MNFS feature output.
argument-hint: "[FEATURE_PATH] [--apply]"
allowed-tools: Read, Glob, Grep, LS, Write, Edit, MultiEdit, Task
---

# MNFS Feature Accept

Use the Task tool to launch the `milestone-orchestrator` plugin agent. Provide this command body, `$ARGUMENTS`, and the `feature-validation-review` skill workflow as the work instructions. If Task or the plugin agent is unavailable, state that fallback explicitly and execute the same Milestone Orchestrator acceptance-review role in the main session.

Acceptance is evidence-bound, not a rubber stamp. The orchestrator may not wave through unproven evidence: a feature whose load-bearing acceptance criteria rest on `assumed`/`could-not-run` evidence, or lack a cited `ran` artifact, is `rejected` or `blocked` — never accepted. Any feature with an auth/PII/secret/multi-role surface or high cross-feature integration risk routes to independent QA Validator formal feature review before acceptance; the orchestrator must not self-accept these. The independent milestone gate (`/milestone-validate`) re-checks all accepted evidence cold, so acceptance here must feed it honest, citable inputs.
Treat runtime artifact paths as mission/workspace paths supplied by `$ARGUMENTS`. Treat package paths as relative to the plugin root (`mnfs-plugin/`) only when this command names package-owned files.

## Inputs

- feature path from `$ARGUMENTS`;
- feature `feature.md`;
- feature `spec.md`;
- feature `plan.md`;
- feature `validation.md`;
- changed paths and implementation evidence sufficient to inspect actual touched scope;
- relevant milestone execution artifacts carrying milestone constraints and the active validation contract.

The argument-hint stays `[FEATURE_PATH]`: milestone and mission constraints are derivable from it. The feature lives under its milestone directory, which lives under the mission directory, so the milestone path and mission path are resolved by walking up from the supplied feature path. `$ARGUMENTS` consumers must derive milestone/mission constraints this way rather than expecting them as separate arguments.

Runtime rules:

- review exactly one returned feature output for milestone integration;
- inspect `feature.md`, `spec.md`, `plan.md`, `validation.md`, changed paths, implementation evidence, and relevant milestone execution artifacts carrying milestone constraints;
- recommend exactly `accepted`, `rejected`, or `blocked`;
- recommend `accepted` only when changed paths and enough implementation evidence have been inspected to review the actual touched scope;
- do not recommend `accepted` when any load-bearing acceptance criterion's evidence is `assumed` or `could-not-run`, or lacks a cited `ran` artifact (path or pasted output) — such a feature is `rejected` or `blocked`;
- route any feature with an auth/PII/secret/multi-role surface or high cross-feature integration risk to independent QA Validator formal feature review before acceptance; do not self-accept these;
- for `rejected`, name the return point: `briefed`, `spec_ready`, or `planned`;
- for `blocked`, name the missing input, owner, and re-entry point;
- route formal validation needs to QA Validator instead of issuing milestone or mission QA verdicts.

Default to dry-run recommendation mode. Mutate acceptance review, handoff, or status fields only when `$ARGUMENTS` includes `--apply` or the user explicitly confirms apply/write/create.

With apply, only write:

- feature `validation.md` milestone acceptance review section;
- feature `feature.md` status or handoff fields with explicit apply/confirmation;
- milestone `execution-guide.md` integration handoff section when the milestone guide tracks accepted features.

## Forbidden

- implementation edits;
- automatic merge or deployment;
- acceptance when changed paths or implementation evidence do not support touched-scope review;
- acceptance when validation evidence cannot be inspected;
- acceptance on `assumed` or `could-not-run` evidence, or without a cited `ran` artifact;
- self-accepting a high-risk or security-surface feature without independent QA Validator review;
- milestone or mission QA verdicts;
- validation criteria changes.

Output with these sections:

- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff

Required content in the output:
- `Status`
- `Milestone ID/path`
- `Feature acceptance decision`
- `Artifact paths`
- `Evidence/commands`
- `QA invocation decision`
- `Correction scope`
- `Required next inputs`
- `Handoff reason`
