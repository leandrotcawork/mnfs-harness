---
description: Read MNFS artifacts and report mission, milestone, and feature status.
argument-hint: "[MISSION_PATH_OR_WORKSPACE_ROOT] [FILTER]"
allowed-tools: Read, Glob, Grep, LS, Bash
---

# MNFS Status

Run this command in the main session as a read-only artifact status report. Do not launch a plugin agent and do not mutate runtime artifacts.
Treat runtime artifact paths as mission/workspace paths supplied by `$ARGUMENTS`. Treat package paths as relative to the plugin root (`mnfs-plugin/`) only when this command names package-owned files.

## Inputs
- mission path or workspace root from `$ARGUMENTS`;
- optional mission, milestone, or feature filter.

## Dry Run And Apply

- default to read-only aggregation mode;
- no file writes or status mutation.

## Runtime Rules

- read only tracked MNFS artifacts under the requested mission or workspace root;
- report recorded status, owner, next action, blockers, retry counters, and validation verdicts;
- separate recorded facts from missing evidence and assumptions;
- never infer pass/fail without a recorded QA verdict.

## Structural Integrity Scan (read-only)

Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/status-integrity.sh" <mission-root>` once — the only `Bash` use allowed, and read-only (it never writes). Surface its result in the report:

- `STATUS-INTEGRITY OK` → note it as a green line.
- Any `VIOLATION` → surface it as a RED blocker in `Findings` and `Risks`, verbatim, with the milestone id and violation token (e.g. `dangling-milestone`, `ran-without-artifact`). A dangling or unattested milestone is the single most important thing this report can surface; never let it read as a quiet `status: none`.

This does not mutate anything and does not infer pass/fail — it reports the deterministic verifier's own output.

## Files Touched
- none.

## Forbidden
- hidden cache as source of truth;
- status mutation;
- inference of pass/fail without recorded verdicts.

## Output
- concise status tree;
- current owner and next action per active artifact;
- blocked items and missing evidence;
- retry counters and validation verdicts.

Use these sections:
- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff

Include the runtime-harness Handoff-Rule fields, phrased for a read-only reader:
- `current status` (recorded status reported);
- `runtime owner` (main session reader);
- `skill/workflow used` (none required);
- `inspected paths` (artifacts read for this report);
- `files written` (none) and `files proposed` (none);
- `next handoff` (informational only: owner, action, and artifact paths the reader should attend to next).
