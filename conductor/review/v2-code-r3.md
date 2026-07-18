## R1 findings #1–#25

#1 — PARTIAL — forbidden first-event cases remain unasserted; the new init-gate test only verifies `started` happens first in one execution — `conductor/test/v2-fakesdk.test.mjs:75`.

#2 — PARTIAL — malformed-manifest cap counting is added, but cap-2 admission, worktree exclusion, recovery matrix, crash recovery, foreign-holder admission, and stale-writer barrier remain unasserted — `conductor/test/v2-fakesdk.test.mjs:268`.

#3 — PARTIAL — production `runSession` and the real handler are exercised, but the required t+5s path and deadline-final-read race are not tested end-to-end — `conductor/test/v2-fakesdk.test.mjs:132`.

#4 — PARTIAL — unclean park is covered through `createTerminalizer`, while the new “clean path” is normal completion, not the required parks-file → close → exit → waiting_operator sequence — `conductor/test/v2-fakesdk.test.mjs:437`.

#5 — PARTIAL — two-cycle, state, cap, and simultaneous-resume cases exist; R2 binding, R3 mismatch, R5 admission constraints, and R6 drift violations remain absent — `conductor/test/v2-fakesdk.test.mjs:308`.

#6 — RESOLVED — both negative startup streams drive production and assert zero subsequent gate execution — `conductor/test/v2-fakesdk.test.mjs:104`.

#7 — PARTIAL — production model-wait watchdog and non-settling primitives are covered, but distinct `tool_running` deadline behavior remains unasserted — `conductor/test/v2-fakesdk.test.mjs:185`.

#8 — PARTIAL — error subtypes, malformed success, no-result, and happy receipt are exercised; query-throw, conflicting lifecycle output, and production-boundary denial deduplication remain absent — `conductor/test/v2-fakesdk.test.mjs:402`.

#9 — PARTIAL — no injected check/commit barriers exist; `Promise.all` calls synchronously select the first latch entrant — `conductor/test/v2-r1.test.mjs:27`.

#10 — RESOLVED — endpoint hardening, immutable publication, loopback binding, main transcripts, and subagent transcripts are covered — `conductor/test/v2-fakesdk.test.mjs:547`.

#11 — PARTIAL — production fingerprinting occurs incidentally, but content hashes, park capture, and resume drift are not asserted; three additional missing cases are disclosed below — `conductor/test/v2.test.mjs:39`.

#12 — RESOLVED — A7 now asserts reproduction of the frozen falsification and A8 is included — `conductor/smoke/assertions.mjs:7`.

#13 — PARTIAL — malformed-answer auditing and boundaries improved, but the writer race is not process/barrier based and required CLI mappings remain disclosed — `conductor/test/v2-fakesdk.test.mjs:497`.

#14 — RESOLVED — production tracks outstanding IDs and excludes generic/system/status messages from progress — `conductor/src/conductor.mjs:179`.

#15 — RESOLVED — resume-drift terminalization now occurs after lease acquisition inside `validateInside` — `conductor/src/conductor.mjs:101`.

#16 — RESOLVED — resume-cap terminalization likewise executes while the newly acquired lease is held — `conductor/src/conductor.mjs:234`.

#17 — RESOLVED — resume validation and `resumed` publication remain under the admission mutex — `conductor/src/conductor.mjs:234`.

#18 — RESOLVED — recovery validates manifest identity and every ledger record’s run/cwd identity — `conductor/src/conductor.mjs:257`.

#19 — RESOLVED — the pipe is probed before manifest parsing, so malformed or missing manifests still consume capacity — `conductor/src/conductor.mjs:83`.

#20 — PARTIAL — the shared builder adds provenance and cumulative side fields, but canonical `usage`/`modelUsage` remain latest-attempt values and normal receipts leave `fingerprintStart`/`fingerprintEnd` undefined — `conductor/src/conductor.mjs:134`.

#21 — PARTIAL — once-listeners are removed and signals close transport immediately, but the handler still only resolves `signalPromise`; it does not itself enter the terminalization latch or produce suppression when another terminalizer already owns it — `conductor/src/conductor.mjs:173`.

#22 — PARTIAL — missing IDs fail closed for ordinary tools, but `mcp__conductor__ask_operator` returns allowed before the missing-ID check — `conductor/src/conductor.mjs:199`.

#23 — RESOLVED — `NotebookEdit` is gated and wildcard matching catches `mcp__*` — `conductor/src/conductor.mjs:16`.

#24 — RESOLVED — production viewer discovery reads main and per-subagent SDK transcripts — `conductor/src/viewer.mjs:14`.

#25 — RESOLVED — per-ledger validation plus append remains protected by the commit guard — `conductor/src/registry.mjs:32`.

