## R1 verification

#1 — PARTIAL — `conductor/test/v2-r1.test.mjs:19` — lifecycle edges are table-driven, but forbidden first-event cases remain unasserted.

#2 — PARTIAL — `conductor/test/v2.test.mjs:21` — mutex, pipe lifetime, probe closure, error taxonomy, and name length are covered; cap-2, worktree exclusion, recovery matrix, crash recovery, foreign-holder admission, and stale-writer barrier remain absent.

#3 — UNRESOLVED — `conductor/test/v2.test.mjs:23` — still tests only `waitForAnswer`; no MCP result, audits, watchdog suspension, no-park assertion, or `runSession` fast path.

#4 — PARTIAL — `conductor/test/v2-r1.test.mjs:23` — unclean bounded escalation is covered, but the clean path still lacks intercepted file→close→exit→ledger ordering.

#5 — UNRESOLVED — `conductor/test/v2.test.mjs:27` — still never invokes `resumeRun`; R1–R7 violations, two-cycle execution, and simultaneous exclusion remain unproved.

#6 — UNRESOLVED — `conductor/test/v2-r1.test.mjs:33` — policy-derived loader test added, but both negative startup streams and zero-tool-execution assertion remain absent.

#7 — UNRESOLVED — `conductor/test/v2.test.mjs:31` — still calls `createTerminalizer` directly; no `runSession` watchdog, fake phase deadlines, non-settling `next`/`interrupt`, or generic-message test.

#8 — PARTIAL — `conductor/test/v2-r1.test.mjs:25` — numeric aggregation is tested directly, but happy/missing/malformed/conflicting output, subtype union, query throw, and full denial boundary remain absent.

#9 — PARTIAL — `conductor/test/v2-r1.test.mjs:27` — park-vs-terminal and suppression fields added, but no genuine check/commit barrier exists; call order deterministically selects park.

#10 — PARTIAL — `conductor/test/v2-r1.test.mjs:29` — endpoint guards and injected transcript reading are covered; `startViewer` loopback binding and subagent transcript completeness remain unasserted.

#11 — UNRESOLVED — `conductor/test/v2.test.mjs:39` — still only compares two objects; git failure, linked worktree, raw-NUL paths, hashing, park capture, and drift remain untested.

#12 — PARTIAL — `conductor/smoke/assertions.mjs:7` — real scripts are invoked, but falsified A7 is incorrectly required to exit zero and adopted A8/SMOKE-7 is omitted.

#13 — PARTIAL — `conductor/test/v2-r1.test.mjs:31` — byte boundaries improved, but malformed-answer ledger auditing, a process/barrier writer race, and run/resume/recover exit codes remain absent.

#14 — PARTIAL — `conductor/src/conductor.mjs:118` — production now maintains and consumes an outstanding-ID set, but `observeProgress` accepts content from generic/system messages and can reset the deadline (`conductor/src/conductor.mjs:120,142`).

#15 — PARTIAL — `conductor/src/conductor.mjs:162` — drift now uses receipt-before-terminal terminalization, but it writes before `acquireLease` because `validateInside` runs first (`conductor/src/conductor.mjs:68-69`).

#16 — PARTIAL — `conductor/src/conductor.mjs:157` — resume-cap now terminalizes investigate, but likewise does so before acquiring the per-run writer lease.

#17 — RESOLVED — `conductor/src/conductor.mjs:154` — R1–R7 validation and resumed publication execute inside `admit`’s admission-mutex callback.

#18 — RESOLVED — `conductor/src/conductor.mjs:169-170` — recovery rejects manifest/directory mismatches and every ledger record with mismatched `runId` or `cwd`.

#19 — PARTIAL — `conductor/src/conductor.mjs:49-57` — all roles are counted by live-pipe probes, but an occupied pipe is silently omitted when its manifest is missing or malformed because parsing precedes probing.

#20 — PARTIAL — `conductor/src/conductor.mjs:88-94` — attempts and numeric totals exist, but card/roles hashes, model, SDK version, options snapshot, cumulative usage/model usage, normal-path session IDs, and manifest fingerprint are missing; parked attempts are never persisted.

#21 — PARTIAL — `conductor/src/conductor.mjs:116,135-136` — signal listeners exist, but handlers only resolve a promise; they do not directly enter the latch during an already-running terminalization, and listeners are never removed.

#22 — PARTIAL — `conductor/src/conductor.mjs:129-130` — PreToolUse uses `input.tool_use_id`, but a missing ID on an otherwise allowed tool is still allowed without rejection or audit.

#23 — PARTIAL — `conductor/src/conductor.mjs:16,42-44` — validation is policy-derived, but `GATED_TOOLS` omits gated `NotebookEdit`, and broad disallow patterns such as `mcp__*` are not recognized as matching conductor tools.

#24 — PARTIAL — `conductor/src/viewer.mjs:6,14` — `getSessionMessages` is a real installed SDK export and is wired in production, but subagent discovery/messages and complete transcript presentation are absent.

#25 — RESOLVED — `conductor/src/registry.mjs:13,32-52` — validation and synchronous append are protected by a per-ledger in-process commit guard.

## New findings

- `conductor/src/conductor.mjs:129-145` — BLOCKER — tools can be authorized before an init inventory is observed; `initialized` is checked only after the result, violating “tool-inventory before any work.”
- `conductor/src/conductor.mjs:138` — BLOCKER — watchdog termination can consume 20 seconds: 10-second `interrupt` timeout followed by terminalizer’s separate 10-second exit timeout, violating T7’s `<15s` bound.
- `conductor/src/conductor.mjs:101-102` — MAJOR — unclean park writes a skeletal receipt directly, bypassing attempt persistence and the cumulative receipt builder.
- `conductor/smoke/smoke6-handle-lock.mjs:49-51` — MAJOR — the promoted A7 assertion is inverted relative to the frozen STUDY result: reproducing the expected falsification exits 1.

## Verdict

REJECT — multiple BLOCKER findings remain partial or untouched, and the fix round adds unproved startup, watchdog-bound, lease-ownership, and receipt paths.