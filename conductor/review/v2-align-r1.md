## Findings

1. `DESIGN-V2 §4 admission — BLOCKER — admission.lock held for process lifetime means first live run excludes every second run; writer cap 2 becomes unreachable — split short-lived global admission mutex from per-run occupancy lease; test two concurrent live writers.`

2. `DESIGN-V2 §4 admission — BLOCKER — “open handle prevents delete/rename on Windows” depends on handle share flags and filesystem; successful pathname deletion does not prove owner dead, allowing second owner while first still runs — use proven OS locking primitive or ownership-safe lease protocol; smoke exact Node/Windows semantics before design freeze.`

3. `DESIGN-V2 §4/§7 — BLOCKER — single process is not single serialized control flow: result handling, watchdog deadline, signal handling, and query rejection can concurrently enter terminalize(), overwrite receipt, and append competing terminal events — add per-run in-process terminalization latch/mutex; first caller wins, all later calls become no-ops. Add concurrent result-vs-watchdog test.`

4. `DESIGN-V2 §1/§4 — BLOCKER — process death leaves lifecycle started/resumed and worktree/writer slot occupied forever; v2 removed v1 mark command, and dead process cannot perform promised “park on process death” — restore explicit recover/mark command or define authenticated stale-owner reconciliation with receipt-before-investigate. Add kill-owner recovery test.`

5. `DESIGN-V2 §5 + DESIGN.md §204–218 INHERIT — BLOCKER — v1 disallowed complement explicitly includes mcp__*; wholesale inheritance can remove mcp__conductor__ask_operator/report_event despite adding them to tools — explicitly exempt exact conductor tools from disallowedTools and assert their presence in system/init tools.`

6. `DESIGN-V2 §2/§10 T10 — BLOCKER — operator channel depends on unverified A4: sdk.d.ts describes options.tools as built-in-tool base inventory, not MCP inventory; adding mcp__conductor__* there is not type-backed — SMOKE-1 must prove exact effective inventory and invocation before freeze; specify fallback configuration if names are absent.`

7. `STUDY §7 — BLOCKER — claim “[D] subagents inherit permissionMode; cannot loosen per-subagent” is falsified by sdk.d.ts: AgentDefinition.permissionMode?: PermissionMode at lines 89–91 — correct study and define whether subagent modes are forbidden by harness validation.`

8. `DESIGN-V2 §3.1/§6 — BLOCKER — park calls query.close() from inside pending MCP handler, then assumes handler, iterator, subprocess, and ledger orchestration settle coherently; close() returning void proves synchronous invocation, not completed process termination or resumable transcript integrity — move park decision to outer lifecycle controller; handler signals park, controller persists state, closes query, observes bounded exit. Gate on A3/A5 smoke.`

9. `DESIGN-V2 §4 — MAJOR — waiting_operator is appended before old process is known exited; resume may admit new owner while old callbacks still execute, violating per-run single-writer premise — retain per-run lease until bounded process-exit confirmation, or make terminal/park ownership generation-based.`

10. `DESIGN-V2 §5/§7 — MAJOR — denial double-count becomes denial undercount: PreToolUse denial bypasses canUseTool, but only canUseTool is specified to append capability_request; receipt reads ledger only — every denying path must call one canonical audit function with tool-use ID and idempotent dedupe. Add PreToolUse-denial receipt test.`

11. `DESIGN-V2 §2/§7 — MAJOR — held-open AsyncIterable completion contract undefined: valid result may arrive while input remains open, or query may await input EOF; design never says when queue closes or which result ends run — define first valid terminal result protocol, close input/query deterministically, and add real-SDK held-open-input + structured-output completion smoke.`

12. `DESIGN-V2 §1/§3.1/§9 — MAJOR — resume contract omits several inherited invariants: exactly one pending question, sessionId matching last session_bound, immutable stored answer authority, simultaneous-resume exclusion, writer-cap/worktree recheck, fingerprint drift terminalization — restate them normatively. T5 must test each plus two simultaneous resumes.`

13. `DESIGN-V2 §7 — MAJOR — SDKResultSuccess.structured_output is optional unknown in sdk.d.ts; success without output, malformed output, conflicting receipt status, or query exception has no defined lifecycle mapping — validate again at boundary; define synthesized failure/investigate result. Add missing/invalid/conflicting structured_output and thrown-query tests.`

14. `DESIGN-V2 §1 S2 — MAJOR — detached child may die with parent console/job, inherit unusable stdio, or parent may report success before child admits — require redirected stdio, admission/init handshake, PID publication, and parent-console-kill integration test; otherwise delete --detach.`

15. `DESIGN-V2 §4 S3 — MAJOR — after fixing lifetime lock, multiple conductors can append global registry.jsonl concurrently; “admission-only” does not make it single-writer or guarantee intact records — either delete registry and scan per-run state, or serialize append under short-lived admission mutex and test simultaneous children.`

16. `DESIGN-V2 §3.2/§8 — MAJOR — report_event accepts model-controlled kind/data without stated byte, depth, count, or key limits; prompt injection can fill ledger or forge viewer-visible milestones — delete for Beta, or strict enum/size/rate limits plus hostile-payload tests.`

17. `STUDY §5 and DESIGN-V2 §6 — MAJOR — “close() guaranteed [T]” overstates sdk.d.ts; declaration promises forceful cleanup but exposes no completion receipt — change claim to bounded control-flow termination, with subprocess-exit guarantee remaining [A]. Watchdog must record failure if exit is not observed.`

18. `STUDY §10 / DESIGN-V2 status/T10 — MAJOR — ledger defines A1–A6 but only SMOKE-1–5 mappings; DESIGN-V2 says SMOKE-1–6 — define SMOKE-6 or correct numbering. Add assumptions for Windows lock semantics, detach survival, and held-open-input terminal-result behavior.`

19. `DESIGN-V2 §9/§10 — MAJOR — critical fingerprint contract has no test: Git failure, linked-worktree roots, raw NUL paths, content hash, park-time capture, and resume drift can regress undetected — add T11 fingerprint suite.`

20. `DESIGN-V2 §10 — MINOR — no tests cover answer-at-deadline final read, concurrent immutable answer publication, MCP payload limits, process exit codes, or report_event viewer treatment — add explicit boundary/race tests.`

21. `DESIGN-V2 §2/§3.2 — MINOR (YAGNI) — held-open routing queue, level-agnostic routing reservation, and report_event provide no required behavior for single-feature Beta — delete; use plain initial/resume prompt plus ask_operator MCP tool. Also delete global admission registry if status can scan run directories.`

## S1–S5

S1 — Reject 30 minutes default; use short configurable window, preferably 2–5 minutes, then durable park.

S2 — Unresolved; require Windows parent-console-death smoke plus child-init handshake, else remove `--detach`.

S3 — Fold discovery into per-run files; retain only short-lived global admission mutex and explicit occupancy leases.

S4 — Yes; schema validation alone does not stop semantic spoofing or storage abuse. Delete report_event for Beta.

S5 — No; lock race relocated into an invalid lifetime-lock premise, receipt race survives inside one process, watchdog relies on unproved close semantics, and denial counting now misses PreToolUse denials.

## Verdict

REDESIGN — admission primitive contradicts two-writer requirement, process death has no recovery path, and single-writer claim does not serialize competing async terminalization. Fix items 1–13 before implementation.