## R2 new findings

R2-N1 — RESOLVED — both gate surfaces deny before init, and missing inventory terminalizes before requesting another stream item — `conductor/src/conductor.mjs:197`.

R2-N2 — RESOLVED — the implemented watchdog worst-case is 4.5s interrupt plus 10s exit observation, strictly below T7’s 15s limit — `conductor/src/conductor.mjs:20`.

R2-N3 — RESOLVED — unclean park now uses the shared attempt/receipt builder — `conductor/src/conductor.mjs:153`.

R2-N4 — RESOLVED — SMOKE-6 exits zero only when the frozen A7 falsification is reproduced — `conductor/smoke/smoke6-handle-lock.mjs:55`.

## Harness authenticity findings

HARNESS-1 — RESOLVED — `invokeCanUseTool` and `invokePreToolUse` invoke callbacks actually constructed by production `runSession`; gate logic is not reimplemented — `conductor/test/helpers/fake-sdk.mjs:175`.

HARNESS-2 — PARTIAL — `ask_operator` reaches the real production-created tool handler, but accesses SDK-private `_registeredTools` and bypasses MCP transport plus gate/hook ordering — `conductor/test/helpers/fake-sdk.mjs:187`.

HARNESS-3 — RESOLVED — virtual `now`, sleep, watchdog timers, interrupt bounds, and exit bounds are injected into production through `deps.timerClock`/`deps.now` — `conductor/test/helpers/fake-sdk.mjs:249`.

HARNESS-4 — PARTIAL — `setImmediate` is legitimate for named-pipe I/O, but watcher-driven tests rely on favorable scheduler interleaving and cannot substitute for the mandated barriers — `conductor/test/helpers/fake-sdk.mjs:67`.

## Disclosed deviations

DISCLOSED-T13 — BLOCKING — missing run/resume success-path and recover exit-code assertions violate explicit §12 T13; `main()` still has no `queryFn` injection — `conductor/src/conductor.mjs:263`.

DISCLOSED-T11 — BLOCKING — git-failure, linked-worktree, and raw-NUL cases are mandatory §12 assertions, not acceptable minor residue — `conductor/test/v2.test.mjs:39`.

DISCLOSED-.gitignore — ACCEPTABLE — `node_modules/` exclusion follows the frozen `--exclude-standard` algorithm; it changes repository policy but not the specified fingerprint procedure — `conductor/.gitignore:1`.

## New R3 findings

R3-N1 — MAJOR — frozen §7 says interrupt is raced against 10s, while runtime silently substitutes 4.5s to reconcile T7’s contradictory aggregate limit; freeze one absolute cleanup budget or amend the contract — `conductor/src/conductor.mjs:20`.

R3-N2 — BLOCKER — T5c is concurrent but not barrier-raced, and its comments explicitly accept two scheduler-dependent loser modes; it does not prove simultaneous-resume serialization at the critical boundary — `conductor/test/v2-fakesdk.test.mjs:372`.

R3-N3 — BLOCKER — T5b claims lease-before-terminal evidence, but only compares ledger indexes; no interceptor observes that the lease was live when `investigate` was appended — `conductor/test/v2-fakesdk.test.mjs:365`.

R3-N4 — BLOCKER — T9 still lacks result/watchdog/signal and park/terminal check-to-commit barriers required by §12; `driveToSettled` yields cannot create those controlled races — `conductor/test/helpers/fake-sdk.mjs:73`.

R3-N5 — MAJOR — signal handling is not a genuine latch entrant, so a signal arriving during result/watchdog terminalization produces neither a competing CAS nor the required `terminalize_suppressed` audit — `conductor/src/conductor.mjs:174`.

R3-N6 — MAJOR — missing `tool_use_id` remains fail-open specifically for `ask_operator`, contradicting the claimed universal fail-closed fix — `conductor/src/conductor.mjs:199`.

R3-N7 — RESOLVED — `answer_applied` is not a taxonomy regression: it is inherited, frozen, and accepted by the validator — `conductor/src/registry.mjs:6`.

R3-N8 — RESOLVED — terminalization during resume validation occurs under the acquired lease, and validation failure closes that lease afterward — `conductor/src/conductor.mjs:104`.

R3-N9 — RESOLVED — ignoring `node_modules` does not violate the frozen fingerprint contract because ignored files are intentionally excluded by `git ls-files --others --exclude-standard` — `conductor/src/conductor.mjs:62`.

## Verdict

REJECT — production improved materially and the harness is mostly authentic, but multiple explicitly mandatory §12 BLOCKER assertions remain missing, including resume invariants, controlled terminalization races, fingerprint cases, and CLI exit mappings.