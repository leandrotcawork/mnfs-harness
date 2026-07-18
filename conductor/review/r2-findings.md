R1 closure: 15/21 fully closed; 6 partial/reopened.

`conductor/src/permissions.mjs:13-15,127-134 — BLOCKER — Bash still permits escape vectors: git diff --no-index reads arbitrary files; npm --prefix redirects execution outside cwd; --script-shell selects an arbitrary executable — add command-specific argv validation and hard-deny these plus equivalent path/shell/config flags.`

`conductor/src/locks.mjs:25-47; conductor/src/registry.mjs:76-80 — BLOCKER — lifecycle locking is non-blocking; contention returns ADMISSION-LOCKED, losing waiting_operator/terminal appends instead of serializing them — retain fail-fast admission but wait/retry lifecycle finalization under the mutex.`

`conductor/src/locks.mjs:50-56 — BLOCKER — token read followed by pathname unlink remains TOCTOU; a >30s stale reap can replace the lock between them and the old owner deletes the new owner’s lock — use an atomic ownership claim/held lock handle and test replacement during release.`

`conductor/src/conductor.mjs:294-297,324-325 — BLOCKER — resumed answers never become answer_applied; after a second park, the first question remains pending and the second resume always fails — append answer_applied under the mutex or derive pending state from authoritative stored answers; test two complete park/resume cycles.`

`conductor/src/conductor.mjs:204-208,242-266 — BLOCKER — watchdog timeout does not race queryHandle.next(); rejected or ineffective interrupt leaves the run hung forever without investigate — race stream waits against the phase deadline and force iterator closure/finalization after interrupt failure.`

`conductor/src/conductor.mjs:318-321,330-337 — MAJOR — resume-drift and mark append terminal lifecycle events without first writing receipt.json — centralize all terminalization through receipt-before-lifecycle logic.`

`conductor/src/conductor.mjs:102-120 — MAJOR — usage and modelUsage are arrays, not cross-attempt aggregates, and aggregation ignores registry audit history — perform schema-aware numeric aggregation from attempts plus registry events.`

`conductor/src/conductor.mjs:215-233 — MAJOR — messages consumed during park drain bypass normal result/session accounting; a later result’s usage, errors, and subtype are lost — route every drained message through the same capture logic.`

`conductor/test/registry.test.mjs:78-86; conductor/test/questions.test.mjs:35-41 — MAJOR — “concurrent” tests use spawnSync sequentially; answer test also converts EEXIST into success and never proves one publisher won — use simultaneously spawned children with a start barrier and assert explicit winner/loser outcomes.`

`conductor/test/conductor.test.mjs:49-72 — MAJOR — receipt/park ordering tests compare mtimes post hoc; equal timestamp granularity lets reversed ordering pass — intercept appendEvent or filesystem publication and assert the operation sequence directly.`

`conductor/test/conductor.test.mjs:120-130 — MAJOR — watchdog test uses identical phase timeouts, zero-duration operator wait, and immediate generic messages — use distinct deadlines, hold operator_wait beyond both, and delay generic messages to prove they do not reset time.`

`conductor/test/conductor.test.mjs:90-102,173-176 — MAJOR — subtype test omits current error_max_structured_output_retries and the opt-in SDK smoke never invokes AskUserQuestion — cover the installed SDK union and force a real gated question.`

`conductor/test/conductor.test.mjs:133-137 — MAJOR — dead-PID and ownership-safe-release assertions are theater: both locks are already stale by age and no replacement race occurs — test a fresh dead-PID lock and adversarial owner replacement.`

`conductor/test/registry.test.mjs:47-64 — MAJOR — mandatory transition coverage still omits waiting_operator → investigate and first-event waiting_operator/resumed rejection — drive tests from the complete transition table.`

Independent rerun was prevented by the read-only sandbox denying `%TEMP%` fixture creation; dispatcher’s 32-pass result does not address the assertion gaps above.

Verdict: REJECT