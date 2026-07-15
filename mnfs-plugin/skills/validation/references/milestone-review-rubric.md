# Milestone Review Rubric

Authority for the independent milestone gate. Run by the `milestone-reviewer` cold subagent crew, never self-graded by the orchestrator or the implementer that produced the evidence. Content-based binary criteria — NO numeric score. Each criterion: run the named procedure, write a one-line rationale + a cited excerpt (`relative/path:line`) BEFORE the verdict. If a criterion cannot be evaluated from the artifacts, its verdict is FAIL.

Reference-guided: grade the milestone's accepted feature evidence against the milestone validation contract and the interface contracts, not against intuition. The reviewer is read-only and judges evidence by inspection; it does not re-execute commands (independent re-run of sampled checks is a separate later layer).

## Must-Meet Criteria (★ — any FAIL ⇒ Fail)

### ★1 Criteria Coverage
- Procedure: list every milestone validation-contract criterion ID; confirm each is satisfied by accepted feature or milestone evidence with a recorded result. Grep the milestone scope for `TBD`/`TODO`.
- PASS iff: every contract criterion ID has matching evidence with a recorded result AND zero `TBD`/`TODO` in milestone scope.

### ★2 Evidence Honesty
- Procedure: for every load-bearing criterion, read its proof in the feature/milestone evidence. Confirm the proof carries `Evidence type: ran` AND cites a concrete artifact (a path or pasted output, not a directory or a file-location-as-proof). Find any criterion recorded `Pass` while its proof is `assumed` or `could-not-run`.
- PASS iff: no load-bearing `Pass` rests on `assumed` or `could-not-run`, AND every claimed `Pass` cites a concrete `ran` artifact. A load-bearing check that is `assumed` or `could-not-run` makes its criterion FAIL, never PASS.

### ★3 Verifiability
- Procedure: for each contract criterion, confirm a command-or-interaction + expected observable + named blocking failure + concrete evidence path. Flag generic-proof wording where a concrete observable is required — "support X", `works`, `correct`, `proper`, `valid`, `handles`, `inline` — and any `Expected:` that names a file location instead of an observable value.
- PASS iff: every criterion is concretely checkable; no generic-verb stand-ins; no directory-only or file-location-as-proof evidence.

