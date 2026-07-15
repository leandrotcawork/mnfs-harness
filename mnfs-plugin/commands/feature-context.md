---
description: Build a minimal fresh-session context pack for one MNFS feature.
argument-hint: "[MISSION_PATH] [MILESTONE_ID] [FEATURE_ID] [--apply]"
allowed-tools: Read, Glob, Grep, LS, Write, Edit, Task
---

# MNFS Feature Context

Use the Task tool to launch the `milestone-orchestrator` plugin agent. Provide this command body, `$ARGUMENTS`, and the `feature-context-pack` skill workflow as the work instructions. If Task or the plugin agent is unavailable, state that fallback explicitly and execute the same Milestone Orchestrator handoff-preparation role in the main session.
Treat runtime artifact paths as mission/workspace paths supplied by `$ARGUMENTS`. Treat package paths as relative to the plugin root (`mnfs-plugin/`) only when this command names package-owned files.

## Inputs
- mission path from `$ARGUMENTS`;
- milestone ID from `$ARGUMENTS`;
- feature ID from `$ARGUMENTS`;
- relevant parent constraints, feature brief, allowed paths, validation expectations, known evidence, blockers, and open decisions;
- the verbatim milestone validation-contract criteria IDs (with observable) this feature must satisfy, the consume-only contracts it must honor, and any owner-reserved decisions it must not make.

Runtime rules:
- build context for exactly one feature;
- include only the feature brief, relevant mission or milestone constraints, required paths, validation expectations, known evidence, blockers, and expected return artifacts;
- carry the verbatim milestone criteria IDs (copied, not paraphrased), the consume-only contract slices (path + anchor) the feature must not redefine, and the owner-reserved decisions it must block on;
- lead the pack with these binding constraints first so the load-bearing constraint is not buried mid-context;
- expected return artifacts are `spec.md`, `plan.md`, changed paths, and `validation.md`;
- keep context minimal enough for a fresh session and do not copy full mission history;
- do not implement the feature or create feature execution artifacts.

Default to printing or returning the context pack without file writes. Update a feature handoff/context section only when `$ARGUMENTS` includes `--apply` or the user explicitly confirms apply/write/create.

Dry Run And Apply:

- default to printing or returning the context pack;
- no file writes unless explicitly applying.

With apply, only write:
- feature `feature.md` handoff section;
- milestone `execution-guide.md` feature dispatch section when the milestone guide tracks feature dispatch.

## Forbidden
- implementation;
- creating `spec.md`, `plan.md`, or `validation.md`;
- expansion of feature scope;
- dumping full mission history into feature context;
- hidden prompt files;
- feature acceptance or QA verdicts.

Output with these sections:
- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff

Required content in the output:
- `Summary` must name the feature ID/path and handoff purpose;
- `Findings` must include the verbatim milestone criteria IDs the feature must satisfy, the consume-only contracts it must not redefine, the owner-reserved decisions it must block on, allowed paths or boundaries, blockers, open decisions, expected return artifacts, and required next inputs;
- `Evidence` must cite the runtime artifacts used to build the context pack;
- `Recommendation` must state whether the handoff payload is ready or what is still missing;
- `Next Handoff` must name the target and handoff reason.
