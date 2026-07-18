## Findings

- P1 — RESOLVED — production `main()` never closes the lease; `onLease` is optional and absent from CLI wiring. In-process tests explicitly supply the closer — `conductor/src/conductor.mjs:340`, `conductor/src/conductor.mjs:350`, `conductor/test/v2-r3.test.mjs:145`.

- P2 — PARTIAL — park now creates `attempts/<generation>.json` without colliding with resumed generation numbering, and the natural two-attempt test is real; however the parked attempt omits the contract’s “options used” provenance despite `context.optionsSnapshot` being available. Persist full per-attempt metadata and assert it — `conductor/src/conductor.mjs:182`, `conductor/src/conductor.mjs:264`, `conductor/DESIGN.md:36`, `conductor/test/v2-r3.test.mjs:384`.

- P3 — PARTIAL — ordinary failed/investigate paths capture `fingerprintEnd`, but resume-cap and orphan recovery still produce `fingerprintEnd:null`. Legitimate production manifests contain `cardPath`/`rolesPath`, so the blanket exclusion is unjustified; capture when possible and use an explicit unavailable marker only for legacy manifests — `conductor/src/conductor.mjs:201`, `conductor/src/conductor.mjs:275`, `conductor/src/conductor.mjs:281`, `conductor/src/conductor.mjs:309`, `conductor/src/conductor.mjs:330`, `conductor/DESIGN.md:316`.

- P4 — RESOLVED — temp contents are `fsync`ed before `COPYFILE_EXCL` publication — `conductor/src/questions.mjs:26`.

- G1 — RESOLVED — every audit event is rejected before the first lifecycle record, with exhaustive `AUDIT_EVENTS` assertions — `conductor/src/registry.mjs:47`, `conductor/test/v2-r3.test.mjs:440`.

- G2 — PARTIAL — cross-process stale append correctly exits 77 without changing ledger bytes, and pipe occupancy/crash release is asserted; 🔴 BLOCKER: the “crash-mid-admission” test invokes only `withAdmissionMutex`, not the required next production `admit()`, and no test proves a new admission is impossible until the old lease-holder process dies — `conductor/test/v2-r3.test.mjs:574`, `conductor/test/v2-r3.test.mjs:601`, `conductor/test/v2-r3.test.mjs:615`, `conductor/DESIGN-V2.md:118`.

- G3 — RESOLVED — real `runSession` reaches the deadline-final read at exactly virtual t+5000ms, returns the answer, and asserts no park — `conductor/test/v2-r3.test.mjs:625`.

- G4 — RESOLVED — `onParked` fires after `waiting_operator`, and its snapshot proves transport return occurred first — `conductor/src/conductor.mjs:183`, `conductor/test/v2-r3.test.mjs:680`.

- G5 — RESOLVED — resume traverses shared `admit()` worktree exclusion and is refused with `WORKTREE-BUSY` — `conductor/src/conductor.mjs:103`, `conductor/test/v2-r3.test.mjs:758`.

- G6 — RESOLVED — the guard implements §8 for the reachable conflicting nonterminal state. The read-to-CAS interval is synchronous; after CAS, competing in-process terminalizers are suppressed, while the single-live-lease rule excludes a legitimate external writer. Audit events cannot false-positive because `runState()` ignores them — `conductor/src/conductor.mjs:291`, `conductor/src/conductor.mjs:292`, `conductor/src/registry.mjs:21`, `conductor/test/v2-r3.test.mjs:821`.

- G7 — RESOLVED — both child writers acknowledge readiness before either receives `go`; assertions require exactly one success and one `EEXIST` — `conductor/test/v2-r3.test.mjs:890`.

- G8 — RESOLVED — the actual installed SIGINT handler enters the paused production latch and emits exactly one suppression with `suppressedKind:'signal'` — `conductor/src/conductor.mjs:225`, `conductor/test/v2-r3.test.mjs:336`.

- G9 — RESOLVED — missing ID is checked before the conductor-tool allowance; the test asserts denial, audit, and `failClosed:true` — `conductor/src/conductor.mjs:257`, `conductor/test/v2-r3.test.mjs:845`.

- G10 — RESOLVED — cleanup requests termination and awaits the child’s `exit` event — `conductor/test/v2-r3.test.mjs:109`.

- Test-hook audit — RESOLVED — `onLease`, `onParked`, `onQuestion`, and `onSessionBound` are optional; `barrier` defaults to an async no-op; `pauseAt` exists only in the fake barrier; signals, timers, and time default to `process`, `globalThis`, and `Date.now`. No hook is needed for production correctness — `conductor/src/conductor.mjs:120`, `conductor/src/conductor.mjs:218`, `conductor/src/conductor.mjs:230`, `conductor/src/conductor.mjs:350`, `conductor/test/helpers/fake-sdk.mjs:42`.

- SDK conformance — RESOLVED/flag-only — `Options.abortController` is a supported alternative, while `Query.close()` is expressly documented for aborting a running query. `interrupt()` is streaming-mode-only, but this implementation catches failure and unconditionally falls back to documented `close()`; the frozen teardown contract is not contradicted — `conductor/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:1283`, `conductor/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:2240`, `conductor/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:2533`.

- Final §12 sweep — 🔴 BLOCKER: T2(f), T2(j), and T4’s explicit “close called exactly once” remain without real assertions. All other T1–T13 normative cases have substantive assertions — `conductor/DESIGN-V2.md:118`, `conductor/DESIGN-V2.md:120`, `conductor/test/v2-r3.test.mjs:601`, `conductor/test/v2-r3.test.mjs:666`.

## Verdict

**REJECT** — parked-attempt provenance and synthesized fingerprint endpoints remain incomplete, while three mandatory §12 assertions are still absent.