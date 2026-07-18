# conductor — Beta build spec (v0.1.0-beta)

Headless execution plane for the hub-and-chips harness. Runs one Claude feature
session per invocation via the Agent SDK, with a fail-closed permission gate,
durable JSONL state, operator question protocol, and a localhost viewer.
Design ratified 2026-07-17 (architect + GPT-5.6 Sol adversarial round).

## Non-goals (Beta)

No daemon. No database. No user authentication (loopback + CSRF header only).
No weighted quota semaphore (flat cap). No Codex dispatch (PowerShell lane owns
that). No automatic context-pack generator. No SSE (polling only). No TypeScript,
no build step, no dependencies beyond `@anthropic-ai/claude-agent-sdk`.
Tests use `node:test` only.

## CLI

```
node src/conductor.mjs run    --feature <id> --card <path> --cwd <worktree> [--role writer|reviewer] [--model <m>]
node src/conductor.mjs resume --run <runId> --answer-file <path>
node src/conductor.mjs mark   --run <runId> --state investigate|cancelled --reason <text>
node src/conductor.mjs status
node src/viewer.mjs           [--port 4317] --state <stateDir>
```

Exit codes: 0 = terminal `completed`; 2 = `waiting_operator` (parked); 1 = anything else.

## State layout

All state under `<cwd-repo-root>/output/conductor/` ("stateDir"):

```
registry.jsonl               append-only event log (single source of truth)
answers/<eventId>.json       immutable operator answers
runs/<runId>/manifest.json   first-run identity: feature, role, card path+sha256, roles.json sha256, canonical roots, fingerprint
runs/<runId>/attempts/<n>.json  per-attempt record (sessionId, options used, result subtype, usage)
runs/<runId>/parks/<n>.json  park receipt (pending eventId, fingerprint at park)
runs/<runId>/receipt.json    final receipt (terminal runs only)
.admission.lock              transient admission mutex
```

All JSON files written atomically: write `<name>.tmp` in same directory, flush
(`fsync`), rename. Answer files additionally must NOT replace an existing
destination: temp write + flush, then no-replace publication (`copyFile` with
`COPYFILE_EXCL` or `link`+unlink of temp — either is fine, but EEXIST must be
caught and surfaced as "duplicate", not crash). First write wins.

## registry.mjs

`appendEvent(registryPath, evt)` — adds `ts` (ISO) + `eventId` (uuid) +
`schemaVersion: 1` itself; REJECTS caller-supplied `ts`/`eventId`/`schemaVersion`
(throw). One `appendFileSync` call per record (single write, `\n`-terminated).

Record shape: `{ts, eventId, schemaVersion, runId, feature, role, cwd, attempt, event, reason?, data?}`.
`cwd` stored canonical (realpath). `reason` required for `investigate`, `failed`, `cancelled`, `watchdog_kill`.

Event taxonomy — two classes:

- **Lifecycle (state-bearing):** `started`, `waiting_operator`, `resumed`,
  `investigate`, `completed`, `failed`, `cancelled`.
- **Audit (state-preserving):** `session_bound`, `question`, `capability_request`,
  `answer_applied`, `watchdog_kill`.

`runState(events, runId)` — reducer returning latest LIFECYCLE state; audit
events never change state. `appendEvent` validates lifecycle transitions:

```
started → waiting_operator | investigate | completed | failed | cancelled
waiting_operator → resumed | investigate | cancelled
resumed → waiting_operator | investigate | completed | failed | cancelled
terminal states (investigate, completed, failed, cancelled) → nothing (throw)
```

`readEvents(path)` — skip torn/malformed lines silently (crash tolerance).
`activeRuns(path)` — runs whose lifecycle state is `started` or `resumed`.
`countResumes(path, runId)` — count of `resumed` events.

LIFECYCLE appends must be serialized across processes: acquire the admission
mutex (below) before validate+append of any lifecycle event. Audit events may
append lock-free (single write). Read-then-validate without the mutex is a race.

