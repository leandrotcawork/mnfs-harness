# MNFS Terminal Verification

## Purpose

Use this checklist before releasing the Claude Code MNFS plugin. It proves that commands load, agents launch, skills are discoverable, dry-run mode does not write files, apply mode writes only allowed artifacts, and validation ownership matches the MNFS contracts.

## Static Package Checks

Run from the repository root:

```powershell
Get-Content '.\mnfs-plugin\.claude-plugin\plugin.json' | ConvertFrom-Json | Select-Object name,version,commands,agents
Test-Path '.\mnfs-plugin\commands'
Test-Path '.\mnfs-plugin\agents'
Test-Path '.\mnfs-plugin\skills'
Get-ChildItem '.\mnfs-plugin\skills' -Directory | ForEach-Object { Test-Path (Join-Path $_.FullName 'SKILL.md') }
rg -n "Use the Task tool to launch" .\mnfs-plugin\commands
rg -n "Act as " .\mnfs-plugin\commands
git diff --check -- '.\mnfs-plugin'
```

Expected:

- manifest parses as JSON;
- commands, agents, and skills directories exist;
- every skill directory has `SKILL.md`;
- agent-task commands mention Task launch;
- no command contains `Act as `;
- `git diff --check` exits 0.

## Claude Code Load Checks

In a Claude Code session with the plugin installed or loaded:

1. Confirm MNFS commands appear as plugin slash commands.
2. Confirm these agents are available: `mission-strategist`, `milestone-orchestrator`, `feature-implementer`, `qa-validator`, `correction-worker`.
3. Confirm MNFS skills are discoverable from `skills/*/SKILL.md`.

## Synthetic Mission Cycle

Use a disposable workspace and a tiny documentation-only mission.

1. Run `/mission-init "Create a tiny docs-only mission for plugin verification"` in dry-run mode.
2. Confirm no files are written.
3. Run `/mission-init "Create a tiny docs-only mission for plugin verification" --apply`.
4. Confirm only mission planning artifacts are written.
5. Run `/milestone-start <MISSION_PATH> M-01`.
6. Run `/feature-context <MISSION_PATH> M-01 F-01`.
7. Start a fresh feature session with the generated context.
8. Confirm feature execution produces `spec.md`, `plan.md`, changed paths, and `validation.md`.
9. Run `/feature-accept <FEATURE_PATH>`.
10. Run `/milestone-validate <MILESTONE_PATH>`.
11. Simulate or keep one failed criterion and run `/correction-create <MILESTONE_PATH> <FAILED_VALIDATION_REPORT>`.
12. Run a scoped correction session.
13. Re-run `/milestone-validate <MILESTONE_PATH>`.
14. Run `/mission-validate <MISSION_PATH>`.
15. Run `/mission-closeout <MISSION_PATH>`.
16. Run `/status <MISSION_PATH>`.

## Pass Criteria

- Dry-run commands do not write files.
- Apply commands write only allowed artifacts.
- Agent routing is explicit in command output.
- Skills are used as workflows, not authority owners.
- State transitions match `state-model.md`.
- The mission verdict is issued only by QA Validator; the milestone verdict is issued only by the independent milestone-reviewer cold crew (QA Validator is its fallback single cold pass).
- Correction Worker acts only on scoped correction assignments.
- Status reads tracked artifacts and does not rely on hidden state.
