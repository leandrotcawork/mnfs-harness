# MNFS Shared Standards

## Purpose

These standards define what belongs in every MNFS plugin artifact and what must stay centralized. Keep role-specific files short; put common workflow policy here or in the canonical system docs.

## Source Hierarchy

- Agent files in `agents/` own the runtime system prompt for each role.
- Skill-local `references/` folders own runtime artifact shapes for the skill that contains them.
- Package-level `templates/` is development scaffold only and must not be required by final runtime commands or skills.
- Commands and skills route work; they should carry only the minimum runtime rule needed to execute correctly in a fresh session.

## Platform Standards

This package is the Phase 6 MNFS runtime bundle. It uses `.claude-plugin/plugin.json`, Markdown command files, agent definition files, skills, skill-owned references, and shared docs.

Claude Code plugin conventions:

- The plugin manifest lives at `.claude-plugin/plugin.json`.
- Use kebab-case `name`, semantic `version`, a concise `description`, `author`, `license`, `keywords`, and component paths.
- Declare exposed command and agent paths in the manifest when those folders are part of the runtime surface.
- Keep skills under `skills/<skill-name>/SKILL.md`; no executable CLI, hooks, MCP servers, or hidden state are included in this phase.

Codex compatibility notes:

- Codex repo instructions belong in `AGENTS.md`.
- Codex reusable workflows use skill directories with `SKILL.md` frontmatter containing `name` and `description`.
- Codex installable plugins use `.codex-plugin/plugin.json` and marketplace metadata. That is a separate packaging target, not part of this Claude Code package unless explicitly scoped later.

## Agent File Standard

Agent files in `agents/` are runtime system prompts, not reference cards. Each agent file should include:

- YAML frontmatter with `name`, trigger-focused `description`, `model`, `color`, and scoped `tools` when supported;
- one or two short trigger examples when routing ambiguity is likely;
- stable role identity;
- core responsibilities;
- workflow-use rules that name which skill/workflow should be supplied by commands or handoffs;
- process steps;
- hard limits;
- output format;
- blocked behavior.

Agents must contain enough behavior to work when invoked. Do not require the agent to read development-only docs to understand its authority.

## Skill File Standard

Each skill must have one clear workflow job. `SKILL.md` must include:

- YAML frontmatter with `name` and a trigger-focused `description`;
- purpose;
- required inputs;
- inspection rules;
- workflow steps;
- artifact/template routing;
- reference routing when the skill has optional deep guidance;
- allowed outputs;
- hard limits;
- context rules;
- validation or completion checks;
- stop/blocked behavior;
- output sections.

Skill descriptions should front-load trigger words because skill discovery may truncate descriptions. Skills should prefer instructions over scripts unless deterministic tooling is needed.

Do not turn skills into agent prompts. The agent owns authority; the skill owns method.

Skill-local `references/` folders are the final runtime artifact-shape source. They may hold concise templates, examples, or writing guidance needed by that skill. Keep workflow policy out of references.

Package-level `templates/` was used while building the plugin. After Phase 6 coverage is confirmed, it should be removed or kept outside the runtime package.

## Command File Standard

Each command file in `commands/` must include YAML frontmatter:

- `description`;
- quoted `argument-hint`;
- conservative `allowed-tools`.

Each command body must include:

- owner role;
- plugin-root path convention;
- inputs;
- dry-run/apply rule;
- allowed outputs or files touched;
- forbidden actions;
- final output shape.

Commands are instruction entrypoints, not a shell CLI. They must not claim that a real `mnfs` executable exists in this phase.

## Component Authoring Standard

This is the canon every command, agent, and skill file must conform to. New contributors should read this first so components are born conforming.

### Verdict vocabularies (do not conflate)

Three distinct verdict vocabularies exist; never mix tokens across them:

- QA validation verdicts (mission gate owned by QA Validator; milestone gate owned by the independent milestone-reviewer cold crew): title-case `Pass` / `Fail` / `Blocked`. Never lowercase, never past-tense.
- Milestone STATUS tokens (lifecycle, owned by `state-model.md`): `passed` / `correction_needed` / `blocked`.
- Readiness verdicts (P7 planning-readiness gate, owned by the Mission Reviewer crew): `Ready` / `Needs revision` / `Blocked`.

### Contract authority

