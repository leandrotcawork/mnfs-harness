1. `conductor/test/v2.test.mjs:19 — BLOCKER — T1 claims the full transition table but asserts only one valid path and one stale-generation rejection; first-event, every allowed/forbidden edge, and suppressed-field validation remain unproved — DESIGN-V2 §12 T1 — table-drive every lifecycle/audit transition and malformed suppressed event.`

2. `conductor/test/v2.test.mjs:21 — BLOCKER — T2 omits cap-2 admission, worktree exclusion, every recovery case, crash recovery, probe-close race, EPERM/unknown errors, maximum-name behavior, admission against a foreign holder, and the stale-writer death barrier — DESIGN-V2 §12 T2(a–j) — add real barrier-controlled processes and injected probe/recovery assertions for every subcase.`

3. `conductor/test/v2.test.mjs:23 — BLOCKER — T3 tests only waitForAnswer’s final read; it never asserts MCP tool result, question/answer audits, no park, watchdog suspension, or the t+5s fast path — DESIGN-V2 §12 T3 — drive createOperatorChannel/runSession with an injected clock and assert the complete protocol.`

4. `conductor/test/v2.test.mjs:25 — BLOCKER — T4’s title claims unclean-owner escalation but the body exercises only a successful close/return and does not prove file-before-close ordering, the ≤10s bound, one owner-token, or investigate('unclean-park') — DESIGN-V2 §12 T4 — intercept each operation and add a never-settling exit branch under fake time.`

5. `conductor/test/v2.test.mjs:27 — BLOCKER — T5 proves only immutable publication and that two resumed records can exist; R1, R2, R4–R7, refusal behavior, two-cycle execution, and simultaneous resume exclusion are absent — DESIGN-V2 §9 and §12 T5 — invoke resumeRun for each violated invariant and a barrier-raced pair.`

6. `conductor/test/v2.test.mjs:29 — BLOCKER — T6 omits both negative startup cases, so failed('tool-inventory') before tool execution is not proved — DESIGN-V2 §2 and §12 T6 — inject init-without-ask_operator and result-without-init streams while asserting zero tool executions.`

7. `conductor/test/v2.test.mjs:31 — BLOCKER — T7 never runs the watchdog; it merely calls terminalizer on a resolving iterator, leaving phase deadlines, never-settling next/interrupt, virtual <15s completion, and generic-message behavior unasserted — DESIGN-V2 §7 and §12 T7 — test runSession with fake time and non-settling query primitives.`

8. `conductor/test/v2.test.mjs:33 — BLOCKER — T8 tests only denial deduplication and does not even assert the title’s numeric preservation; happy/missing/malformed/conflicting outputs, error subtypes, query throw, and aggregation are absent — DESIGN-V2 §8 and §12 T8 — exercise every result boundary through runSession and inspect receipts/lifecycle.`

9. `conductor/test/v2.test.mjs:35 — BLOCKER — T9 covers the three-terminal race only; suppressed event fields, park-vs-terminal ownership, and check/commit barriers are not asserted — DESIGN-V2 §4.3–4.4 and §12 T9 — add controlled barriers around receipt/event commits and a competing park entrant.`

10. `conductor/test/v2.test.mjs:37 — BLOCKER — T10 asserts one snapshot and static HTML text, but not SDK transcript discovery, production loopback binding, CSRF/origin/body limits, unknown/duplicate answers, or immutable publication — DESIGN.md §330–369 via DESIGN-V2 §10/§12 T10 — test every endpoint and session-store integration.`

11. `conductor/test/v2.test.mjs:39 — BLOCKER — T11 says fail-closed inputs throw but contains only two JSON equality assertions; every normative fingerprint case is untested — DESIGN-V2 §11 and §12 T11 — test git failures, linked worktrees, raw NUL paths, content hashing, park capture, and resume drift.`

12. `conductor/test/v2.test.mjs:41 — BLOCKER — T12 is a tautology that only rechecks the enabling environment variable and proves none of A1/A3–A7 — DESIGN-V2 §12 T12 and STUDY §10 — invoke the actual smoke assertions or import independently verifiable smoke routines.`

13. `conductor/test/v2.test.mjs:43 — BLOCKER — T13 omits context-over-limit, several exact boundaries, ledger logging for malformed answers, a genuine barrier race, and all run/resume/recover exit-code assertions — DESIGN-V2 §12 T13 — add every byte boundary, process-level writer race, audit assertion, and CLI mapping case.`

