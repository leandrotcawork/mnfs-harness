---
description: Start or prepare an MNFS milestone execution queue.
argument-hint: "[MISSION_PATH] [MILESTONE_ID] [--apply]"
allowed-tools: Read, Glob, Grep, LS, Write, Edit, MultiEdit, Task, Skill, Bash
---

# MNFS Milestone Start

Invoke the `milestone-execution` skill and run the Milestone Orchestrator coordination loop in THIS (main) session. The orchestrator coordinates and converses with the operator (readiness, feature ordering, accept/reject/next, correction scoping, blocked routing), and it dispatches work via the Task tool — so it must run in the main session, never as a Task subagent (a subagent cannot reliably spawn its own Task subagents, and the operator cannot talk to it mid-run). This mirrors `/mission-init`, which runs the `mission-planning` skill in the main session rather than dispatching a planner subagent.

Dispatch the LEAF workers via Task from this session: fresh `feature-implementer` sessions (full or `build` mode), and — through `/milestone-validate` — the independent cold `milestone-reviewer` crew and `qa-validator`. Only the leaves are subagents; the coordinator is not. If the `milestone-execution` skill cannot be loaded, state that fallback explicitly and execute the same Milestone Orchestrator role contract inline in this session.
Treat runtime artifact paths as mission/workspace paths supplied by `$ARGUMENTS`. Treat package paths as relative to the plugin root (`mnfs-plugin/`) only when this command names package-owned files.

Inputs:

- mission path from `$ARGUMENTS`;
- milestone ID from `$ARGUMENTS`;
- milestone brief and validation contract;
- milestone execution guide when present;
- feature list, current status, and blockers.

## Structural Precondition — Advance Gate (deterministic, runs first)

Before any readiness review, feature ordering, or dispatch, run the integrity verifier on the parent mission root with `Bash` — exactly one read-only command, nothing else:

`bash "${CLAUDE_PLUGIN_ROOT}/scripts/status-integrity.sh" <mission-root>`

Fold its result as a hard precondition on STARTING this milestone:

- Any `VIOLATION` on a PRIOR milestone — `dangling-milestone`, `passed-no-result`, `verdict-not-pass`, `verdict-folds-from-nothing`, `never-downgrade-breach`, or any `ran-*-artifact` — means a previously-executed milestone is not filed + attested. **REFUSE to start this milestone:** output `Status: Blocked`, name the unproven prior milestone and the exact remediation (`/milestone-validate <prior-milestone-path> --apply`), and do NOT dispatch any feature. The mission cannot cross a milestone boundary unproven.
- `STATUS-INTEGRITY OK` (or violations confined to the milestone being started, which has not run features yet) → proceed to readiness review.

This is a bash check, not advisory prose: it cannot be reasoned around. It is the forward-looking enforcement — it protects the NEXT milestone, so the prior milestone must already be validated via Phase 0 / `/milestone-validate`.

Runtime rules:

- coordinate milestone readiness, feature ordering, feature dispatch, QA routing, correction scoping, and blocked reporting;
- keep the command self-contained and use only the mission or milestone artifacts needed for the requested milestone;
- require feature work to return `spec.md`, `plan.md`, changed paths, and `validation.md`;
- invoke QA Validator for formal validation verdicts instead of issuing milestone QA verdicts.

Default to dry-run recommendation mode. Mutate readiness, handoff, retry, or status fields only when `$ARGUMENTS` includes `--apply` or the user explicitly confirms apply/write/create.

With apply, only write:

- milestone `execution-guide.md` readiness, dispatch, or handoff sections;
- milestone `milestone.md` status, retry, or handoff fields with explicit apply/confirmation;
- next feature `feature.md` handoff section when a feature is selected;
- milestone `blocked-report.md` when readiness is blocked by missing context, retry exhaustion, or owner decision.

Forbidden:

- automatic execution of all features without acceptance gates;
- parallelization without runtime checks;
- mission goal redefinition;
- feature `spec.md`, `plan.md`, or `validation.md` creation;
- milestone QA verdicts.
- starting a milestone while a prior milestone holds an unresolved `status-integrity.sh` violation;
- using `Bash` for anything other than the read-only `status-integrity.sh` verifier;

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
