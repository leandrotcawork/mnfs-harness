# MNFS Runtime Harness

## Purpose

This document defines how the Claude Code MNFS plugin turns slash commands into the Mission -> Milestone -> Feature workflow. It is the runtime companion to `diagrams.md`, `state-model.md`, `validation-system.md`, and `shared-standards.md`.

The runtime source of truth is always tracked MNFS artifacts in the mission workspace. Commands, agents, and skills route work; they do not keep hidden state.

## Claude Code Runtime Facts

- Slash commands are Markdown files in `commands/`.
- Plugin agents are Markdown files in `agents/`.
- Commands that need a separate role session should launch the matching plugin agent with the Task tool.
- Skills are auto-discovered from `skills/*/SKILL.md`; commands and agents should name the needed skill workflow clearly.
- Package-owned paths should use `${CLAUDE_PLUGIN_ROOT}` when referenced from command text.
- Runtime mission paths come from `$ARGUMENTS` and must not be treated as package paths.

## Command Styles

| Style | Meaning | Commands |
| --- | --- | --- |
| Agent task | Command launches a plugin agent through Task and supplies the skill workflow plus `$ARGUMENTS`. | `milestone-start`, `feature-context`, `feature-accept`, `milestone-validate`, `mission-validate`, `correction-create`, `mission-closeout` |
| Main-session skill runner | Command loads a skill via the Skill tool and runs the protocol in the main session with native gates. | `mission-init` |
| Main-session reader | Command stays in the main session and reads artifacts only. | `status` |

If Task or plugin-agent launch is unavailable, the command may fall back to main-session execution only after saying that it is using fallback mode.

## Runtime Matrix

| Entry point | Runtime owner | Skill/workflow | Main artifacts | Hard boundary |
| --- | --- | --- | --- | --- |
| `/mission-init` | main session (`mission-planning` skill) | `mission-planning` | mission, mission validation contract, research notes, interface contracts when needed, milestone briefs, feature briefs | No feature `spec.md`, `plan.md`, or `validation.md` |
| P7 readiness gate (within `/mission-init`) | `mission-reviewer` crew (parallel cold Task subagents, scoped by criterion cluster) | `mission-planning` readiness rubric | `readiness-review.md` (synthesized by the planning session from the crew's folded per-criterion findings) | Read-only; no edits, no fixes, no criteria changes |
| `/milestone-start` | `milestone-orchestrator` | `milestone-execution` | milestone readiness, feature queue, dispatch notes, blocked report when needed | No feature implementation or QA verdict |
| `/feature-context` | `milestone-orchestrator` | `feature-context-pack` | one-feature context/handoff payload | No broad mission history dump |
| Fresh feature session | `feature-implementer` | `feature-execution` | `spec.md`, `plan.md`, implementation changes, `validation.md` | No mission redesign or unrelated refactor |
| `/feature-accept` | `milestone-orchestrator` | `feature-validation-review` | feature acceptance review and integration handoff | No milestone or mission QA verdict |
| `/milestone-validate` | `qa-validator` | `validation` | milestone `validation-result.md`, failure list, correction recommendation | No fixes or correction assignment creation |
| `/correction-create` | `milestone-orchestrator` | `milestone-execution` correction routing | correction task or correction feature | Must derive scope from QA findings |
| Correction session | `correction-worker` | `correction-worker` | scoped fix, changed paths, rerun evidence | No unassigned fixes or validation criteria changes |
| `/mission-validate` | `qa-validator` | `validation` | mission `validation-result.md` | No closeout rewrite or implementation fix |
| `/mission-closeout` | `mission-strategist` | `mission-closeout` | final evidence index, risks, owner handoff | No QA verdict changes |
| `/status` | main session reader | none required | artifact status report | No hidden state or mutation by default |

## Command Agent Handoff Formula

Agent-task commands should include this runtime instruction:

```text
Use the Task tool to launch the `<agent-name>` plugin agent. Provide this command body, `$ARGUMENTS`, and the `<skill-name>` skill workflow as the work instructions. If Task or the plugin agent is unavailable, state that fallback explicitly and execute the same role contract in the main session.
```

**Exception:** `/mission-init` does not use this Task-launch formula. It loads the `mission-planning` skill in the main session via the Skill tool and runs the protocol inline with native `AskUserQuestion` gates.

**P7 reviewer dispatch:** at the readiness phase the planning session DOES use Task — to launch a CREW of read-only `mission-reviewer` cold subagents (no chat history) in parallel, each scoped to a criterion cluster (★1+★5, ★2+★3, ★4+★6, ★7, plus a ★2+★7 adversarial double-pass) so each reads the whole mission tree with undivided attention. Each returns per-criterion PASS/FAIL findings with cited loci; the planning session folds them (any covering reviewer's FAIL = FAIL; union only, never downgrade), computes the binary-rubric verdict, persists `readiness-review.md`, and runs a cap-3 auto-revise/escalate loop. If parallel dispatch is unavailable it falls back to a single full-pass reviewer plus the ★2+★7 adversarial pass. Reviewers never edit artifacts and must not be auto-delegated for any other review.

**Optional CLI power-bonus path:** `mission-planner` is a dedicated planner agent run as the main thread via `claude --agent mnfs-workflow:mission-planner` (CLI only; not available in Claude Desktop). It loads the same `mission-planning` skill and runs the same P0–P7 protocol with native gates, but as a system-prompt-level planner persona for a stronger, dedicated planning session. It is the same planning runtime as `/mission-init`, not a different protocol. It must never be launched via Task — `AskUserQuestion` and `Skill` are unavailable inside subagents. `/mission-init` remains the default path and works in both Desktop and CLI.

The agent output must use:

- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff

## Dry-Run And Apply Rule

Commands default to dry-run recommendation mode. They may create or update runtime artifacts only when `$ARGUMENTS` includes `--apply` or the user explicitly confirms apply, write, or create.

Dry-run output may recommend files and content, but must not write files.

## Handoff Rule

Every command output must name:

- current status;
- runtime owner;
- skill/workflow used;
- inspected artifact paths;
- files written or proposed;
- required next inputs;
- next handoff target;
- handoff reason.