Lock acquisition semantics differ by purpose: ADMISSION (new run / resume
entry) is fail-fast — contention refuses the run. LIFECYCLE FINALIZATION
(`waiting_operator`, `investigate`, `completed`, `failed`, `cancelled`,
`answer_applied`-on-resume) must NOT be lost to contention: wait-and-retry the
mutex (250ms interval, 30s cap; cap exhausted → last-resort append with
`lockTimeout: true` in `data` — losing a terminal event is worse than a rare
unserialized append).

ALL terminalization (any path that appends a terminal lifecycle event —
normal completion, watchdog, resume-drift, `mark`) goes through ONE shared
routine that writes `receipt.json` BEFORE appending the terminal event.

Question/capability envelopes live IN the registry (`question` /
`capability_request` audit events, envelope in `data`). No separate questions.jsonl.

## admission (in conductor.mjs)

Before `started` (and before `resumed` — resume goes through full admission too):
1. Acquire `.admission.lock` via exclusive-create (`wx` flag) writing
   `{pid, ts, token}` where `token` is a random uuid held in memory.
   If exists: if older than 30s OR pid dead → attempt stale reap: rename the
   stale lock to `.admission.lock.reap-<uuid>` (atomic claim — only the renamer
   wins), delete it, then retry exclusive-create once; else refuse (exit 1).
   Release: verify the lock file still contains OUR token before unlink; if
   token differs, do NOT delete (another process owns it).
2. Under lock: count `activeRuns` with role `writer`; if ≥ 2 → refuse (`ADMISSION-FULL`).
3. Under lock: if any active run has same canonical `cwd` → refuse (`WORKTREE-BUSY`).
4. Append `started`, release lock.

Crashed runs KEEP their slot until operator runs `mark --state investigate`.
Never auto-reap an active run.

## permissions.mjs

`decide(toolName, input, policy, ctx{cwd}) → {allow:true} | {allow:false, reason, capabilityRequest?:true}`

Read-only canonicalization allowed (realpath of existing ancestors); no other IO.

