---
description: Use when starting or resuming an MNFS mission that needs planning through readiness — scope clarification, research, architecture, decomposition, validation contracts.
argument-hint: "[MISSION_GOAL_OR_PATH] [--apply]"
allowed-tools: Read, Glob, Grep, LS, Write, Edit, MultiEdit, Task, AskUserQuestion, Skill
---

# MNFS Mission Init

Invoke the `mission-planning` skill and run its gated state machine (P0–P7) in this session. At the two human gates (P1 clarify, P3 scope), ask the operator directly with `AskUserQuestion`. For P2 research, dispatch `external-researcher` or `codebase-investigator` via Task.

Runtime paths come from `$ARGUMENTS`; package paths are relative to `mnfs-plugin/`.

## Inputs

- Mission goal or existing mission path.
- Workspace path.
- Optional constraints, QA level, evidence, and research notes.

Ask only for missing inputs that block the next protocol decision.

## Write Gate

Default to dry run. Propose the mission ID, unresolved owner decisions, and write set before mutation.

In dry run, report by current planning phase and never emit a later phase's content early:

- **P1 (clarify gate):** intake summary; the P1a domain capability menu (lean-core preselected) followed by the P1b architecture clarification interview, then the P1c quality-attribute & risk menu (baseline preselected); `Planning BLOCKED pending answers`; the evidence-path convention; new vs resumed mission with the concrete mission path. No milestone split, no feature density, no interface contract.
- **P3 (scope gate):** resolved-semantics recap; architecture spine (ADR-lite); milestone headlines with order and dependencies; research summary; `Awaiting scope approval`. No feature briefs, no full contracts.
- **P7 (readiness):** shared contract topics that would be written on apply; the full milestone split; feature brief density by boundary type that would still need hardening; the `architecture-map.md` views when the diagram trigger holds; the evidence-path convention; the readiness verdict sourced from the independent `mission-reviewer` (`readiness-review.md`) with the failing/auto-revised criteria and rounds used.

When resuming an existing mission in dry run:

- do not propose a replacement mission ID unless the existing mission is clearly out of scope;
- state whether the current mission artifacts already satisfy the requested scope;
- state whether any existing milestone or feature artifacts still look too thin for execution, and name them if so.

Write only when `$ARGUMENTS` contains `--apply` or the user explicitly approves apply/write/create. Follow the mission-planning protocol's runtime boundary; do not create implementation or feature execution artifacts.

## Clarify Gate (P1)

The P1 clarify gate — P1a domain scan, P1b architecture clarify, then P1c quality-attribute & risk scan, one STOP — runs entirely from the `mission-planning` skill; do not restate its mechanics here. Use `AskUserQuestion` for all three passes (multi-select for P1a and P1c, one question per blocking taxon for P1b); fall back to a numbered text list if unavailable.

For dry runs, the response must include a concise operator-facing summary with:

1. `Mode`, `Write now`, and `Mission path`
2. `New mission` or `Resume existing mission`
3. `Planning phase` (P1 clarify / P3 scope / P7 readiness)
4. Phase-appropriate body (per the phased contract above)
5. `Evidence path convention`
6. `Next gate` — what the operator must answer or approve to advance, or `Why needs revision` / `Why blocked` at P7
