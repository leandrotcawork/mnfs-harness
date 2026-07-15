# MNFS Skills Map

## Decision Principles

- Research first: do not map MNFS phases to existing skills until local capabilities and external practices have been evaluated.
- Reuse when a skill/plugin already matches the phase and evidence standard.
- Adapt or wrap when useful behavior needs MNFS constraints, artifact names, handoff fields, or validation contracts.
- Create new MNFS skills when no existing skill cleanly owns Mission -> Milestone -> Feature responsibilities.
- Reject when a candidate adds context bloat, weak validation, unclear ownership, style mismatch, or conflicts with MNFS hierarchy.
- Prefer skills for reusable workflow behavior and plugins only when distribution, apps, MCP servers, or bundled skills are needed.

## Evaluated Sources

- Local Superpowers skills: brainstorming, writing-plans, executing-plans, subagent-driven-development, TDD, debugging, review, verification, worktrees.
- Local plugins/connectors: Browser, GitHub, Context7 MCP, GitNexus, Codex skill/plugin creation, MNOS handoff.
- External practice sources: OpenAI Codex workflows/skills/AGENTS.md docs, GitHub Copilot cloud agent docs, Anthropic skill-authoring guidance, Fowler on spec-driven development and TDD, Agile Alliance on TDD/ATDD, ADR guidance, Google SRE PRR, DORA, Scrum Guide.
- Detailed evidence is in [research/skills-and-methodology-research.md](research/skills-and-methodology-research.md).

## Recommended Reusable Skills And Plugins

| Candidate | Reuse decision | MNFS fit | Evidence |
|---|---|---|---|
| `superpowers:verification-before-completion` | Reuse | Required evidence gate before any feature, milestone, or mission completion claim. | Local skill requires fresh command evidence before completion claims. |
| `superpowers:test-driven-development` | Reuse when implementation is code-testable | Feature implementation and correction work. | Local skill plus Agile Alliance/Fowler TDD sources support red/green/refactor and frequent checks. |
| `superpowers:systematic-debugging` | Reuse | Correction Worker investigation before fixes. | Local skill owns bug/test-failure tracing before proposing fixes. |
| Browser plugin | Reuse | QA-3 browser/app validation, screenshots, local UI flows. | Local Browser skill opens, navigates, tests, clicks, screenshots local targets. |
| Context7 MCP | Reuse | Current library/framework/API/CLI/cloud docs during research and feature implementation. | AGENTS.md requires resolve-library-id before query-docs; tool exposes `resolve_library_id` and `query_docs`. |
| GitHub plugin | Reuse where repo/PR/CI exists | PR context, review comments, CI failures, draft PR handoff. | Local GitHub skills cover PR/issue triage, review comments, CI logs, and PR publishing. |
| Codex `skill-creator` / `plugin-creator` | Reuse for packaging | Future MNFS skill/plugin authoring, not day-to-day phase execution. | Local creator skills scaffold skill/plugin conventions. |

## Skills To Adapt

| Candidate | Adaptation | Why |
|---|---|---|
| `superpowers:brainstorming` | Wrap as optional mission-discovery behavior when user intent is unclear. | Useful for exploration, but MNFS must not force interactive brainstorming when the mission is already specified. |
| `superpowers:writing-plans` | Wrap for `feature/plan.md`, not Mission or Milestone strategy. | Good bite-sized implementation planning, but too code-step-specific and path-opinionated for MNFS hierarchy. |
| `superpowers:executing-plans` | Wrap for feature execution from an MNFS plan. | Needs MNFS artifact updates and validation handoff. |
| `superpowers:subagent-driven-development` | Wrap for independent features only after dependency review. | Useful parallelism, but MNFS must preserve milestone ordering and acceptance gates. |
| `superpowers:requesting-code-review` | Wrap as feature/milestone review input. | Review posture is useful, but QA Validator owns final MNFS verdict. |
| `superpowers:receiving-code-review` | Wrap for correction planning. | Useful rigor, but Correction Worker may only act on scoped validation failures. |
| `superpowers:using-git-worktrees` | Wrap when the workspace is a git repo. | Good isolation; fallback needed for non-git workspaces. |
| GitNexus skills | Adapt for codebase research, impact analysis, PR review, debugging. | Useful graph/index workflows when available, but should not be required for every MNFS run. |
| `mnos-milestone-handoff` | Mine/adapt concepts for MNFS closeout. | Similar handoff intent, but it is MNOS-specific and not a direct MNFS phase owner. |

## New MNFS Skills To Create

