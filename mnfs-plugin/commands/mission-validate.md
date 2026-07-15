---
description: Validate an MNFS mission against its mission validation contract.
argument-hint: "[MISSION_PATH] [--apply]"
allowed-tools: Read, Glob, Grep, LS, Write, Edit, MultiEdit, Task
---

# MNFS Mission Validate

Use the Task tool to launch the `qa-validator` plugin agent. Provide this command body, `$ARGUMENTS`, and the `validation` skill workflow as the work instructions. If Task or the plugin agent is unavailable, state that fallback explicitly and execute the same QA Validator mission-validation role in the main session.
Treat runtime artifact paths as mission/workspace paths supplied by `$ARGUMENTS`. Treat package paths as relative to the plugin root (`mnfs-plugin/`) only when this command names package-owned files.

## Inputs

- mission path from `$ARGUMENTS`;
- mission validation contract;
- milestone validation results and evidence;
- final mission evidence, documentation evidence, release evidence, CI/test/build/browser/manual QA evidence, or explicit missing-evidence notes.

## Runtime Rules

- this command is self-contained;
- use only the mission artifacts, validation contract, evidence inputs, and user-provided context;
- issue exactly one validation verdict: Pass, Fail, or Blocked;
- missing required evidence blocks advancement;
- observed blocking failure blocks advancement;
- QA Validator owns the verdict;
- Mission Strategist or human owner owns scope decisions after the verdict;
- evidence inputs are read-only and must not trigger release, deployment, or environment mutation.

## Dry Run And Apply

Default to dry-run recommendation mode.

Update validation artifacts only when `$ARGUMENTS` includes `--apply` or the user explicitly confirms apply/write/create.

## With Apply, Only Write

- `MIS-<nn>-<slug>/validation-result.md`
- `MIS-<nn>-<slug>/blocked-report.md` when validation cannot advance

## Forbidden

- silent pass when required evidence is missing;
- implementation fixes;
- correction task or correction feature creation;
- validation criteria changes;
- production deployment;
- release, deployment, or environment mutation from evidence inputs.

## Output

Use these sections:

- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff

Include these required fields inside the output shape:

- Status
- Validation verdict
- Contract checked
- Artifact paths
- Evidence/commands
- Blocking failures
- Recommended next-step scope (Mission Strategist decision)
- Required next inputs
- Handoff reason
