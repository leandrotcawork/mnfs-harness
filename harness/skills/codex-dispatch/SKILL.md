---
name: codex-dispatch
description: Role-to-flags resolver for every codex dispatch in the harness (feature planning, implementation, investigation, gate review). Use whenever any session is about to call /codex:rescue or codex exec — resolves the role to the exact model/effort flags so nobody retypes the model matrix from memory.
---

# Codex Dispatch — role → exact invocation

The model matrix lives in `docs/superpowers/HARNESS.md` §1 (binding). This skill is the
mechanical resolver: pick the role, copy the line. Rules baked in: `--wait` always (SYNC to
the dispatching session), `--effort` ALWAYS explicit (the global codex default is `xhigh` —
omitting `--effort` silently burns time/cost), model ids exactly as written (a typo falls
through unvalidated).

## Roles

| Role | Invocation |
|---|---|
| Feature planner | `/codex:rescue --model gpt-5.6-sol --effort medium --wait <prompt>` |
| Implement worker (standard) | `/codex:rescue --model gpt-5.6-luna --effort high --wait <prompt>` |
| Implement worker (complex) | `/codex:rescue --model gpt-5.6-sol --effort low --wait <prompt>` |
| Investigator / bulk reads | `/codex:rescue --model gpt-5.6-luna --effort medium --wait <prompt>` |
| Gate review (GPT side of dual gate) | `/codex:rescue --model gpt-5.6-sol --effort medium --wait <prompt>` |

Complex = state machines, pollers, envelope gates, tricky SQL — flagged in the plan's slice
cards, not decided ad hoc at implement time.

## Two codex paths — opposite stdin behavior

1. **`/codex:rescue`** (default, everything above): companion runtime over `codex app-server`
   JSON-RPC. NO stdin hang risk — do not add stdin ceremony. `--wait`/`--background` are
   Claude-side flags (never forwarded into the codex call itself).
2. **Raw `codex exec`** (ONLY the hub's one-off precondition probe, or an OS-process
   background worker per HARNESS §3): the real binary in exec mode — in any non-tty shell it
   prints `Reading additional input from stdin...` and BLOCKS FOREVER unless stdin is closed.
   PowerShell: `@() | codex exec ...` · bash: `codex exec ... < /dev/null`. Silent ≥2 min =
   the hang, kill and re-issue.

## OS-process background worker (HARNESS §3 pattern)

When a milestone session runs codex workers as backgrounded OS processes: stdin closed (above),
stdout teed to a scratchpad log (`... 2>&1 | Tee-Object <scratchpad>\worker-<n>.log`), touch a
`.done` sentinel on exit, poll the sentinel — never poll the task panel. Every worker still
lands in the dispatch ledger; slice review before any dependent slice starts.
