---
description: Create a scoped MNFS correction task or correction feature from QA Validator findings.
argument-hint: "[MILESTONE_PATH] [FAILED_VALIDATION_REPORT] [--apply]"
allowed-tools: Read, Glob, Grep, LS, Write, Edit, MultiEdit, Task
---

# MNFS Correction Create

Use the Task tool to launch the `milestone-orchestrator` plugin agent. Provide this command body, `$ARGUMENTS`, and the correction-routing portion of the `milestone-execution` skill workflow as the work instructions. If Task or the plugin agent is unavailable, state that fallback explicitly and execute the same Milestone Orchestrator correction-scoping role in the main session.
Treat runtime artifact paths as mission/workspace paths supplied by `$ARGUMENTS`. Treat package paths as relative to the plugin root (`mnfs-plugin/`) only when this command names package-owned files.

## Inputs

- milestone path from `$ARGUMENTS`;
- failed validation report from `$ARGUMENTS`;
- QA Validator blocking failures and recommended correction scope;
- current correction_attempts, max_correction_attempts, and last_validation_result from `<MILESTONE_PATH>/milestone.md`;
- decision evidence for correction task, correction feature, or blocked report.

## Runtime Rules

- this command is self-contained;
- scope correction work only from QA Validator blocking failures and recommended correction scope;
- create a correction task as `<MILESTONE_PATH>/corrections/correction-task.md` when the fix is narrow and does not need feature-level traceability;
- create a correction feature only when the fix needs feature-level spec, plan, implementation, and validation traceability;
- correction features use the next available `F-<nn>-<slug>` feature folder;
- read and update retry state only from `<MILESTONE_PATH>/milestone.md`, and increment or preserve it according to current milestone evidence;
- never reset retry counters silently;
- route revalidation back to QA Validator instead of issuing milestone or mission QA verdicts;
- resuming an interrupted correction: re-running this command re-enters from the persisted `<MILESTONE_PATH>/corrections/correction-task.md` and milestone retry state — read them, do not reset retry counters, and re-dispatch the Correction Worker via Task. There is no standalone Correction Worker command by design; dispatch stays behind this orchestrator scoping.

## Dry Run And Apply

Default to dry-run recommendation mode.

Create correction artifacts or update retry/state fields only when `$ARGUMENTS` includes `--apply` or the user explicitly confirms apply/write/create.

## With Apply, Only Write

- `<MILESTONE_PATH>/validation-result.md` correction scope reference;
- `<MILESTONE_PATH>/milestone.md` retry, state, or handoff fields;
- `<MILESTONE_PATH>/execution-guide.md` correction handoff section only;
- `<MILESTONE_PATH>/corrections/correction-task.md`;
- `<MILESTONE_PATH>/F-<nn>-<slug>/feature.md` for the next available correction feature;
- `<MILESTONE_PATH>/F-<nn>-<slug>/spec.md`;
- `<MILESTONE_PATH>/F-<nn>-<slug>/plan.md`;
- `<MILESTONE_PATH>/F-<nn>-<slug>/validation.md`;
- `<MILESTONE_PATH>/blocked-report.md` when retry limits, missing context, or owner decision prevents correction dispatch.

## Forbidden

- correction work without QA Validator blocking failure evidence;
- unscoped fixes;
- new product scope hidden as correction work;
- retry counter reset;
- implementation edits;
- validation criteria changes;
- milestone or mission QA verdicts.

## Output

Use these sections:

- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff

Include these fields inside the relevant sections:

- Status
- Milestone ID/path
- Feature acceptance decision
- Artifact paths
- Evidence/commands
- QA invocation decision
- Correction scope, if any
- Required next inputs
- Handoff reason
