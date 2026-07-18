Round-1 closure: 1–2, 5–8, 10–19, and 21 are closed in spec. Items 3, 4, and 9 remain incomplete; item 20 is only partially covered.

## Findings

1. `DESIGN-V2 §4.1/§4.3–4.4 — BLOCKER — generation validation via lease-file read is TOCTOU: generation G can validate, pause, G+1 admits, then G appends or replaces receipt; explicitly releasing the pipe before controller exit also recreates the old-owner overlap — hold the occupancy pipe until conductor process death, never manually release it; require query/transport teardown before process exit; or serialize generation-check + commit atomically under a per-run commit mutex. Add T2/T9 stale-writer barriers at the exact check/commit boundary.`

2. `DESIGN-V2 §4.4 — BLOCKER — park wins the once-latch, then exit-unobserved calls terminalize(), whose CAS must lose; the promised investigate transition cannot occur — make the park latch owner directly write the synthesized receipt and investigate event, or define an owner-token transition park→investigate without a second CAS. T4 must assert one latch winner and investigate completion.`

3. `DESIGN-V2 §4.2 — BLOCKER — recover uses only pipe liveness; every legitimate waiting_operator or completed run is lease-free and therefore recoverable as “orphaned” — require current lifecycle exactly started|resumed, validate manifest/ledger identity, and refuse waiting_operator and all terminal states. Extend T2e accordingly.`

4. `DESIGN-V2 §4.1 — MAJOR — pipe acquisition/probing defines only EADDRINUSE; asynchronous listen errors, premature “acquired” state, close-not-awaited races, and unbounded runId-derived names can misclassify liveness — normatively await either listening or error; only EADDRINUSE means occupied/alive; every other error fails closed; await probe close before proceeding; hash or UUID-validate runId. Add injected EACCES/EPERM/unknown-error, maximum-name, and close-race tests.`

5. `DESIGN-V2 §4.1 — MAJOR — predictable named pipes can be pre-bound by another local process, producing false occupancy or permanent admission denial; ACL/trust boundary is unstated — state that same-host processes are trusted and pipe squatting is out of scope, preferably include the Windows user SID in the namespace; otherwise replace the primitive with one supporting an explicit security descriptor. Add a foreign-holder test matching the chosen policy.`

6. `DESIGN-V2 §4.3/§5 — MAJOR — terminalize_suppressed is required but absent from the inherited audit taxonomy, so a conforming ledger validator must reject it — add it explicitly as a state-preserving audit event with generation and winner-kind fields; cover it in T1 and T9.`

7. `DESIGN-V2 §2/§12 T6 — MAJOR — startup requires the init inventory assertion, but no negative test proves missing ask_operator terminalizes before work — add injected init-without-tool and no-init-before-result cases, both producing failed('tool-inventory') without executing tools.`

8. `DESIGN-V2 §3.1/§12 T13 — MINOR — options count/element-size limits lack tests; concurrent immutable answer publication and CLI exit-code mapping from round-1 M20 also remain uncovered — add exact-boundary/over-boundary options tests, barrier-raced answer writers, and run/resume/recover exit-code assertions.`

9. `STUDY §9 line 96 — MINOR — still says the retained admission mechanism is a handle-held open-file lock, contradicting closed A7 and rev B — replace with Windows named-pipe admission mutex and occupancy lease.`

Q2 — 10s is acceptable for the pinned SDK/Windows baseline because SMOKE-4 observed 2s and timeout fails safely to investigate; it is an operational bound, not an SDK guarantee.

Q3 — Per-append lease reads are not acceptable as a correctness guard because check and write are non-atomic; holding the pipe until process death is simpler and removes the stale-live-writer premise.

Verdict: **ALIGNED-WITH-CHANGES** — apply findings 1–9 exactly and add the identified T1/T2/T4/T6/T9/T13 cases before implementation dispatch.