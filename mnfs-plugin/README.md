# MNFS Workflow Plugin

MNFS packages the Mission -> Milestone -> Feature CONTRACT + VERDICT layer for Claude Code:
planning (`/mission-init`), validation gates (`/milestone-validate`, `/mission-validate`),
correction scoping (`/correction-create`), closeout, and status. Execution is owned by the
hub-and-chips harness (`../harness/HARNESS.md`), which reads the planning artifacts and invokes
these gates. The plugin's own execution engine (milestone-orchestrator, feature-implementer,
correction-worker agents; /milestone-start, /feature-context, /feature-accept) was removed
2026-07-15 — role binding table in `docs/shared-standards.md` § Role Binding.

It does not provide an executable `mnfs` shell CLI, hidden state, deployment automation, or automatic validation verdicts.

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

- `commands/`: planning, status, and gate entrypoints (no execution commands).
- `skills/`: planning + validation + closeout protocols.
- `skills/<skill>/references/`: artifact shapes loaded only by the owning skill.
- `agents/`: planning/research agents and cold gate reviewers (no execution agents).
- `contracts/`: canonical artifact topology (`.mnfs/MIS-*/M-*/F-*`).
- `scripts/`: `status-integrity.sh` (integrity gate), `sync-shared-references.sh` (reference-card lockstep).

## Core Rule

Tracked MNFS artifacts are the source of truth. Commands and skills may guide file creation or updates only when the user explicitly asks to apply, write, or create.

## Runtime Shape

This bundle is the Phase 6 standardized MNFS runtime package. Agents, skills, skill-owned references, commands, and shared docs are the supported surfaces. Development scaffold folders and prompt drafts are not runtime dependencies.

Claude Code discovers skills from `skills/*/SKILL.md`. The plugin manifest exposes commands and agents; skills remain package components discovered by the Claude Code skill system.

Commands that require a separate role session use the Task tool to launch the matching plugin agent. Commands default to dry-run mode and may write runtime artifacts only when the user passes `--apply` or explicitly confirms apply, write, or create.