`docs/agents.md` is the single source of an agent's required output fields. Command files and SKILL files must SUBSET that field set; they must never add fields that are not in the agent contract.

### Required agent-file heading set

For field-by-field auditability, each agent file must carry: `## Inputs`, `## Required Actions` (or `## Protocol`), `## Forbidden Actions`, `## Output Format`, `## Handoff`, `## Failure Behavior`.

### Required command-file sections

Each command file must carry:

- frontmatter (`description`, `argument-hint`, least-privilege `allowed-tools`);
- Inputs;
- Runtime Rules;
- Dry-Run / Apply;
- With-Apply write-list (paths MUST match `docs/file-contracts.md`);
- Forbidden;
- Output + required fields;
- Handoff (the 8 runtime-harness handoff fields).

### Paths

All artifact paths must match `docs/file-contracts.md`. Corrections live under `corrections/`.

## Template Standard

Templates should define durable artifact structure and metadata, not role policy. Operational templates should start with YAML metadata fields when applicable:

- `id`;
- `type`;
- `status`;
- `owner`;
- `parent`;
- `created`;
- `updated`;
- `validation_level`;
- `lifecycle_scope`.

Template prompts should stay short and concrete. Avoid embedding large agent contracts, command instructions, or repeated validation policy in templates.

## Handoff Output Standard

All agent, command, and skill outputs should use the common sections:

- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff

Role-specific required fields from `docs/agents.md` must appear inside the relevant common section instead of creating a different output shape.

Use this placement by default:

- Summary: status, scope, decision, and result.
- Findings: confirmed facts, current problems, and unknowns.
- Evidence: inspected paths, commands, sources, artifacts, and validation results.
- Risks: blockers, assumptions, residual risks, and retry or validation concerns.
- Recommendation: accepted scope, rejected or deferred scope, correction scope, verdict recommendation, or next action.
- Next Handoff: target owner, required next inputs, artifact paths, and handoff reason.

## Evidence And Validation Wording

Evidence must be inspectable. Use file paths, commands, test output, source links, or explicitly marked manual observations.

Separate:

- facts from assumptions;
- recommendations from verdicts;
- feature quick validation from formal milestone or mission validation;
- blocking failures from non-blocking risks.

The independent milestone-reviewer cold crew owns the milestone validation verdict; QA Validator owns the mission validation verdict (and is the fallback single cold pass for the milestone gate). Milestone Orchestrator may accept or reject feature outputs but must not self-approve or self-grade a milestone. Correction Worker fixes only assigned validation failures.

## Token Budget And Anti-Bloat Rules

- Put shared policy in shared docs, not every command or skill.
- Keep command and skill files as routers with phase-specific constraints.
- Prefer links to canonical docs over copied blocks.
- Do not add research notes unless they affect a decision.
- Do not add new templates unless an artifact needs durable traceability.
- Defer cosmetic rewrites that do not reduce mission risk or improve reliability.

## External Research Rules

Use current official sources when library, framework, SDK, API, CLI, cloud, or plugin-platform behavior affects a decision.

- Use Context7 first for library, framework, SDK, API, CLI, cloud, and tool documentation when available.
- Prefer official vendor docs and primary sources.
- Record source list, version or date notes, and applicable guidance when research changes the decision.
- Keep research out of the main mission or roadmap text unless it changes scope, validation, packaging, or implementation.

## Phase Analysis Standard

Use a skill-driven review loop for every phase.

- Reconstruct the expected phase model from the MNFS PRD, diagrams, roadmap, and the phase-specific artifacts before judging files.
- Inspect only the artifact set that belongs to the phase under review.
- Classify each artifact by current function, desired function, duplication, context load, authority, template use, and skill/reference use.
- Compare current artifacts against the expected phase model.
- Research only when the decision depends on external behavior, current tooling, methodology, or a comparison source.
- Discuss findings and recommendations before editing.
- Decide: keep, rewrite, merge, split, remove, or defer.
- Validate that the change reduced duplication, preserved clear ownership, and improved the phase's ability to execute in a fresh session.

## Phase Review Worksheet

Every phase review should answer:

- Objective
- Current artifacts
- Agents
- Skills
- Commands
- Templates
- Expected flow
- Research needed
- Quality checks
- Current problems
- Improvement options
- Recommendation
- Planned edits
- Risks
- Exit criteria
