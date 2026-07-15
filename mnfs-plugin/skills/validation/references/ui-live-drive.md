# UI Live-Drive (agent-browser) — Gate Reference Card

The gate's UI live-runtime pass drives a user-facing milestone with the
`agent-browser` CLI (public npm, pinned v0.29.1; Playwright + bundled Chromium,
headless by default). This card is the single source of truth: the
`/milestone-validate` command loads it, and the `qa-validator` subagent is given
this path at dispatch and MUST `Read` it before driving.

## Preflight (smoke — runs first)

```bash
agent-browser open about:blank && agent-browser screenshot "$TMP/preflight.png"
```

- Exit 0 AND a non-empty PNG → engine drives; proceed.
- Otherwise → record outcome `could-not-drive`, missing tool/runtime, and STOP the UI
  pass. A user-facing milestone with `could-not-drive` is **Blocked**, never a silent Pass.
  Never run `agent-browser install` from inside the gate — it is a one-time setup step.

## Driving a flow

Read each UI criterion's `Drive` block from `validation-contract.md`: the pinned
`Fixture` (seed roster + password) and the declared `Steps`. Drive the identical
steps every round. Reuse the daemon and auth across flows:

```bash
agent-browser open <url>
agent-browser snapshot -i                 # refs @e1, @e2 ...
agent-browser fill <label|@ref> "<value>"
agent-browser click <label|@ref>
agent-browser wait --load networkidle
agent-browser get url                     # assert url ~ <pattern>
agent-browser get text <label|@ref>       # assert text "<expected>"
agent-browser is visible <@ref>
agent-browser state save "<round-dir>/ui/auth.json"   # after first login; load on later flows
agent-browser close                       # when all flows done
```

Use semantic locators when refs are unstable: `agent-browser find role button click --name "Sign in"`.

## Mandatory evidence per flow (all five)

Write into `<milestone>/_gate-evidence/round-<N>/ui/`:

1. `screenshots/<flow>.png` — `agent-browser screenshot --full <path>`
2. `traces/<flow>.zip` — `agent-browser trace start` … `agent-browser trace stop <path>`
3. `network/<flow>.json` — `agent-browser network requests --json > <path>`
4. assertion record (expected vs observed: URL + key DOM text/role) — into `flows.json`
5. outcome — one of `validated | defect | could-not-drive | not-applicable`

Also write `drive-log.txt` (the transcript of agent-browser commands run) and
`flows.json` (one entry per flow):

```json
[
  { "id": "<flow>", "criterion": "<C-ID>", "expected": "<...>", "observed": "<...>",
    "outcome": "validated", "artifacts": { "screenshot": "screenshots/<flow>.png",
    "trace": "traces/<flow>.zip", "network": "network/<flow>.json" } }
]
```

## Evidence tree

```
<milestone>/_gate-evidence/round-<N>/
  ui/
    flows.json
    drive-log.txt
    screenshots/<flow>.png
    traces/<flow>.zip
    network/<flow>.json
    console/<flow>.log
  api/
    <criterion>.txt
```

## Outcome → verdict

| Condition | Outcome | Verdict effect |
|---|---|---|
| preflight fails / engine absent | `could-not-drive` | Blocked (record missing tool) |
| flow does not match expected | `defect` | FAIL ★1 + ★3 (★4 if a seam broke) |
| flow matches expected, 5 artifacts present | `validated` | contributes to Pass |
| non-runnable milestone | `not-applicable` | no UI requirement |

`_gate-evidence/` is gate-produced (the gate's live-runtime proof, canonical for the
live-runtime criterion) and is namespaced apart from feature-owned dirs (`F-*/`).