14. `conductor/src/conductor.mjs:109 — BLOCKER — watchdog state has no outstanding tool-use ID set, resets its deadline on every streamed message, and drops to model_wait after any non-tool_use progress; generic messages therefore reset timers and parallel tools terminate the phase early — DESIGN.md §291–312 via DESIGN-V2 §7 — maintain the normative outstanding-ID set and one phase deadline independent of irrelevant messages.`

15. `conductor/src/conductor.mjs:144 — BLOCKER — resume drift appends investigate directly without receipt publication, teardown ownership, or the terminalization latch, recreating the forbidden out-of-band finalization path — DESIGN-V2 §4.3, §8, §9 R6; r3-findings #2 — route drift through one receipt-before-terminal terminalizer.`

16. `conductor/src/conductor.mjs:139 — MAJOR — exceeding the two-resume cap merely throws and leaves waiting_operator, while R7 requires terminalize(investigate) — DESIGN-V2 §9 R7 — synthesize a receipt and terminalize with an explicit resume-cap reason.`

17. `conductor/src/conductor.mjs:138 — MAJOR — resume state, pending-question, binding, cap, answer, and fingerprint checks occur before admission rather than under its mutex — DESIGN.md §252–274 via DESIGN-V2 §9 — acquire admission first and perform all R1–R7 validation and resumed publication inside the critical section.`

18. `conductor/src/conductor.mjs:149 — MAJOR — recovery validates the manifest’s runId and self-canonical cwd but never verifies ledger runId/cwd identity, so a mismatched ledger can be orphan-terminalized — DESIGN-V2 §4.2 — validate every identity-bearing ledger record against the directory and manifest before recovery.`

19. `conductor/src/conductor.mjs:65 — MAJOR — admission counts only writer manifests and permits unlimited non-writer leases, contradicting the frozen rule that cap 2 counts live run pipes — DESIGN-V2 §4.1 — count all occupied run leases, or amend the frozen contract before implementation.`

20. `conductor/src/conductor.mjs:99 — MAJOR — attempts are never persisted and terminal receipts omit most inherited fields and cross-attempt aggregation, including durations, turns, stop reason, session IDs, watchdog/questions, fingerprints, and aggregates — DESIGN.md §314–328 via DESIGN-V2 §8 — write attempts/<n>.json and build the complete cumulative receipt from attempts plus ledger.`

21. `conductor/src/conductor.mjs:102 — MAJOR — no signal handler enters the terminalization latch, despite signal handling being a named concurrent terminalization source; SIGINT/SIGTERM can leave only an orphaned started/resumed run — DESIGN-V2 §4.3 — install bounded signal handlers that call the shared terminalizer exactly once.`

22. `conductor/src/conductor.mjs:117 — BLOCKER — PreToolUse deduplication uses the callback’s optional toolUseID instead of the input’s required tool_use_id; when omitted, distinct identical denials collapse to one synthetic key and receipts undercount again — sdk.d.ts:790,2209–2214; DESIGN-V2 §5; r3-findings #4 — use input.tool_use_id and reject/audit missing IDs fail-closed.`

23. `conductor/src/conductor.mjs:41 — MAJOR — loader rejection depends on an optional role.gatedTools list rather than the actual gated inventory, so allowedTools can contain gated tools without error — DESIGN-V2 §2 and §12 T6 — derive gated names from the fixed conductor/tool policy and reject every intersection.`

24. `conductor/src/viewer.mjs:10 — MAJOR — viewer discovery contains only manifest/ledger summaries and never reads the SDK session store, so the required transcript source and per-run transcript completeness are absent — DESIGN-V2 §10 and STUDY §6 — bind session IDs to SDK session-store reads and expose transcript/subagent data safely.`

25. `conductor/src/registry.mjs:35 — MAJOR — generation validation remains a read-then-append TOCTOU with no commit serialization; the lease premise prevents cross-process old owners, but concurrent same-process writers can still validate against the same snapshot and append incompatible records — DESIGN-V2 §4.1/§5 and v2-align-r2 F1 — serialize validation plus append through a per-run in-process commit mutex.`

REJECT — the normative suite is predominantly test theater, while runtime watchdog, resume terminalization, denial accounting, recovery identity, receipt aggregation, and viewer behavior violate frozen requirements.