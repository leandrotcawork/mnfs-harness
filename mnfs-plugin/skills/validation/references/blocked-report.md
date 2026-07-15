# Blocked Report

```yaml
id: B-00
type: blocked-report
status: blocked
owner: Milestone Orchestrator
parent: M-00
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0
lifecycle_scope: support
```

## Scope

Mission/Milestone/Feature ID:

## Failure Summary

Describe what failed and why it blocks advancement.

## Blocker Category

- Missing context
- Missing dependency
- Missing decision
- Retry exhausted
- External failure

## Attempts Made

| Attempt | Action | Result |
| --- | --- | --- |
| 1 |  |  |

## Gate Attestation (retry-exhausted milestone blocks only)

When the blocker category is `Retry exhausted`, this report MUST be attested by the independent milestone gate, not self-written from the orchestrator's recollection. Copy from the last `milestone-review.md` round.

- Last folded verdict: Fail
- Round (final): 
- milestone-review.md path: 
- correction_attempts / max_correction_attempts: 
- Still-failing ★ criteria with defect loci (file:line + offending token):
- Confirmed never-downgrade across rounds (no prior FAIL flipped to PASS without new `ran` evidence): Yes | No

## Evidence

List test output, QA evidence, logs, screenshots, or code references.

## Suspected Root Cause

State the most likely cause based on evidence.

## Options

- Option:
- Tradeoff:

## Human Decision Needed

State the exact decision required to continue.

## Handoff

- Current status: `blocked`
- Next owner: Human owner or Mission Strategist
- Next action: Resolve blocker or change scope.
- Required files/evidence: blocker evidence, retry history, allowed return state
- Blockers or open decisions:
