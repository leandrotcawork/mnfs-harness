# DESIGN-V2 — Conductor (SDK-native rebuild) — rev C (FROZEN)

Status: FROZEN 2026-07-17 — Sol align-r1 REDESIGN (all applied), align-r2 ALIGNED-WITH-CHANGES (`review/v2-align-r2.md`, findings 1–9 applied in this rev). Assumptions ledger CLOSED (STUDY §10). Implementation may dispatch against this rev.
Supersedes DESIGN.md (v1) where conflicting; INHERIT marks v1 sections adopted verbatim.

## 0. Principles

1. SDK-native; no rebuilding what SDK gives (STUDY §9).
2. YAGNI hard: Beta = ONE feature session per run. Deleted from rev A: held-open input queue (plain prompt + resume suffices), `ask_session` reservation, `report_event`, global registry.jsonl, `--detach`.
3. Fail-closed; unknown → deny/investigate.
4. Single serialized control flow is a MECHANISM, not an assumption: per-run terminalization latch (§4.3).

## 1. Process model

`conductor run` = foreground process alive while its one session lives. No detach in Beta (Sol S2: unproven on Windows; operator uses OS-level detach if needed — same proven Start-Process pattern the harness already uses, outside conductor's contract).

Commands:
- `run --card <card.json>` — admit → start session → stream → terminalize or park. Exit 0 completed / 2 waiting_operator / 1 else.
- `answer <questionId> "<text>"` — write immutable `answers/<questionId>.json` (wx-create; EEXIST = refuse, answer immutable).
- `resume <runId>` — re-admit, `query({resume: sessionId, prompt: answerTurn})`. Cap 2.
- `recover <runId>` — orphan reconciliation: verify owner dead (§4.2), then terminalize(investigate, 'orphaned') with synthesized receipt. Replaces v1 `mark` scope.
- `status`, `viewer` — read-only; discovery by scanning `runs/*/` (no global file).

## 2. Session invocation

```js
query({
  prompt: initialOrResumeTurnString,      // plain string; no streaming queue in Beta
  options: {
    model, maxTurns, maxBudgetUsd,
    settingSources: [],
    permissionMode: 'default',
    tools: role.tools,                     // built-in inventory; MCP inventory behavior = A4, smoke-gated with fallback below
    allowedTools: [],                      // gated tools NEVER here (shadowing, runtime-verified)
    disallowedTools: role.disallowed,      // MUST NOT match mcp__conductor__* (loader asserts; Sol B5)
    systemPrompt: { type: 'preset', preset: 'claude_code', append: role.append },
    mcpServers: { conductor: conductorServer },
    canUseTool: gate(role, runCtx),
    outputFormat: { type: 'json_schema', schema: RECEIPT_SCHEMA },
    cwd: card.worktree
  }
})
```
- Startup assertion: `system/init` message's tool list MUST contain `mcp__conductor__ask_operator`; absent → terminalize(failed, 'tool-inventory') before any work (Sol B5/B6).
- A4 fallback if `tools` array suppresses MCP tools: omit `tools`, enforce inventory by canUseTool deny-all-not-in-role instead (decision recorded after SMOKE-1).
- Role loader validation: gated tool in allowedTools → hard error at load (T6); disallowedTools pattern matching `mcp__conductor__` → hard error; AgentDefinition.permissionMode (exists [T]) — any subagent definition specifying a mode other than 'default' → hard error (STUDY §7 corrected).

## 3. Operator channel (OP-ASK)

### 3.1 `ask_operator({question, options?, context?})` — handler is DUMB (Sol B8)
Handler: append audit `question` → await `channel.waitForAnswer(questionId)` — a promise owned by the OUTER controller. Handler never closes, never parks, never touches lifecycle.

Controller logic on pending question:
1. Watchdog phase → operator_wait (timers off).
2. Poll `answers/<questionId>.json` every 2s, window default **3min** (per-card override; Sol S1).
3. Answer within window → final synchronous read at deadline wins linearly (INHERIT v1) → audit `answer_applied` → resolve handler promise with text → session continues.
4. Window expires → PARK SEQUENCE (§4.4).

Payload: zod-validated; question ≤ 4KB, options ≤ 16 × 200B, context ≤ 8KB; oversize → tool error (not park).

## 4. State, admission, terminalization

Layout: `output/conductor/runs/<runId>/{manifest.json, lease.json, ledger.jsonl, attempts/<n>.json, parks/<n>.json, receipt.json}` + `output/conductor/answers/<qid>.json` + `output/conductor/.admission.lock`.

### 4.1 Admission (two primitives, Sol B1)
- **Global admission mutex** = named pipe `\\.\pipe\mnfs-conductor-admission-<sha256(canonicalRoot)>`: acquired (listen) only across the admit/release critical section (ms-scale), closed on exit. EADDRINUSE → retry 100ms up to 15s → fail admission. Crash mid-section → pipe vanishes automatically → NO stale-reap protocol at all (same A8 primitive). Serializes: occupancy scan, cap check, lease acquisition, ledger `started|resumed` append.
- **Per-run occupancy lease** = **Windows named pipe** `\\.\pipe\mnfs-conductor-<userSID>-<sha256(canonicalRoot)>-<runId>` held (listening) for **process lifetime — NEVER manually released** (Sol r2 F1: manual release recreates old-owner overlap; pipe vanishes only at process death). runId MUST be UUID-format-validated before name construction (r2 F4). `runs/<runId>/lease.json` `{pid, startedAt, generation}` is metadata only, never a correctness guard. Liveness probe (under admission mutex): `net.createServer().listen(pipeName)` — normative error taxonomy (r2 F4): await 'listening' OR 'error'; **only EADDRINUSE ⇒ occupied/alive; ANY other error ⇒ fail closed (admission refused)**; probe listener close must be awaited before proceeding. Pipe auto-vanishes on process death — no stale reaping. A8 CONFIRMED (SMOKE-7); A7 handle-held file lock FALSIFIED (SMOKE-6, libuv FILE_SHARE_DELETE). Cap 2 = count of runs whose pipe is live.
- **Trust boundary (r2 F5):** same-host processes under the same Windows user are TRUSTED; pipe squatting by another local user is mitigated by embedding the user SID in the namespace (`whoami /user` value, hashed); squatting by same-user processes is out of scope for Beta (stated limitation). Foreign-holder behavior: EADDRINUSE from a non-conductor holder reads as occupied → admission refused (fail closed), never false-dead.
- **Ordering guarantee replacing generation-read guard (Sol r2 Q3/F1):** because the lease pipe is held until process death and admission requires the pipe to be acquirable, a new owner can only exist after the old owner PROCESS is dead — therefore no stale in-process callback can outlive its lease. Controller must tear down query/transport (bounded) before process exit on every path. `generation` remains recorded in events for forensics, not as a runtime guard.
- Same-canonical-worktree exclusion INHERIT v1.
- Generation: increments each admit of same runId; every ledger append and receipt write carries generation; stale-generation writes are rejected by the append guard (Sol M9 — old callbacks can't corrupt after new owner admitted).

### 4.2 Recovery (`recover`, Sol B4 + r2 F3)
Under admission mutex, ALL conditions required:
1. Pipe liveness probe says dead;
2. Current lifecycle state is EXACTLY `started` or `resumed` (waiting_operator → refuse with "use resume"; any terminal → refuse "already terminal"; no lifecycle → refuse "unknown run");
3. Manifest/ledger identity validated (runId in manifest matches directory, canonicalCwd matches).
Then: terminalize(investigate, 'orphaned', synthesizedReceipt). Live owner → refuse. T2e covers: kill-owner recovery, live-owner refusal, parked-run refusal, completed-run refusal, identity-mismatch refusal.

### 4.3 Terminalization latch (Sol B3)
In-process per-run once-latch: `terminalize()` = CAS on latch; first caller (result path, watchdog, signal handler, query-throw handler, park-timeout) wins; later calls no-op + audit `terminalize_suppressed` (r2 F6: this is a NORMATIVE audit event added to the taxonomy, state-preserving, fields `{generation, winnerKind, suppressedKind}` — ledger validator accepts it). Inside winner: bounded query/transport teardown → write receipt.json (tmp+rename) → append terminal lifecycle event → process exit with code (lease pipe dies WITH the process — never manually released, §4.1). Receipt-before-terminal INHERIT, race-free by latch.
**Latch owner-token (r2 F2):** the latch winner owns ALL subsequent transitions of its sequence — a park winner that later needs investigate (exit-unobserved) performs it DIRECTLY under its ownership (no second CAS, which would lose). Kinds: `terminal(state)` and `park`; park owner may escalate park→investigate within its own sequence.

### 4.4 Park sequence (waiting_operator is NOT terminal but uses same latch)
Latch CAS with kind=park; park owner then executes its whole sequence under owner-token (§4.3, r2 F2): persist `parks/<n>.json {questionId, payload, sessionId, fingerprint}` → `query.close()` → **bounded exit observation** ≤ 10s (operational bound, fails safe — Sol r2 Q2); observed → append `waiting_operator` → process exit 2 (lease dies with process). NOT observed → park owner DIRECTLY writes synthesized receipt + `investigate('unclean-park')` (no second CAS) — waiting_operator never appended over a possibly-live session. close() = bounded control-flow termination [T]; subprocess-exit bound is operational, not SDK-guaranteed (M17).

## 5. Ledger + audit

Per-run `ledger.jsonl`, single writer = lease holder, generation-guarded appends. Taxonomy INHERIT v1 minus `capability_request` replaced by canonical audit: **one function `auditDenial(toolUseID, source, tool, reason)`** called by BOTH PreToolUse hook denials and canUseTool denials, idempotent per toolUseID (Sol M10). Transition table INHERIT verbatim; first-event-must-be-started; terminal→nothing.

## 6. Permissions gate

INHERIT v1 wholesale (paths, ADS/device/UNC, fragments, bash 3-stage, roles.json) with §2 role-loader changes. PreToolUse hook mirrors path hard-denies; every deny routes through auditDenial.

## 7. Watchdog

Phases INHERIT. Kill: deadline → `interrupt()` raced vs 4.5s → `close()` unconditionally → bounded exit observation ≤10s → terminalize(investigate,'watchdog') via latch; exit unobserved → receipt records `exitUnobserved: true` (Sol M17). No unbounded awaits (each await raced vs timer). **[AMENDED r3: budget split]** One absolute cleanup budget: interrupt raced vs 4.5s, then exit observation ≤10s, total ≤14.5s < the T7 15s termination ceiling (SMOKE-4 evidence: ~2s typical). The prior "raced vs 10s" figure conflated the two windows and contradicted T7's aggregate limit; the code already implements the split (`WATCHDOG_INTERRUPT_MS=4500`, `EXIT_WAIT_MS=10000`), so this amendment reconciles the contract to the code, not the reverse.

## 8. Receipt

`structured_output` re-validated at boundary with zod (optional-unknown in types, Sol M13): missing on success / malformed / status conflicting with lifecycle → synthesized receipt + investigate. Error subtypes → synthesized receipt {subtype, usage, denials-from-ledger}. Query-throw → same path. Aggregation numeric INHERIT.

## 9. Resume invariants (normative, Sol M12 — INHERIT v1, restated)

R1 exactly one unanswered pending question; R2 sessionId must equal last `session_bound`; R3 stored answer immutable + authoritative (late edits refused by wx-create); R4 simultaneous resumes excluded by admission mutex + lease; R5 writer-cap and worktree exclusion rechecked at resume; R6 fingerprint drift → terminalize(investigate,'drift'); R7 cap 2 resumes → investigate.

## 10. Viewer

INHERIT v1 hardening. Sources: SDK session store for transcripts; per-run ledger for lifecycle/questions. Writes only answer files (wx).

## 11. Fingerprint

INHERIT v1 fully. Now test-covered (T11).

## 12. Tests (defined first; injected deps {queryFn, clock, dirs, ledger, transport})

T1 ledger: ordering, torn-line, full transition table, reserved fields, terminalize_suppressed accepted with {generation, winnerKind, suppressedKind} (r2 F6).
T2 admission: (a) mutex pipe serializes concurrent admits (barrier-spawned children, explicit winner/loser); (b) cap 2 admits two live, rejects third; (c) same-worktree exclusion; (d) pipe lease semantics REAL child test (EADDRINUSE alive / listen-ok dead — promote SMOKE-7); (e) kill-owner → recover claims; live-owner, parked-run, completed-run, identity-mismatch → recover refused (r2 F3); (f) crash mid-admission-section → next admit proceeds; (g) probe listener close awaited (no accidental theft); (h) injected EACCES/EPERM/unknown listen errors → fail closed; max-length + non-UUID runId rejected (r2 F4); (i) foreign pre-bound pipe → admission refused, never false-dead (r2 F5); (j) stale-writer barrier: old owner process must be dead before new admit possible (pipe-held-to-death, r2 F1).
T3 ask_operator fast path: answer t+5s → tool result, question+answer_applied audits, no park, watchdog off during wait; answer-at-deadline final-read race (Sol m20).
T4 park: sequence asserted via interceptor: parks-file → close → exit-observed → waiting_operator; exit-unobserved branch → park owner writes receipt + investigate('unclean-park') with ONE latch winner throughout (r2 F2); close called exactly once.
T5 resume: R1–R7 each violated → correct refusal; two-cycle park/resume; two SIMULTANEOUS resumes → one wins (barrier).
T6 roles/gate: gated-tool-in-allowedTools load error; disallowed matching mcp__conductor__ load error; subagent permissionMode!=default load error; v1 permission matrix INHERIT; NEGATIVE startup: injected init WITHOUT mcp__conductor__ask_operator → failed('tool-inventory') before any tool executes; no-init-before-result → same (r2 F7).
T7 watchdog: per-phase deadlines fake clock; never-settling next()/interrupt() → bounded close+terminalize <15s virtual; generic messages don't reset.
T8 receipt: happy structured_output; missing/malformed/conflicting → investigate; full error-subtype union; query-throw; denials: PreToolUse-denied + canUseTool-denied same toolUseID counted ONCE; aggregation.
T9 concurrent terminalize: result-vs-watchdog-vs-signal race (3 async entrants, latch) → one receipt, one terminal event, others suppressed+audited with terminalize_suppressed fields; park-vs-terminal race → single winner owns full sequence (r2 F1/F2 barriers at check/commit boundary).
T10 viewer: INHERIT v1.
T11 fingerprint: git-failure fail-closed, linked worktree roots, NUL raw untracked, content hashes, park capture, resume drift detection.
T12 smoke (CONDUCTOR_SMOKE=1): STUDY assumption ledger promoted to assertions (A1 tool-hold, A3 resume-after-close, A4 MCP inventory + init-assertion, A5 close-releases+exit, A6 outputFormat+MCP coexist, A7 Windows handle-delete).
T13 payload limits + boundaries (r2 F8): question/context/options at exact limit pass, one over → tool error not park; options count 16 ok / 17 rejected, element 200B ok / 201B rejected; malformed answer file ignored + logged; barrier-raced concurrent answer writers → exactly one wins (wx), loser refused; exit-code assertions for run(0/2/1), resume, recover.

## 13. Round-2 questions for Sol

Q1 RESOLVED pre-round: A7 falsified (SMOKE-6), named-pipe lease adopted and confirmed (SMOKE-7/A8) for BOTH per-run lease and global admission mutex. Attack the pipe design instead (name collisions, pipe-name length, ACLs, EADDRINUSE-vs-other-error handling, probe listener races).
Q2 Park exit-observation bound 10s — enough on Windows (SDK close() does SIGKILL escalation at ~5s internally)?
Q3 Generation guard granularity: per-append check via lease read — acceptable IO cost vs in-memory generation captured at admit?
