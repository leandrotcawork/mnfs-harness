# MNFS Workflow Plugin

MNFS packages the Mission -> Milestone -> Feature workflow for Claude Code.

This bundle is the Phase 6 standardized MNFS runtime package. It exposes slash commands through the plugin manifest and bundles skills, agent contracts, skill-owned references, and supporting documentation as package material. It does not provide an executable `mnfs` shell CLI, hidden state, deployment automation, or automatic validation verdicts.

## Prerequisites

The milestone gate drives user-facing milestones with the `agent-browser` CLI (Playwright +
bundled Chromium, headless). Install it once, pinned, before running a UI milestone gate:

```bash
npm install -g agent-browser@0.29.1
agent-browser install   # one-time: downloads the bundled Chromium
```

This keeps browser automation out of the target project's dependencies. Windows (Git Bash)
support is verify-at-install. If `agent-browser` is absent, the gate returns `could-not-drive`
→ `Blocked` (never a silent Pass).

## Surfaces

- `commands/`: self-contained Claude Code slash-command entrypoints.
- `skills/`: reusable MNFS workflow methods.
- `skills/<skill>/references/`: artifact shapes loaded only by the owning skill.
- `agents/`: runtime role authority, limits, and handoff rules.
- `docs/`: shared contracts and development reference.
- `docs/runtime-harness.md`: Claude Code command -> agent -> skill -> artifact -> handoff choreography.

## Standards

Package-wide conventions live in `docs/shared-standards.md`. Commands and skills should stay concise and cite shared docs instead of repeating common policy.

## Core Rule

Tracked MNFS artifacts are the source of truth. Commands and skills may guide file creation or updates only when the user explicitly asks to apply, write, or create.

## Runtime Shape

This bundle is the Phase 6 standardized MNFS runtime package. Agents, skills, skill-owned references, commands, and shared docs are the supported surfaces. Development scaffold folders and prompt drafts are not runtime dependencies.

Claude Code discovers skills from `skills/*/SKILL.md`. The plugin manifest exposes commands and agents; skills remain package components discovered by the Claude Code skill system.

Commands that require a separate role session use the Task tool to launch the matching plugin agent. Commands default to dry-run mode and may write runtime artifacts only when the user passes `--apply` or explicitly confirms apply, write, or create.