### ★4 Integration / Composition
- Procedure: enumerate cross-feature seams in this milestone — shared enums, error codes, data shapes/field names, routes, ports, shared mutable files, id/time formats. Grep each across all feature changed-paths and evidence against the interface contract. Confirm consume-only seams were consumed, not redefined/re-serialized/extended by a consuming feature, and that the features compose (no contradictory shared state, no feature redefining another's seam).
- PASS iff: zero seam divergence across features and against the interface contract; every consume-only seam consumed as given; no composition contradiction.

### ★5 Traceability
- Procedure: backward — every accepted feature traces to ≥1 milestone criterion ID (no orphan features); forward — every contract criterion maps to a verification in the accepted evidence.
- PASS iff: bidirectional closure holds (no orphan features, no unverified criteria).

### ★6 Correction Integrity
- Procedure: if corrections ran for this milestone, read `correction_attempts`, `max_correction_attempts`, the append-only correction log, and prior validation result. Confirm attempts ≤ max, the log is append-only (no rewritten/deleted/renumbered rows), this round re-gated the WHOLE milestone (all seven ★ this round, not a spot-check of the corrected criterion), and no criterion that was FAIL in a prior round is now PASS without a new `ran` evidence path cited in the correction log (never-downgrade).
- PASS iff: no corrections ran, OR all correction invariants hold (within cap, append-only, full re-gate this round, no silent downgrade).

### ★7 Security Posture
- Procedure: determine whether the milestone scope has an auth boundary or handles PII/secrets/multi-role authorization. If it does, confirm a guard exists — a mitigation plus a Security-typed validation criterion with `ran` evidence — OR an explicit decline-with-reason.
- PASS iff: no auth/PII/multi-role surface exists, OR security is guarded (mitigation + Security-typed criterion with ran evidence), OR explicitly declined-with-reason. Silent omission on an auth/PII surface FAILS.

## Re-run Corroboration (qa-validator execution pass — folds into ★2/★3)

The cold reviewer crew judges evidence by inspection only (it is read-only). The gate adds an execution-grounded pass run by `qa-validator` (which has Bash): re-run a SAMPLE of the milestone validation-contract criteria's verification commands against the CURRENT integrated milestone state — not a replay of each feature's isolated quick-validation session.

- Sample = every mechanically re-runnable contract criterion + all security and high-risk criteria.
- Re-run targets the assembled milestone as it stands now; a check that fails because a later feature broke an earlier one is a real FAIL, not a stale-context artifact.
- Reproduces the recorded result -> corroborated.
- Mismatches (the command now fails or returns a different observable) -> the covered ★ criterion (★2 Evidence honesty, and ★3 Verifiability where the observable diverges) FAILS in the fold.
- Cannot be re-run now (manual QA, environment gone, non-idempotent) -> `could-not-reproduce`: record the reason; the criterion cannot PASS on re-run alone and falls back to the cold crew's inspection verdict.
- The re-run pass is non-mutating where possible and never fixes defects; it only reports reproduce / mismatch / could-not-reproduce.

## Live Runtime Validation (qa-validator execution pass — mandatory for user-facing/runnable milestones — folds into ★1/★3/★4)

Command re-run alone proves a check ran; it does NOT prove the assembled milestone actually works end to end for a user. When the milestone exposes a runnable surface, `qa-validator` MUST start the running milestone and drive it live — not inspect it.

- Determine the surface: a UI/browser surface, a network API/service, or both. A pure non-runnable library/CLI milestone has no live surface and this pass records `not-applicable` with the reason.
- UI surface: drive the running milestone with the `agent-browser` CLI per
  `skills/validation/references/ui-live-drive.md` (smoke preflight; declared `Drive` steps;
  five mandatory artifacts per flow under `_gate-evidence/round-<N>/ui/`). Capture screenshot, trace,
  network, console; record expected vs observed.
- API/service surface: start the service and exercise its real endpoints (request/response, status codes, persisted effects) against the contract criteria; capture the request/response artifacts.
- The pass validates that it actually works (UI behaves, API responds correctly, integration holds), not merely that files exist.
- Outcomes per exercised flow: `validated` (works as the contract requires, with artifact) | `defect` (does not behave as required — fold to FAIL on ★1 Criteria coverage and ★3 Verifiability, and ★4 Integration where a seam broke) | `could-not-drive` (no agent-browser/runtime available).
- A user-facing or runnable milestone with NO live-driven evidence — only inspection or command re-run — cannot PASS ★3: record `could-not-drive` with the missing tool/runtime; the milestone gate verdict is `Blocked` (missing required evidence), never a silent `Pass`.
- This pass is non-mutating where feasible (read flows, idempotent calls), never fixes defects, and only reports validated / defect / could-not-drive / not-applicable.

## Should-Meet Criteria (advisory — never change the verdict alone; log with auto-fixable flag)

### 8 Artifact Integrity
- No malformed/empty evidence blocks; every recorded result has a status and owner; every decisive `None` carries a reason.

### 9 Restart And Density
- Handoffs name status/owner/next-owner/next-action/artifact+evidence paths; a fresh session resumes the milestone from files alone.

## Verdict Rule (computed, not chosen)

Must-meet (★): 1 Criteria coverage, 2 Evidence honesty, 3 Verifiability, 4 Integration/composition, 5 Traceability, 6 Correction integrity, 7 Security posture.

- ALL seven ★ PASS ⇒ `Pass` (milestone status `passed`).
- Any ★ FAIL ⇒ `Fail` (milestone status `correction_needed`); emit the per-criterion yes-if conditions. Each FAIL MUST also name its Defect locus: the `file:line` of the offending content plus the exact offending token/value — not only the corrective condition. A yes-if without a defect locus is an incomplete review.
- Required artifacts (milestone validation contract, accepted feature evidence) absent ⇒ `Blocked` (milestone status `blocked`).
- Should-meet findings are logged but never flip the verdict.
- The gate also folds the qa-validator re-run corroboration pass (see above): a contract criterion whose re-run mismatches folds to FAIL on ★2/★3; the fold never upgrades a re-run mismatch to PASS.
- The gate also folds the qa-validator live runtime validation pass (see above): a `defect` folds to FAIL on ★1/★3 (and ★4 where a seam broke); a user-facing or runnable milestone with `could-not-drive` (no live-driven evidence) cannot PASS ★3 and makes the verdict `Blocked`. The fold never upgrades a live `defect` or a missing-live-evidence `could-not-drive` to PASS.
- The gate dispatches a CREW of cold, independent scoped reviewers in parallel rather than one seven-criteria reader — each covers a criterion cluster (★1+★5, ★2+★3, ★4+★7, ★6) so each reads the whole milestone with undivided attention; ★2 Evidence honesty and ★4 Integration additionally get a second independent adversarial pass (a self-graded false `Pass` and a silent seam divergence are high-cost if missed). Each scoped reviewer returns per-criterion PASS/FAIL with cited loci and computes no verdict of its own. The dispatching session FOLDS the crew: a ★ criterion FAILS if ANY reviewer that covered it returns FAIL at a cited locus; the fold UNIONs findings and NEVER downgrades a sub-reviewer FAIL to PASS. The session then computes the verdict from the seven folded ★ results by the fixed rule above. The crew adds no new criterion. If parallel dispatch is unavailable, a single full pass plus the ★2+★4 adversarial pass is the fallback.

## Output Contract

Return (and let the dispatching session persist to `<milestone-root>/milestone-review.md`, then fold into `validation-result.md`):

```markdown
# Milestone Review — <M-id> (round <n>)
reviewer: milestone-reviewer (cold)
verdict: Pass | Fail | Blocked

## Must-meet (★)
| # | Category | Procedure run | Cited excerpt (file:line) | Verdict | Yes-if (condition to pass) | Defect locus (FAIL only: file:line + offending token) |
|---|---|---|---|---|---|---|

## Should-meet
| # | Category | Finding | Cited excerpt | Auto-fixable? |
|---|---|---|---|---|

## Verdict computation
must_meet_total: 7 | must_meet_pass: <n>  ⇒ Pass iff == 7
```
