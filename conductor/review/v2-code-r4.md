## Closure findings

- #1 — PARTIAL — audit events can still precede `started`; validation gates only lifecycle events, while C1 tests only lifecycle cases — `conductor/src/registry.mjs:43`, `conductor/test/v2-r3.test.mjs:360`.
- #2 — PARTIAL — cap/worktree/recovery improved, but “stale-writer barrier” is only an in-process generation rejection; crash-mid-admission and old-owner-process-death ordering remain unproved — `conductor/test/v2-r3.test.mjs:482`.
- #3 — PARTIAL — the end-to-end answer arrives at t+2s, not required t+5s, and deadline-final-read remains a helper-only test — `conductor/test/v2-r3.test.mjs:496`, `conductor/test/v2-r3.test.mjs:513`.
- #4 — PARTIAL — assertions prove park-file-before-close and close-before-return, but never pin return-before-`waiting_operator`; moving the ledger append earlier would still pass — `conductor/test/v2-r3.test.mjs:539`, `conductor/test/v2-r3.test.mjs:550`.
- #5 — PARTIAL — R1/R2/R3/R4/R6/R7 and cap admission are exercised, but R5 same-worktree exclusion on resume is absent — `conductor/test/v2-r3.test.mjs:591`.
- #7 — RESOLVED — test pins `tool_running`, the 300ms deadline, and exclusion of the 5s model deadline — `conductor/test/v2-r3.test.mjs:614`.
- #8 — PARTIAL — query throw and missing output are covered, but the advertised conflicting-lifecycle-output case has no test body — `conductor/test/v2-r3.test.mjs:631`.
- #9 — RESOLVED — post-CAS barriers force terminal/park losers to enter before winner commit and assert exact suppression/receipt outcomes — `conductor/test/v2-r3.test.mjs:265`, `conductor/test/v2-r3.test.mjs:291`.
- #11 — RESOLVED — git failure, linked-root derivation, raw-NUL untracked hashes, park capture, and resume drift are asserted through production fingerprint/resume code — `conductor/test/v2-r3.test.mjs:195`, `conductor/test/v2-r3.test.mjs:236`.
- #13 — PARTIAL — exit mappings are covered and `COPYFILE_EXCL` produces one winner, but the two writer processes have no start barrier as explicitly required — `conductor/test/v2-r3.test.mjs:123`, `conductor/test/v2-r3.test.mjs:677`.
- #20 — PARTIAL — canonical totals/endpoints improved, but clean park writes no `attempts/<n>.json`; seeded prior state masks a reachable park→resume→terminal two-attempt receipt defect — `conductor/src/conductor.mjs:169`, `conductor/test/v2-r3.test.mjs:329`.
- #21 — PARTIAL — the handler now enters the latch, but no test emits a production signal while another production terminalizer owns the latch and asserts suppression — `conductor/src/conductor.mjs:202`, `conductor/test/v2-fakesdk.test.mjs:239`.
- #22 — PARTIAL — production ordering is fixed, but the regression test still covers only ordinary `Read`, not missing-ID `ask_operator` — `conductor/src/conductor.mjs:229`, `conductor/test/v2-fakesdk.test.mjs:86`.
- HARNESS-2 — PARTIAL — shape drift now fails loudly, but invocation still bypasses MCP transport and gate/hook ordering through `_registeredTools` — `conductor/test/helpers/fake-sdk.mjs:193`, `conductor/test/v2-r3.test.mjs:698`.
- HARNESS-4 — RESOLVED — question/signal sequencing uses injected commit hooks and latch/admission races use deterministic barriers; remaining `setImmediate` calls only pump real pipe I/O — `conductor/src/conductor.mjs:217`, `conductor/test/helpers/fake-sdk.mjs:111`.
- DISCLOSED-T13 — RESOLVED — injected `main()` covers run 0/1/2, resume 0/1, and recover 1 — `conductor/test/v2-r3.test.mjs:123`, `conductor/test/v2-r3.test.mjs:150`, `conductor/test/v2-r3.test.mjs:179`.
- DISCLOSED-T11 — RESOLVED — all three mandatory fingerprint cases plus park-capture→resume-drift are present — `conductor/test/v2-r3.test.mjs:195`.
- R3-N1 — RESOLVED — §7 is explicitly marked `[AMENDED r3]`, fixes interrupt at 4.5s plus exit observation at 10s, and matches T7’s `<15s` assertion; no other amendment was found — `conductor/DESIGN-V2.md:97`, `conductor/test/v2-fakesdk.test.mjs:205`.
- R3-N2 — RESOLVED — two resume calls rendezvous before admission and assertions require exactly one completion, one `RUN-OCCUPIED`, and one `resumed` event — `conductor/test/v2-fakesdk.test.mjs:377`.
- R3-N3 — RESOLVED — resume-cap terminalization pauses immediately before commit and externally probes the lease as occupied — `conductor/test/v2-fakesdk.test.mjs:348`.
- R3-N4 — RESOLVED — production terminalizer has post-CAS/pre-commit hooks and tests pin both terminal and park interleavings — `conductor/src/conductor.mjs:156`, `conductor/test/v2-r3.test.mjs:265`.
- R3-N5 — PARTIAL — code is fixed, but A5 manually calls `terminal(...,'signal')`; it does not authenticate the production signal-handler race — `conductor/src/conductor.mjs:202`, `conductor/test/v2-r3.test.mjs:275`.
- R3-N6 — PARTIAL — code fails closed before the conductor-tool allowance, but no targeted `ask_operator` missing-ID assertion exists — `conductor/src/conductor.mjs:231`.

## Additional findings

- `conductor/src/conductor.mjs:311` — 🔴 BLOCKER: production `main()` manually closes the lease before `process.exit`, violating the foundational “held until process death—never manually released” contract — `conductor/DESIGN-V2.md:67`.
- `conductor/src/conductor.mjs:174` — 🔴 MAJOR: clean parks persist no attempt record, so a park→resume→terminal run reports only the resumed attempt and loses attempt-1 session/provenance required across all attempts — `conductor/DESIGN.md:314`.
- `conductor/src/conductor.mjs:139` — 🔴 MAJOR: ordinary failed/investigate receipts silently emit `fingerprintEnd:null`; inherited receipt semantics require the terminal endpoint, and contrary to disclosure no test asserts this null behavior — `conductor/DESIGN.md:316`, `conductor/test/v2-r3.test.mjs:323`.
- `conductor/src/questions.mjs:21` — 🟡 MAJOR: `COPYFILE_EXCL` is the contract-approved atomic-exclusive Windows publication primitive, but the temporary answer is not `fsync`ed before publication and C9 is not barrier-raced — `conductor/DESIGN.md:42`.
- `conductor/test/v2-r3.test.mjs:466` — 🔵 MINOR: pipe children have `t.after(child.kill)` but cleanup does not await exit; C9 has no cleanup hook. Assertion failures are mostly covered, but forced runner termination can orphan unique-pipe children; UUID-scoped pipes should not poison later runs — `conductor/test/v2.test.mjs:21`, `conductor/test/v2-r3.test.mjs:683`.
- Sample authenticity — VERIFIED — A2 drift (`:236`), A5 latch (`:265`), T5b live lease (`v2-fakesdk.test.mjs:317`), T5c simultaneous resume (`v2-fakesdk.test.mjs:377`), and C7 query throw (`v2-r3.test.mjs:634`) would fail if their respective production fixes were reverted.

## Verdict

**REJECT** — mandatory closure assertions remain partial, parked-attempt aggregation is genuinely broken, and production `main()` violates the process-lifetime lease invariant.