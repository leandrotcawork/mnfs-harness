---
description: Close an MNFS mission with final evidence and owner handoff.
argument-hint: "[MISSION_PATH] [--apply]"
allowed-tools: Read, Glob, Grep, LS, Write, Edit, MultiEdit, Task, Bash
---

# MNFS Mission Closeout

Use the Task tool to launch the `mission-strategist` plugin agent. Provide this command body, `$ARGUMENTS`, and the `mission-closeout` skill workflow as the work instructions. If Task or the plugin agent is unavailable, state that fallback explicitly and execute the same Mission Strategist closeout role in the main session.
Treat runtime artifact paths as mission/workspace paths supplied by `$ARGUMENTS`. Treat package paths as relative to the plugin root (`mnfs-plugin/`) only when this command names package-owned files.

## Inputs

- mission path from `$ARGUMENTS`;
- mission validation result and final mission verdict;
- milestone verdicts and evidence;
- unresolved risks and accepted limitations;
- next owner or next-session audience;
- blocked-closeout reason when final evidence is missing.

## Runtime Rules

- this command is self-contained;
- closeout requires final mission validation evidence or an explicit blocked reason;
- use only the mission artifacts, validation evidence, milestone evidence, and user-provided context;
- consolidate milestone verdicts, evidence index, accepted limitations, unresolved risks, and next-owner context;
- do not change QA Validator verdicts;
- do not create a second closeout workflow outside the mission validation result;
- if required closeout evidence is missing, mark closeout blocked and name the missing evidence owner.

## Structural Precondition (deterministic, runs first)

Before consolidating verdicts, run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/status-integrity.sh" <mission-root>` — exactly one read-only command. Any `VIOLATION` (a dangling, faked-pass, or unattested milestone anywhere in the mission) means the mission is not closeable: output `Status: Blocked`, list each violating milestone + token, and name the remediation (`/milestone-validate <milestone> --apply`). A mission with an unproven milestone may not be closed, regardless of narrative evidence. Use `Bash` for nothing other than this verifier.

## Dry Run And Apply

Default to dry-run recommendation mode. Update artifacts only when `$ARGUMENTS` includes `--apply` or the user explicitly confirms apply/write/create.

## With Apply, Only Write

- `MIS-<nn>-<slug>/validation-result.md` (closeout/handoff section only) # QA verdict body owned by QA Validator per file-contracts.md
- `MIS-<nn>-<slug>/execution-guide.md` (handoff/closeout section only)
- `MIS-<nn>-<slug>/blocked-report.md` if closeout is blocked

## Forbidden

- deployment or release execution;
- changing validation verdicts;
- closing a mission with missing required evidence unless explicitly marked blocked.
- closing a mission while `status-integrity.sh` reports any milestone violation;
- using `Bash` for anything other than the read-only `status-integrity.sh` verifier.

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
- Mission ID/path
- Validation result path
- Milestone verdicts
- Evidence index
- Unresolved risks
- Accepted limitations
- Required next inputs
- Handoff reason
- Next action