- Unknown tool (not in `policy.tools`) → deny, `capabilityRequest: true`.
- `Write`/`Edit`/`NotebookEdit`: `input.file_path` must resolve inside `ctx.cwd`.
  RELATIVE paths resolve against `ctx.cwd`, NEVER `process.cwd()`.
  Containment check: canonicalize deepest existing ancestor, `path.relative`,
  reject if result starts with `..` or is absolute; case-insensitive compare
  (win32). BEFORE any filesystem access, reject on raw string: NTFS ADS
  (any `:` beyond the drive spec, including relative forms like `sub\x:ads`),
  device paths (`\\.\`, `\\?\` AND forward-slash forms `//./`, `//?/`), and
  UNC (`\\host\share` AND `//host/share`) — all must return hard deny, never
  throw. Violation → deny (no capabilityRequest — hard deny).
- `Read`/`Glob`/`Grep`: allowed anywhere under repo root EXCEPT hard-denied
  path fragments: `.ssh`, `.aws`, `.gnupg`, `credentials`, `.claude.json`,
  `id_rsa` → hard deny EVERYWHERE (inside or outside cwd). `.env` → hard deny
  only outside cwd.
- `AskUserQuestion`: always reaches the gate; handled by the question protocol
  (never auto-allowed, never denied outright).
- `Bash`: see gate below.
- Anything else in policy but with no rule → deny + capabilityRequest.

### Bash gate (no shell parsing)

Stage 1 — reject if command contains ANY of: CR, LF, `"`, `'`, backslash-escape
of a metachar, `=` in first token (env assignment), `>`, `<`, `|`, `;`, `&`,
`$`, backtick, `%`, `!`, `(`, `)`, or first token in {`cmd`, `cmd.exe`,
`powershell`, `pwsh`, `sh`, `bash`}. Reject unknown fields on Bash input
(anything beyond `command`, `description`, `timeout`). Rejection → deny
(hard, reason `BASH-METACHAR`).

Stage 2 — split on ASCII whitespace (space AND tab); every token must match
`^[A-Za-z0-9_./:@,+=-]+$` (any other char, incl. unicode whitespace → hard
deny). Never-list check runs on LOWERCASED tokens and is position-INSENSITIVE
for the operation word: executable in {`npx`, `curl`, `wget`, `rm`, `del`,
`rmdir`, `sc`, `reg`, `schtasks`, `remove-item`} → hard deny; executable `git`
with ANY token in {`push`, `remote`, `fetch`, `pull`, `clean`, `reset`,
`checkout`, `restore`} → hard deny; executable `npm` with ANY token in
{`publish`, `install`, `i`, `ci`, `exec`, `x`} → hard deny. Never-list wins
over matrix.

Stage 3 — match against role's argv matrix (exact prefix match on tokens).
Matrix-matched commands are then screened for escape flags: any token equal to
or starting with `-o`, `--output`, `-exec`, `-toolexec`, `-vettool`, `-c`,
`--config`, `--ext-diff`, `--textconv`, `--work-tree`, `--git-dir`,
`--upload-pack`, `--exec-path`, `--no-index`, `--prefix`, `--script-shell`,
`--shell`, `--cd`, `-C` → hard deny. Matrix match + no escape flag →
allow. No matrix match, syntactically safe → deny + `capabilityRequest: true`.

Quoted paths and clever commands are deliberately sacrificed — they become
capability requests the operator can adjudicate.

## roles.json (repo-fixed at `conductor/roles.json`, sha256 recorded in manifest)

```json
{
  "writer": {
    "tools": ["Read", "Glob", "Grep", "Write", "Edit", "Bash", "AskUserQuestion"],
    "bashMatrix": [
      ["go", "test"], ["go", "build"], ["go", "vet"],
      ["npm", "test"],
      ["npm", "run", "test"], ["npm", "run", "lint"], ["npm", "run", "build"], ["npm", "run", "typecheck"],
      ["git", "--no-pager", "status"], ["git", "--no-pager", "diff"],
      ["git", "--no-pager", "log"], ["git", "--no-pager", "show"]
    ],
    "maxTurns": 200,
    "toolTimeoutMs": 1800000,
    "modelWaitTimeoutMs": 600000
  },
  "reviewer": {
    "tools": ["Read", "Glob", "Grep", "Bash"],
    "bashMatrix": [
      ["git", "--no-pager", "status"],
      ["git", "--no-pager", "diff"],
      ["git", "--no-pager", "log"],
      ["git", "--no-pager", "show"]
    ],
    "maxTurns": 60,
    "toolTimeoutMs": 600000,
    "modelWaitTimeoutMs": 600000
  }
}
```

No `TodoWrite`, no `Task`, no `git add/commit` (Beta: conductor reports; operator
or hub commits), no installs, no network tools.

## conductor.mjs — session options

```js
query({ prompt: cardText, options: {
  cwd, model,
  permissionMode: 'default',        // NOT dontAsk — it short-circuits canUseTool
  tools: policy.tools,              // inventory restriction
  allowedTools: [],                 // nothing auto-approved; canUseTool sees everything
  disallowedTools: [...complement], // defense-in-depth: Task, TodoWrite, WebFetch, WebSearch, mcp__*
  settingSources: [],               // isolate from user/project permission rules
  systemPrompt: { type: 'preset', preset: 'claude_code', append: doctrineAppend },
  maxTurns: policy.maxTurns,
  resume: sessionId,                // resume path only
  canUseTool: gate,                 // sole decision point
}})
```

`gate` = wraps `permissions.decide()`; on deny appends `capability_request`
audit event when flagged; on `AskUserQuestion` runs the question protocol.
Unknown tools denied. Emit `session_bound` audit event as soon as the init
message delivers `session_id`.

## Question protocol (bounded block → durable park)

On `AskUserQuestion` in `canUseTool`:
1. Append `question` audit event (envelope in `data`: questions[], runId,
   feature, decision_class if provided).
2. Suspend watchdog (phase `operator_wait`).
3. Poll `answers/<eventId>.json` every 2s up to `questionTimeoutMs` (default 30 min).
4. Answer format `{eventId, answers: {[exactQuestionText]: answerString}}` —
   validate keys match the envelope's question texts exactly; mismatch → treat
   as absent (keep polling), log warning.
5. Answer arrives → append `answer_applied` audit event → return
   `{behavior:'allow', updatedInput: {...input, answers}}`. Session continues live.
6. Deadline: ONE final synchronous read. Present → apply (step 5). Absent →
   parking is irrevocably chosen; any later answer is resume-only.
7. Park: return `{behavior:'deny', message:'operator unavailable; parked as <eventId>', interrupt:true}`.
   Drain with ONE ABSOLUTE deadline (now + 60s — does NOT reset per message).
   Clean park requires BOTH: a `result` message observed AND iterator
   completion, within the deadline. If deadline passes without both: `await
   query.interrupt()` (fallback — await it, catch rejection), grant 10s more;
   still unclean → close iterator, append `investigate` (reason
   `unclean-park`), NOT `waiting_operator`.
   Clean: compute fingerprint NOW (after drain — not the pre-deny snapshot),
   write `parks/<n>.json` (pending eventId, fingerprint) atomically, THEN
   append `waiting_operator` (this event alone makes the run resumable).
   No `receipt.json` on park — receipts are for terminal states only.

## Resume

`conductor resume --run <id> --answer-file <path>`:
1. Acquire admission mutex. ALL checks below run under it; `resumed` appended
   under it. Resume also re-passes admission (writer cap, same-worktree
   exclusion) — a resume is a new active session.
2. Registry state must be `waiting_operator`; EXACTLY ONE unanswered question
   eventId (latest park receipt's pending eventId with no `answers/<eventId>.json`
   answer already applied) — zero or multiple → refuse.
3. Session binding: park's sessionId must be non-null and match the run's last
   `session_bound` audit event — mismatch → refuse.
4. `countResumes ≥ 2` → refuse: "resume cap — start fresh session from context
   pack" (exit 1).
5. Validate answer file keys against pending envelope's question texts.
6. Publish answer to `answers/<eventId>.json` (immutable). If an answer already
   exists there, the STORED answer is authoritative — supplied file must match
   it exactly or refuse.
7. Fingerprint check vs park receipt. Drift → append `investigate` (reason
   `resume-drift`), refuse.
8. Append `resumed`, release mutex, then `query({resume: sessionId, prompt})`
   where prompt = "Operator answered question <eventId>: <question → answer per
   line>. Continue." Prompt is built from the STORED answer. The original tool
   call is NOT resurrected; answers arrive as new user turn.

## Fingerprint (recorded in manifest at start, in park receipt at park)

- Canonical repo root (`git rev-parse --git-common-dir` parent, canonicalized)
  AND worktree root (`--show-toplevel`, canonicalized) — derived independently.
- HEAD sha, branch.
- sha256 of `git diff --binary HEAD` output.
- Sorted untracked files (paths + each content sha256), from
  `git ls-files -z --others --exclude-standard` — parse raw NUL-delimited
  output, NO trim (leading-whitespace paths are legal), excluding `.git/` and
  `output/conductor/`.
- Card sha256, roles.json sha256.

Any git command failure → fail CLOSED (throw / `investigate`), never empty
fields. Compare full structure before resume. Any difference → `investigate`.

## Watchdog (phase-based, in conductor.mjs)

Three phases tracked from the message stream:
- `operator_wait`: inside question protocol — watchdog OFF.
- `tool_running`: between `tool_use` and matching `tool_result` — hard cap
  `toolTimeoutMs` (default 30 min).
- `model_wait`: no outstanding tool call — cap `modelWaitTimeoutMs` (10 min).

Phase mechanics: maintain a SET of outstanding tool_use IDs; `tool_running`
while the set is non-empty (a single tool_result or interleaved assistant
message does NOT end the phase while other calls are outstanding); `model_wait`
only when the set is empty. The stream-wait timer uses the ACTIVE phase's
deadline (`toolTimeoutMs` during tool_running, `modelWaitTimeoutMs` during
model_wait, none during operator_wait) — never a fixed timeout.

Progress = assistant content block, tool_use, tool_result, or result message
ONLY. Generic/system/status messages do NOT reset timers.
Timeout → async handler: `await query.interrupt()` (catch + record rejection),
append `watchdog_kill` (audit, with phase + elapsed + interrupt outcome), then
`investigate` (lifecycle). Every watchdog timeout produces `watchdog_kill`
before `investigate` — a phase timeout must never surface as plain `failed`.
NEVER auto-restart.

## Receipt (`runs/<runId>/receipt.json`, terminal runs)

`{runId, feature, role, cardSha256, rolesSha256, model, sdkVersion, options
snapshot, sessionIds[] (all attempts), attempts, resultSubtype, stopReason,
errors, numTurns, durationMs, usage, modelUsage, totalCostUsd, denials[]
(toolName+reason), questionEventIds[], watchdogEvents[], fingerprintStart,
fingerprintEnd, aggregates}`.

Receipt written BEFORE the terminal lifecycle event is appended. Terminal
states ONLY (`completed`, `failed`, `cancelled`, `investigate`) — never on park.
Cross-attempt fields (`sessionIds`, `denials`, `questionEventIds`,
`watchdogEvents`, usage aggregates) accumulate across ALL attempts — read
`attempts/*.json` + registry when building the receipt; an attempt must never
reset them. `fingerprintStart` = the MANIFEST's original fingerprint (attempt 1),
not the latest resume's. Preserve SDK `result.errors`/stop reason verbatim.

## viewer.mjs

- Bind `127.0.0.1` strictly.
- `GET /` → single-page HTML (inline, no assets): table of runs (from
  `/api/state` polled every 2s), pending questions with answer forms.
  ALL registry/model-controlled values (questions, options, run fields) are
  rendered via `textContent`/DOM construction — NEVER string-concatenated into
  `innerHTML` (a malicious question could otherwise execute same-origin JS and
  answer itself). Serve `Content-Security-Policy: default-src 'none';
  script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'`.
- `GET /api/state` → `{runs: [...], pendingQuestions: [...]}` computed from
  registry (reducer) + answers dir.
- `POST /api/answer` → requires header `X-Conductor: 1` (CSRF) + `Origin`
  absent-or-localhost; body `{eventId, answers}` ≤ 64 KB, schema-validated;
  unknown eventId → 409; duplicate → 409 decided by the atomic no-replace
  write itself (EEXIST → 409; a pre-check `existsSync` is a race, not the
  decision); writes `answers/<eventId>.json` atomic immutable. Viewer only
  writes the answer file; conductor appends `answer_applied` when it picks it
  up. Viewer never writes the registry (single-writer discipline).
- Files are source of truth; viewer is a window.

## Tests (node:test, `conductor/test/*.test.mjs`)

- registry: torn lines, reserved-field rejection, transition reducer (audit
  events preserve state), invalid transition throws, concurrent appends from
  2 child processes (all lines parse).
- permissions: win32 sibling-prefix (`C:\wt` vs `C:\wt2`), case-insensitive,
  `..`, ADS, device/UNC paths; every stage-1 metachar rejected; never-list
  → hard deny vs unmatched → capabilityRequest; reviewer has no Write.
- questions: multi-question answer map validation, immutable answer (second
  write fails), deadline final-read race (answer landing at deadline applied),
  key-mismatch kept-polling.
- conductor: with INJECTED fake query function (dependency injection —
  `runSession(deps)` takes `queryFn`): result subtypes, clean park ordering
  (park receipt before waiting_operator), unclean park → investigate,
  admission full/busy-worktree/stale-lock, resume cap, resume drift,
  receipt-before-terminal ordering, phase watchdog fire.
- viewer: loopback binding, missing CSRF header → 403, oversize body → 413,
  duplicate answer → 409.
- ONE opt-in real-SDK smoke behind `CONDUCTOR_SMOKE=1` env — never in default suite.

## Implementation constraints

- Plain ESM `.mjs`, Node ≥ 20, zero deps beyond the SDK. `node:test` runner.
- `conductor.mjs` must export its internals (`runSession`, `admit`, reducer
  helpers) for testing; CLI entry guarded by `import.meta.url` main check.
- Comments sparse — constraints only.
