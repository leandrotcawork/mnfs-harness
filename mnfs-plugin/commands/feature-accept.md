---
description: Review and accept, reject, or block an MNFS feature output.
argument-hint: "[FEATURE_PATH] [--apply]"
allowed-tools: Read, Glob, Grep, LS, Write, Edit, MultiEdit, Task
---

# MNFS Feature Accept

> **Optional escape hatch.** `/milestone-start`'s orchestration loop already runs this same
> accept/reject/block review automatically for every returned feature (milestone-execution
> skill, steps 8-11). Invoke this command only to review one feature manually outside that loop.

Use the Task tool to launch the `milestone-orchestrator` plugin agent. Provide this command body, `$ARGUMENTS`, and the `feature-validation-review` skill workflow as the work instructions. If Task or the plugin agent is unavailable, state that fallback explicitly and execute the same Milestone Orchestrator acceptance-review role in the main session.

Review rules are owned by the `feature-validation-review` skill (Hard Limits + review procedure) — the skill binds; this command does not restate them.
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

Runtime rules: the `feature-validation-review` skill's review procedure and Hard Limits bind
(one feature per review; accepted/rejected/blocked semantics; evidence-bound acceptance;
security-surface routing to QA Validator) — apply them from the skill, not from memory.

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
