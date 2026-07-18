---
name: codex-dispatch
description: Role-to-flags + path resolver for every codex dispatch in the harness (feature planning, implementation, investigation, gate review). Use whenever any session is about to call /codex:rescue or codex exec — resolves the role to the exact model/effort flags AND the correct dispatch path (OS-process vs companion), so nobody retypes the matrix from memory.
---

# Codex Dispatch — role → model/effort → path

The model matrix and the path rule live in HARNESS-CORE §1 (binding; ruling 2026-07-16). This
skill is the mechanical resolver: pick the role, take the flags, take the path. Rules baked in:
effort ALWAYS explicit (global codex default is `xhigh` — omitting it silently burns
time/cost), model ids exactly as written (a typo falls through unvalidated).

## Roles

| Role | Model / effort | Path |
|---|---|---|
| Feature planner | `gpt-5.6-sol` / `medium` | OS-process |
| Implement worker (standard) | `gpt-5.6-luna` / `high` | OS-process |
| Implement worker (complex) | `gpt-5.6-sol` / `low` | OS-process |
| Investigator / bulk reads | `gpt-5.6-luna` / `medium` | companion `--wait` |
| Gate review (GPT side of dual gate) | `gpt-5.6-sol` / `medium` | OS-process |
| Mission co-planner (planning P3, blind counter-proposal) | `gpt-5.6-sol` / `medium` | OS-process |
| Mission decomposition auditor (planning P5) | `gpt-5.6-sol` / `medium` | OS-process |
| Mission readiness gate (planning P7, full-tree) | `gpt-5.6-sol` / `high` | OS-process |

**Path rule (HARNESS-CORE §1):** expected >~2 min — anywhere a hang is indistinguishable from
work — dispatches as an OS process, so the run leaves a teed log (live view, §8 dashboard) and
a last-message file (ledger). Short probes/investigations may use the companion.

Complex = state machines, pollers, envelope gates, tricky SQL — flagged in the plan's slice
cards, not decided ad hoc at implement time.

## Path 1 — OS-process worker (long dispatches; HARNESS §3 pattern)

Real `codex exec` as a backgrounded OS process. Ceremony (field-verified 2026-07-16,
codex-cli 0.144.4 — probe: prompt-from-file + stdin closed + effort override + `-o` all
confirmed working together):

1. **Prompt from a file, always** — write `<scratchpad>/prompt-<id>.md` first; long inline
   args mangle quoting silently past the shell length limit.
2. **Stdin closed** — PowerShell `@() | codex exec ...` · bash `codex exec ... < /dev/null`;
   open stdin = `Reading additional input from stdin...` + BLOCKS FOREVER.
3. **Effort via config override** — `-c model_reasoning_effort=<effort>` (no dedicated flag).
4. **Verbatim capture** — tee full stream to `<scratchpad>/agent__<id>.log` (live view) AND
   `-o <scratchpad>/agent__<id>.last.md` (CLI writes the final message verbatim — this is the
   ledger's output artifact).
5. **`.done` sentinel on exit** — poll the sentinel, never the task panel.

PowerShell shape:

```powershell
@() | codex exec --model <model> -c model_reasoning_effort=<effort> --sandbox <mode> `
  -o "<scratchpad>\agent__<id>.last.md" "$(Get-Content <scratchpad>\prompt-<id>.md -Raw)" `
  2>&1 | Tee-Object "<scratchpad>\agent__<id>.log"; New-Item "<scratchpad>\agent__<id>.done"
```

Every worker still lands in the dispatch ledger (row points at the `.log` + `.last.md`);
per-feature adversarial review before any dependent feature closes (failing-test-first guards
the inter-slice steps — core §4, D-51).

## Path 2 — companion `/codex:rescue` (short dispatches)

`/codex:rescue --model <m> --effort <e> --wait <prompt>` — companion runtime over
`codex app-server` JSON-RPC. NO stdin hang risk — do not add stdin ceremony.
`--wait`/`--background` are Claude-side flags (never forwarded into the codex call itself).

- Output returns to the calling session's CONTEXT ONLY — no ledger-addressable artifact.
  Write the ledger row AT DISPATCH TIME; paste verbatim output into an evidence file the row
  points at.
- Multi-line prompts go via `--prompt-file <path>`, never inline `--task` — inline hits the
  shell command-length limit and mangles quoting SILENTLY (field-verified M-01: a truncated
  reviewer prompt still emits a confident verdict).

Raw `codex exec` outside the OS-process pattern is permitted ONLY for the hub's one-off
precondition probe.
