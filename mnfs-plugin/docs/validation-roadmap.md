# MNFS Validation Roadmap

## Purpose

This roadmap defines the review order for preparing the MNFS Claude Code plugin for release. It keeps behavior validation first, then improves individual artifacts, then verifies the plugin in a terminal workflow.

## Quality Bar

Every reviewed artifact must have one clear job, one clear owner, concise runtime instructions, explicit inputs and outputs, inspectable evidence, and no hidden state.

## Path 1: Runtime Harness

Validate that the Claude Code plugin behaves like `diagrams.md`.

Review:

- command -> agent routing;
- Task/plugin-agent handoffs;
- skill workflow naming;
- dry-run and apply behavior;
- artifact ownership;
- validation verdict ownership;
- terminal verification checklist.

Exit criteria:

- every command has one runtime owner;
- agent handoffs are explicit where Task should be used;
- skills are methods, not authority owners;
- dry-run/apply boundaries are clear;
- `runtime-harness.md` explains the full flow.

## Path 2: Artifact Quality

Review agents, skills, commands, and references after the harness is correct.

Review order:

1. Mission planning.
2. Milestone orchestration.
3. Feature execution.
4. Validation and correction.
5. Mission closeout.
6. Transversal cleanup.

Exit criteria:

- agents own authority and blocked behavior;
- skills own reusable methods and reference routing;
- commands are thin entrypoints;
- references define artifact shape only.

## Path 3: Terminal Verification

Run the plugin through a small synthetic Mission -> Milestone -> Feature cycle in Claude Code.

Exit criteria:

- commands load;
- agents launch;
- skills are discovered;
- dry-run commands do not write files;
- apply commands write only allowed artifacts;
- state transitions match `state-model.md`;
- verdict ownership matches `validation-system.md`.
