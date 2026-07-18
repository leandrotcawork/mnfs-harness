# STUDY — Agent SDK → Harness mapping (pre-DESIGN-V2)

Status: study deliverable per operator directive ("estudar → planejar → contratos/assunções/testes → só então código").
Sources: installed `@anthropic-ai/claude-agent-sdk@0.3.212` sdk.d.ts (ground truth for callability) + official docs study (code.claude.com/docs/en/agent-sdk/*, agent report 2026-07-17).
Every claim tagged: **[T]** = verified in installed types, **[D]** = verified in official docs, **[A]** = assumption (must be smoke-tested before relied on).

---

## 1. Operator requirement (restated from operator, governing)

Sessions exist per harness level (hub, milestone, feature). They must be able to:
1. Talk to each other (routed by conductor).
2. At any moment, suspend and ask the OPERATOR a clarification/decision question; operator answers on their own time; session resumes with the answer.

Mechanism is an implementation detail. AskUserQuestion interception (v1) is NOT required.

## 2. Core session model

| Harness concept | SDK primitive | Tag |
|---|---|---|
| A session (hub/milestone/feature) | one `query()` call; subprocess per query | [T][D] |
| Session identity | `session_id` from `system/init` message and result message | [T][D] |
| Keep session able to receive messages | `prompt: AsyncIterable<SDKUserMessage>` — WE hold the queue open; push = live injected turn | [D] (canonical message-queue pattern) |
| Suspend session (park) | persist pending state → `Query.close()` (forceful, sync) | [T]; close() recommended on Windows [D] |
| Resume with full context | new `query({ options: { resume: sessionId } })`; history rehydrated | [T][D] |
| Branch/retry from snapshot | `resume + forkSession: true` (new id, original untouched; file edits NOT rolled back) | [T][D] |
| Concurrent sessions | multiple `query()` in one Node process; independent options/cwd; shared auth | [D] |

**Rejected:** `Query.streamInput()` exists in types [T] but absent from official docs [D] → treat as unstable, do not build on it. Held-open input queue is the documented equivalent.
**Rejected:** v2 session API (`unstable_v2_*`) — removed in 0.3.142 [D].

## 3. Operator channel (primitive OP-ASK)

Implementation: in-process MCP server via `createSdkMcpServer` + `tool()` [T]; exposed tools:

- `ask_operator({question, options?, urgency?})` → conductor handler:
  - **Fast path**: hold the tool promise; poll answer store (answers/<id>.json, written by CLI `mark` or viewer); answer arrives within window (default 30min) → return as tool result; session continues same turn. No park.
  - **Park path**: window expires → persist pending question (runId, sessionId, questionId, payload) → `query.close()` → lifecycle `waiting_operator`. Later: `conductor resume <runId>` re-queries with `resume: sessionId`, answer injected as first user turn.
- `ask_session({target, message})` → inter-session routing: conductor pushes an SDKUserMessage into target session's held-open input queue [D]; reply routed back as tool result (same fast/park logic if target slow).

Why not AskUserQuestion interception (v1 approach): pending `canUseTool` promise is NOT resolved by `interrupt()` — hangs forever unless `close()` [D]; AskUserQuestion unavailable inside subagents [D]; interception + 60s drain protocol was the largest complexity + defect source in v1 (R1–R3). Our own tool = we own the promise; suspension is plain code.
MCP tool annotation `anthropic/requiresUserInteraction: true` available if we ever want it to route through canUseTool anyway [D] — not used in v2.

## 4. Permissions

Documented evaluation order [D]: hooks(PreToolUse) → deny rules → ask rules → permissionMode → allow rules → canUseTool.

v2 gate recipe (fail-closed):
- `permissionMode: 'default'` (NOT dontAsk — dontAsk denies before canUseTool reaches us) [T][D]
- `tools: [...]` inventory restriction per role [T]
- `disallowedTools` for scoped hard-denies (e.g. `Bash(rm *)`) [T][D]
- `settingSources: []` — no user/project settings leak [T]
- `canUseTool` = final decision + audit; PreToolUse hook = defense-in-depth path screens (deny wins over everything) [D]
- **[T, runtime-verified SMOKE-1]** bare `allowedTools` entries SHADOW canUseTool (SDK emits `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED` warning): auto-approved before callback. Gated tools must NOT appear in allowedTools; they fall through to canUseTool via the ask/default path.
- Subagents inherit permissionMode; cannot loosen per-subagent — scope via `AgentDefinition.tools`/`disallowedTools` [D]

## 5. Lifecycle control

| Need | Primitive | Tag |
|---|---|---|
| Runaway turns | `maxTurns` → result `error_max_turns` (resumable with higher cap) | [T][D] |
| Cost cap | `maxBudgetUsd` → `error_max_budget_usd`; client-side ESTIMATE, not billing truth | [T][D] |
| Watchdog kill | bounded race on iterator progress → `interrupt()` bounded → `close()` unconditional | close() = bounded CONTROL-FLOW termination [T]; subprocess-exit completion has NO receipt in types → [A5]; observe exit bounded, record if unobserved (Sol align-r1 M17) |
| Timeout | AbortSignal / own timers; no built-in timeout option | [D] |
| Hung canUseTool | only `close()` releases it | [D] |

## 6. Completion + observability

- Completion receipt: `outputFormat: {type:'json_schema', schema}` → validated `structured_output` on result [T][D]. Failure subtype `error_max_structured_output_retries`. Cannot be forced from Stop hook [D] — set at query start.
- Result union [T]: `success | error_during_execution | error_max_turns | error_max_budget_usd | error_max_structured_output_retries`.
- Usage: per-message `usage` excludes subagents; `total_cost_usd` + `modelUsage` include them; dedupe parallel tool_use by message id [D].
- Viewer/registry: session store functions `listSessions/getSessionInfo/getSessionMessages/getSubagentMessages/tagSession/renameSession` [T][D] replace transcript half of v1 custom registry. `getSessionMessages` returns POST-compaction chain [D]. Conductor still keeps a thin lifecycle ledger (run→sessionId binding, pending questions, receipts) — session store has no custom metadata [D].
- Hooks for audit: PreToolUse (gate), PostToolUse (audit log), Stop (`last_assistant_message`), SubagentStart/Stop, Notification [T][D].

## 7. Subagents

`agents: Record<name, AgentDefinition>` [T][D] — per-agent prompt/tools/model/effort/maxTurns/background. Isolated context (no parent history). Max nesting 5 [D]. AskUserQuestion unavailable inside [D] → operator questions only via our MCP tool or top-level. Windows: >8191-char agent prompt may fail (CLI arg limit) [D].
**CORRECTED (Sol align-r1 B7):** `AgentDefinition.permissionMode?: PermissionMode` EXISTS in sdk.d.ts [T] — subagents CAN specify their own mode. Earlier claim "cannot loosen per-subagent [D]" was wrong. Harness stance: conductor role loader REJECTS any agent definition with permissionMode ≠ 'default' (DESIGN-V2 §2).

## 8. Windows notes [D]

- Explicit `close()` when stopping unfinished queries (signal propagation unreliable).
- Generator throw inside streaming prompt surfaces as "process aborted by user" — guard generator code.
- Unique `CLAUDE_CONFIG_DIR` per session if temp races appear [A — only if observed].

## 9. What v1 built that SDK gives free (delete-list for DESIGN-V2)

| v1 custom | Replacement |
|---|---|
| AskUserQuestion interception + 60s drain + park ceremony | OP-ASK tool (own promise) + `close()` |
| Registry as transcript source for viewer | session store read functions |
| Watchdog unbounded interrupt/return awaits | bounded race + `close()` |
| Prose completion parsing | `outputFormat` json_schema receipt |
| Much of fingerprint-on-park | `enableFileCheckpointing`/`rewindFiles` candidate [T, docs unverified → [A], keep git fingerprint until smoked] |

Kept from v1 (still ours): lifecycle ledger (thin), admission/writer-cap (redesigned: Windows named-pipe admission mutex + per-run occupancy lease held to process death — see A8; handle-held file lock was falsified by SMOKE-6), role policy files, bash 3-stage gate, viewer HTTP hardening.

## 10. Assumptions ledger (smoke before code freeze)

A1 [A] createSdkMcpServer tool handler may block awaiting external input for minutes without CLI-side timeout killing the tool call. — SMOKE-1
A2 — WITHDRAWN (held-open input queue deleted from DESIGN-V2 rev B, Sol YAGNI cut 21).
A3 [A] `resume` after `close()` mid-turn yields consistent history (last incomplete turn dropped or replayable). — SMOKE-3
A4 [A] With `tools: [...]` set, in-process MCP tools still appear in effective inventory as `mcp__<server>__<tool>` (types describe `tools` as built-in base inventory only — Sol B6); verify via system/init tool list + actual invocation. Fallback if false: omit `tools`, enforce inventory in canUseTool. — SMOKE-1
A5 [A] `close()` releases held canUseTool/tool promises AND subprocess exits ≤10s on Windows (SDK internally escalates SIGKILL ~5s). — SMOKE-4
A6 [A] outputFormat structured_output coexists with in-process MCP tools + resume. — SMOKE-5
A7 FALSIFIED (SMOKE-6, 2026-07-17): libuv opens files with FILE_SHARE_DELETE — delete SUCCEEDS while handle open. Handle-held file lock is NOT a liveness primitive on Windows+Node. Sol align-r1 B2 confirmed.
A8 CONFIRMED (SMOKE-7, 2026-07-17): Windows named pipe (`net.createServer().listen('\\\\.\\pipe\\<name>')`) is exclusive per name → EADDRINUSE while holder alive; pipe auto-vanishes on holder death (SIGKILL tested) → next listen succeeds. Zero stale state. ADOPTED as per-run occupancy lease + liveness probe (DESIGN-V2 §4.1). Windows-only; portability note: unix domain sockets leave stale files — revisit if conductor ever leaves Windows.

Each SMOKE-n = tiny standalone script under `conductor/smoke/`, run before DESIGN-V2 freeze; results recorded here.

**LEDGER CLOSED 2026-07-17** (post operator `/login`, real SDK sessions, haiku, ~$0.15 total):
- A1 CONFIRMED (SMOKE-1): handler held 45s, answer returned as tool result, session continued, result success.
- A3 CONFIRMED (SMOKE-3): close() mid-turn → resume same sessionId → context retained (recalled magic word).
- A4 CONFIRMED (SMOKE-1b): `tools: ['Read']` + mcpServers → init inventory exactly `["Read","mcp__conductor__ask_operator"]`; invoked; canUseTool consulted. §2 fallback unnecessary.
- A5 CONFIRMED (SMOKE-4): close() with never-resolving handler → iterator released in 2.0s, process exited clean.
- A6 CONFIRMED (SMOKE-5): outputFormat json_schema + MCP tool same session → valid structured_output carrying tool answer.
- A7 FALSIFIED / A8 CONFIRMED — see above (named-pipe lease adopted).
- Runtime finding: bare allowedTools entries shadow canUseTool (SDK warning, §4).