| Future skill | Purpose | Inputs | Outputs | Blocked behavior | Practices incorporated |
|---|---|---|---|---|---|
| `mnfs:mission-planning` | Build mission scope, milestone map, and mission validation contract from evidence. | User goal, codebase findings, architecture/research notes, constraints. | `mission.md`, mission `validation-contract.md`, milestone briefs, `execution-guide.md`, research links. | Stop for human decision when scope, evidence, or success criteria are ambiguous. | Spec-driven source of truth, Scrum Product Goal focus, ADR-style decision capture, Codex explicit done criteria. |
| `mnfs:milestone-execution` | Orchestrate features, dependencies, acceptance, correction loops, and milestone state. | Mission artifacts, milestone brief, validation contract, feature list. | Feature handoff prompts, acceptance/rejection notes, correction scope, milestone evidence. | Stop after retry limit or missing integration evidence; create blocked report. | Small batches, agentic plan/iterate patterns, PRR-style readiness gates. |
| `mnfs:feature-context-pack` | Produce minimal fresh-session context for one feature. | Feature brief, parent mission/milestone context, relevant evidence and contracts. | Compact feature prompt/context bundle with required files and validation commands. | Stop when required parent artifacts or acceptance criteria are missing. | Codex AGENTS.md/context guidance, small-batch delivery, context-budget discipline. |
| `mnfs:feature-execution` | Own feature spec, plan, implementation, and quick validation. | Feature context pack, scoped files, current docs, validation criteria. | `spec.md`, `plan.md`, implementation changes, `validation.md`. | Stop when implementation would exceed scope or required tools/docs are unavailable. | SDD, TDD where applicable, Context7 docs, verification-before-completion. |
| `mnfs:feature-validation-review` | Review feature output against spec and milestone contract. | Feature artifacts, diff/changed paths, validation evidence. | Accept/reject recommendation, risks, required corrections. | Mark blocked when evidence cannot be reproduced or contract is incomplete. | Code review posture, ATDD acceptance checks, QA evidence discipline. |
| `mnfs:validation` | Own the mission QA verdict; provide the fallback single cold pass and rubric for the milestone gate (the milestone verdict itself is owned by the independent milestone-reviewer crew dispatched by `/milestone-validate`). | All feature outputs, mission/milestone validation contract, milestone review rubric, commands/logs/screenshots. | Pass/Fail/Blocked verdict, blocking failures, correction recommendation. | Block advancement on failed or missing required evidence. | Google SRE PRR, DORA test automation/feedback, Scrum Definition of Done. |
| `mnfs:correction-worker` | Fix only scoped validation failures. | QA failure report, correction scope, retry count, validation commands. | Targeted fix summary, changed paths, rerun evidence, remaining risk. | Stop when failure cannot be reproduced, scope is insufficient, or retry limit is reached. | Systematic debugging, receiving review feedback, TDD bug fixing. |
| `mnfs:mission-closeout` | Close mission with traceability and final readiness evidence. | Mission/milestone verdicts, final validation contract, docs/state. | Final summary, evidence index, unresolved risks, next-session handoff. | Stop if any milestone lacks accepted validation or final contract is untested. | Release readiness, ADR decision log, MNOS handoff concepts. |

## Tooling Rules

- Mission planning: inspect code first; use Context7 for current library/framework/API/CLI/cloud docs; use web research for methodology or vendor practice sources; record decisions as evidence, not assumptions.
- Feature execution: use `mnfs:feature-context-pack`; then apply TDD when practical, Context7 when third-party behavior matters, Browser for local UI, and verification-before-completion before handoff. Large/exploratory features split at `planned` (`build_large`) so the build runs in a fresh `build`-mode session reading the distilled `spec.md` + `plan.md`.
- Milestone execution: use subagents or parallel work only after dependency analysis proves features independent; otherwise execute serially.
- Validation: QA Validator owns the mission verdict; the independent milestone-reviewer cold crew owns the milestone verdict. Browser/GitHub/CI/test/build tools provide evidence but do not replace the verdict.
- GitHub: use for PRs, review comments, CI failures, and release handoff only when the workspace is connected to GitHub.
- Worktrees: prefer isolated worktrees for implementation in git repos; in non-git workspaces, isolate by file ownership and explicit changed-file lists.
- Skill/plugin creation: keep early MNFS skills instruction-only unless scripts clearly reduce repetitive scaffolding or validation mistakes.

## Research Rules

- Use local codebase/artifact evidence before external recommendations.
- Use Context7 for library, framework, SDK, API, CLI, or cloud-service documentation; always resolve library ID before querying unless an exact `/org/project` ID is provided.
- Use primary/vendor sources when available; use reputable engineering sources for methodology.
- Put long notes in `research/`; keep mission, milestone, feature, and validation files concise.
- Mark inference explicitly when a source supports a principle but not an MNFS-specific rule.

## Fallback Rules

- If Context7 is unavailable, use official vendor docs via web and record the fallback.
- If Browser is unavailable, use local test/build commands and manual QA notes; mark UI evidence as limited.
- If GitHub tools are unavailable, use local git/CI logs when available; otherwise record missing remote evidence.
- If GitNexus is unavailable or repo is unindexed, use `rg`, file reads, dependency manifests, and targeted code inspection.
- If worktrees are unavailable, avoid parallel edits to shared files and include exact changed paths in handoff.
- If required validation cannot run, report `BLOCKED` with missing command, artifact, credential, environment, or context.

## Open Questions

- Should MNFS ship as local skills first, then a plugin, or directly as a plugin bundle?
- Which QA level should be the default for frontend/app milestones: QA-2 or QA-3?
- Status tracking decision: `mnfs status` reads artifact metadata by default; durable generated reports are optional explicit outputs, never hidden source of truth.
- How much of Superpowers should be hard-required inside future MNFS skills versus referenced as optional compatible practice?
- Should GitNexus be a first-class optional integration or remain a research accelerator only?
