# Review Standard — code review layers (slice review · dual gate · hub spot-check)

**Layer:** METHOD (binds with `HARNESS-CORE.md` §4; referenced by it). Applies to every CODE
review dispatch: per-slice reviewer, dual-gate reviewers, hub acceptance spot-check. The
artifact gates (mission readiness rubric, milestone review rubric, qa-validator passes) keep
their own binary contract-compliance rubrics — this standard does not replace them.

Provenance: operator-requested hardening 2026-07-16; synthesized from Google eng-practices,
Microsoft Research (Bacchelli & Bird ICSE'13), Conventional Comments, Beck's simple-design
rules, and AI-reviewer mechanics (CodeRabbit/Qodo/Greptile noise controls, multi-judge gating).

## 1. Standard of review

The verdict bar is: **does this change definitely improve overall system health?** Approve when
net-positive even if imperfect; never block on "I would have done it differently." There is no
perfect code — only better code. Reviews verify, never generate scope (new scope wanted =
finding for the hub queue).

## 2. Fixed review order — spend judgment top-down

Review in this order; budget attention accordingly. Style is machine-owned (never a finding).

1. **Design / architecture fit** — the most important check (see §3).
2. **Correctness** — does it do what the slice brief intends; is that behavior right for the
   consumer; edge cases, concurrency, failure paths.
3. **Complexity & simplicity** — Beck's rules in priority order: passes the tests → reveals
   intention → no duplication → fewest elements (see §4).
4. **Tests** — behavior coverage, not line coverage: negative cases, cross-tenant cases where
   tenancy exists, assertion quality. Asserting the mock = test theater.
5. **Naming / readability** — names communicate what the item is or does.
6. **Docs / contracts** — contract artifacts updated with the code (per profile bindings).
7. **Style** — machine-owned: formatter + linters resolve it pre-review; a reviewer never
   comments on anything a deterministic tool could catch.

## 3. Design axis — global maximum, not local

Every reviewer answers three questions EXPLICITLY (one line each in the review output):

- **G1 Right solution globally?** Judge the change against the whole system (ADRs, interface
  contracts, module map), not just the diff. A change that is optimal inside its file but wrong
  for the system is a design finding.
- **G2 Alternatives considered?** Any non-trivial design decision in the slice must carry a
  1-3 line "alternatives considered" note in its plan/brief (what else was viable, why
  rejected). Missing note on a non-trivial decision = `important` finding — this is the forced
  local-vs-global check.
- **G3 Local-maximum trap?** Does the change work here but structurally block a NAMED upcoming
  milestone/feature (check the mission DAG)? "Might be needed someday" is not a finding
  (that's YAGNI's job); "blocks M-05's declared seam" is.

## 4. Simplicity — YAGNI and DRY operationalized

- **YAGNI:** every new abstraction (interface, wrapper, config knob, generic param) needs a
  SECOND named consumer that exists now or in a declared brief. No consumer = speculative
  abstraction = REJECT-list hit (core §4 checklist).
- **DRY / rule of three:** new code duplicating an existing helper/pattern = finding citing the
  existing symbol (`path:line`). Second occurrence may stand with a note; third occurrence
  MUST refactor to shared. Reviewer cites, author refactors.
- **Fewest elements:** flag code that cannot be understood quickly; nesting/flow-break-heavy
  functions get a simplification finding even when correct.
- **Standardization:** new code follows the dominant existing pattern for the same job in the
  module (error shape, repository layout, handler wiring). Divergence needs a stated reason or
  it's an idiom-mismatch finding.

## 5. Severity taxonomy — two axes, mandatory on every finding

Every finding carries `severity` + anchored locus. Never conflate "trivial" with "non-blocking".

| Severity | Meaning | Gate effect |
|---|---|---|
| `blocking` | breaks correctness/security/contract/doctrine (incl. core §4 REJECT list) | any one ⇒ REJECT/FAIL |
| `important` | design or simplicity defect that degrades system health | unresolved at gate ⇒ REJECT |
| `suggestion` | concrete improvement with reasoning | never blocks; author decides |
| `nit` | polish; would not block even in aggregate | never blocks; batched, no solo re-review round |
| `question` | genuine uncertainty; author must answer, answer may reclassify | blocks only if answer reveals ≥ important |

LGTM-with-comments is legal: approve with open `suggestion`/`nit` items when the author can be
trusted to address them. A re-review round may not be spent on nits alone.

## 6. Anchor-or-abstain + receipts

- Every finding anchors to `path:line` computed against the real diff. Cannot anchor (rename,
  multi-hunk, deleted file) → put it in a `general` bucket, marked as such — never fake a line.
- **Receipts:** before finalizing a finding, verify the claim against actual code (read the
  symbol, grep the caller, confirm the signature). A claim the reviewer did not verify is
  marked `speculative` and cannot be `blocking`/`important`. Detection without localization is
  an incomplete review.

## 7. Deterministic pre-pass — machines first, judgment second

- The profile's L0 lane (build, typecheck, vet/lint, governance/boundary scanners) MUST be
  green before any review dispatch. The reviewer receives the deterministic report as input and
  interprets/prioritizes it — never re-derives what a tool already proved.
- Anything expressible as a deterministic rule (formatter, vet, static analysis, duplication
  detector, complexity budget, AST rule) belongs in the L0 lane, not in reviewer prompts.
  A reviewer that repeatedly flags the same mechanical pattern = signal to add a rule (REQUEST
  to hub; dep additions follow the profile's dependency gate).

## 8. Dual gate — agreement gating (upgrade of core §4 obligation 4)

- Both reviewers (two model families, same fixed SHA, git read-only) emit findings in the §5
  schema independently.
- **Merge rule:** finding flagged by BOTH = confirmed at the higher severity. Flagged by ONE at
  `blocking`/`important` = the other model explicitly confirms or refutes it during
  reconciliation (with receipts); still contested = hub adjudicates. Solo `suggestion`/`nit`
  pass through unconfirmed, marked single-source.
- Reconciliation is recorded in the CLOSED event: both verdicts + the merge table.

## 9. Incremental re-review — delta only, never re-litigate

Corrective rounds re-gate the DELTA since the last reviewed SHA plus explicit resolution checks
on previously-flagged findings (`resolved`/`unresolved` each). Adjudicated findings are never
re-surfaced (never-downgrade holds). Full re-review only when the hub declares the base
invalidated.

## 10. Learnings memory — teach it once

Operator/hub corrections of reviewer false positives are recorded one line each in the repo's
review-learnings file (location bound by the profile): pattern, why it is fine here, date.
Reviewers load this file every dispatch and do not re-flag recorded patterns. Record team-wide
patterns only — never one-off exceptions.

## 11. Slice size

Target ≤ ~300 changed lines per slice. A reviewer may REJECT for size alone and demand a split
(stacked slices / by-file / vertical). Oversized-but-mechanical diffs (renames, generated code)
are exempt when declared as such in the brief.

## 12. Escalation

Author/reviewer non-convergence after one full round → hub adjudicates (technical facts beat
opinion; profile/ADR rules beat preference). Slice fails review 2× → redesign the slice, not a
third patch (core §7).
