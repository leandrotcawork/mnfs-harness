# Mission Readiness Review Rubric

Authority for the independent P7 gate. Run by the `mission-reviewer` cold subagent, never self-graded by the planning session. Content-based binary criteria — NO numeric score. Each criterion: run the named procedure, write a one-line rationale + a cited excerpt (`relative/path:line`) BEFORE the verdict. If a criterion cannot be evaluated from the artifacts, its verdict is FAIL.

Reference-guided: grade each downstream artifact against its parent brief and the interface contracts, not against intuition.

## Must-Meet Criteria (★ — any FAIL ⇒ Needs revision)

### ★1 Completeness
- Procedure: list every requirement/criteria ID in the parent brief; confirm each is covered by ≥1 downstream artifact. Grep the to-be-built scope for `TBD`/`TODO`.
- PASS iff: every parent requirement is covered AND zero `TBD`/`TODO` in to-be-built scope.

### ★2 Consistency
- Procedure: grep every enum value, error code, data shape/field name, port, and route prefix across ALL files; compare against the interface contracts and parent constraints. Also confirm interface-contract completeness: every error case any feature can return has a row in the IC Error Matrix (a feature returning a case/trigger absent from the matrix is a divergence even when the code itself is valid), and every list/collection operation declares its sort order.
- PASS iff: zero divergence across files and with the parent; the Error Matrix covers every feature-returned case; every list operation declares ordering.

### ★3 Seam Ownership
- Procedure: enumerate cross-worker seams — route namespace (client + server), transport (cookies incl `sameSite`/`secure`/`httpOnly`, CORS origin, credentials mode, dev proxy), shared mutable files, version/env pins, id/time formats. For each, find the owning IC or ADR.
- PASS iff: every enumerated seam is owned by an interface contract or ADR.

### ★4 Verifiability
- Procedure: for each acceptance criterion, confirm a command-or-interaction + expected result + named blocking failure + concrete evidence path. Flag any generic-proof wording where a concrete observable is required — "support X", `works`, `correct`, `proper`, `valid`, `handles`, `inline` — and any `Expected:` that names a file location instead of an observable value (status / JSON shape / field values / visible result).
- PASS iff: every criterion is concretely checkable; no generic-verb stand-ins; no directory-only or file-location-as-proof evidence.

### ★5 Traceability
- Procedure: backward — every artifact traces to a parent requirement (no orphans); forward — every requirement maps to a verification; decomposition — no orphan goals. Also confirm assumption traceability: every cross-worker decision the plan adopted without an operator answer is recorded under `Clarified Decisions` -> `Accepted assumptions:`. An invented cross-worker decision absent from that list is an orphan assumption. A recorded assumption is accepted-and-explicit and does NOT fail this criterion.
- PASS iff: bidirectional closure holds (no orphan artifacts, no unverified requirements, no orphan goals) AND no invented cross-worker decision is missing from `Accepted assumptions:` (no orphan assumption). Recorded assumptions never fail this criterion.

### ★6 Evidence Honesty
- Procedure: find every version-sensitive claim (library/API/CLI/framework/cloud behavior). Check each is `verified` (source + date) OR explicitly `assumed`/`verify-at-install`.
- PASS iff: no version-sensitive claim is silently `accepted`. A claim marked `verify-at-install` passes; if it is load-bearing for an architecture decision, log a should-meet advisory recommending live verification.

### ★7 Security Posture
- Procedure: determine whether the to-be-built scope has an auth boundary or handles PII/secrets/multi-role authorization. If it does, confirm Security appears in mission `## Quality Attributes` with ≥1 mitigation AND ≥1 Security-typed validation criterion, OR appears in `## Non-Functional Scope` with an explicit reason. If the scope has no such surface, this criterion is N/A and PASSES.
- PASS iff: no auth/PII/multi-role surface exists, OR security is targeted (mitigation + validation criterion) OR explicitly declined-with-reason. Silent omission of security on an auth/PII surface FAILS.

## Should-Meet Criteria (advisory — never change the verdict alone; log with auto-fixable flag)

### 7 Unambiguity
- Acceptance criteria are EARS-structured; no vague modifiers or generic verbs (`correct`/`works`/`handles`/`inline`) standing in for a concrete value; feature contract values are definitive, not hedged ("X or Y"); one term per concept; what-not-how.

### 8 ADR And Architecture Coverage
- Each decision has Decision + Prevents/Context + Must-preserve + ≥1 negative consequence/trade-off (recorded per-decision or in a consolidated Accepted-trade-offs list); architecture names topology, crosscutting (security/observability), and risks.

### 9 Artifact Integrity (lint — mostly auto-fixable)
- No malformed/empty template blocks; every Given/When/Then populated or the scenario removed; every decisive `None` carries a reason; no decorative sections.

### 10 Restart And Density
- Handoffs name status/owner/next-owner/next-action/artifact+evidence paths; a fresh session resumes from files alone; briefs dense enough that `spec.md` refines instead of reinvents.

### 11 Non-Functional Coverage
- Every quality-attribute dimension (Q1–Q7) is either targeted (concrete target + owner + ≥1 validation criterion) or declined-with-reason under `## Non-Functional Scope`. The risk register is structured: one row per risk with likelihood, impact, mitigation, trigger, and owner — no bare prose risks.

## Diagram Consistency (part of ★2 when `architecture-map.md` exists)
- Diagram nodes/edges match IC operations; state nodes match the IC enum; ports match topology; build-order matches milestone deps. Drift is a defect — advisory unless it contradicts a ★ seam.

## Verdict Rule (computed, not chosen)
- ALL seven ★ PASS ⇒ `Ready`.
- Any ★ FAIL ⇒ `Needs revision` (emit the per-criterion yes-if conditions). Each FAIL MUST also name its Defect locus: the `file:line` of the offending content plus the exact offending token/value — not only the corrective condition. A yes-if without a defect locus is an incomplete review.
- Required artifacts absent ⇒ `Blocked`.
- Should-meet findings are logged but never flip the verdict.
- At P7 the planning session dispatches a CREW of cold, independent scoped reviewers in parallel rather than one 10-criteria reader — each covers a criterion cluster (★1+★5, ★2+★3, ★4+★6, ★7) so each reads the whole tree with undivided attention; ★2 Consistency and ★7 Security Posture additionally get a second independent adversarial pass (a divergence or unguarded auth/PII surface is silent and high-cost if missed). Each scoped reviewer returns per-criterion PASS/FAIL with cited loci and computes no verdict of its own. The session FOLDS the crew: a ★ criterion FAILS if ANY reviewer that covered it returns FAIL at a cited locus; the fold UNIONs findings and NEVER downgrades a sub-reviewer FAIL to PASS. The session then computes the verdict from the seven folded ★ results by the fixed rule above. The crew adds no new criterion. If parallel dispatch is unavailable, a single full pass plus the ★2+★7 adversarial pass is the fallback.

## Output Contract
Return (and let the planner persist to `<mission-root>/readiness-review.md`):

```markdown
# Readiness Review — <MIS-id> (round <n>)
reviewer: mission-reviewer (cold)
verdict: Ready | Needs revision | Blocked

## Must-meet (★)
| # | Category | Procedure run | Cited excerpt (file:line) | Verdict | Yes-if (condition to pass) | Defect locus (FAIL only: file:line + offending token) |
|---|---|---|---|---|---|

## Should-meet
| # | Category | Finding | Cited excerpt | Auto-fixable? |

## Verdict computation
must_meet_total: 7 | must_meet_pass: <n>  ⇒ Ready iff == 7
```
