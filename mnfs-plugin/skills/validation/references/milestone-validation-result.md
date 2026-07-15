# Milestone Validation Result

```yaml
id: M-00
type: milestone-validation-result
status: validating
owner: QA Validator
parent: M-00
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0
lifecycle_scope: milestone
```

## Verdict

- Verdict: Pass | Fail | Blocked
- Reviewer: milestone-reviewer crew (cold) | qa-validator (fallback single cold pass)
- Date:
- Evidence summary:
- Correction scope if failed:
- Remaining accepted risks:

This verdict is folded from the independent cold-reviewer crew, never self-graded by the orchestrator or implementer that produced the evidence. The fold UNIONs findings and never downgrades a sub-reviewer FAIL to PASS.

## Crew Review Fold

- Review artifact: `milestone-review.md`
- Round:
- Crew composition (scopes dispatched):
- Per-★ folded result:
  - ★1 Criteria coverage: Pass | Fail
  - ★2 Evidence honesty: Pass | Fail
  - ★3 Verifiability: Pass | Fail
  - ★4 Integration/composition: Pass | Fail
  - ★5 Traceability: Pass | Fail
  - ★6 Correction integrity: Pass | Fail
  - ★7 Security posture: Pass | Fail
- must_meet_pass / 7:
- Folded blocking failures with defect loci:

## Re-run Corroboration Sample

Execution-grounded re-run of milestone contract checks against the current integrated milestone state (qa-validator pass).

- Criterion ID:
- Command:
- Recorded result:
- Observed result:
- Outcome: reproduced | mismatch | could-not-reproduce
- Reason (if could-not-reproduce):

## Live Runtime Validation

Driving the running milestone live (agent-browser headless for UI; real endpoints/curl for API)
through its acceptance flows — mandatory for user-facing/runnable milestones (qa-validator pass).
Gate-produced artifacts land under `_gate-evidence/round-<N>/ui/` (flows.json, drive-log.txt,
screenshots/, traces/, network/, console/) and `_gate-evidence/round-<N>/api/`.

- Surface type: UI | API/service | both | not-applicable
- Tool used: agent-browser (headless) | curl/HTTP | n/a
- Flow exercised:
- Expected observable:
- Observed:
- Artifact (screenshot/log/response path):
- Outcome: validated | defect | could-not-drive | not-applicable
- Reason (if could-not-drive / not-applicable):

## Criteria Results

- Criterion:
- Status: Pending | Pass | Fail | Blocked | Not run
- Evidence:
- Blocking failure observed: Yes | No
- Owner:

## Handoff

- Current status: `validating`
- Next owner: Milestone Orchestrator or QA Validator
- Next action: Route correction, revalidation, or blocked reporting.
- Required files/evidence: milestone validation contract, feature evidence, correction scope, rerun evidence
- Blockers or open decisions:
