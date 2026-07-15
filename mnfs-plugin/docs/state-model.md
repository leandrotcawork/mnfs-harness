# MNFS Lifecycle State Model

## Purpose

This model defines the operational statuses, transition rules, retry fields, and ownership boundaries for Mission, Milestone, and Feature lifecycle tracking.

`spec.md`, `plan.md`, and `validation.md` are created or updated during feature execution, not initial mission planning.

## Mission Statuses

| Status | Meaning | Allowed next statuses | Transition trigger / owner |
| --- | --- | --- | --- |
| draft | Mission request is being shaped; scope, outcomes, and constraints are not yet stable. | planned, needs_revision, abandoned | Mission Strategist or human owner accepts the mission shape, or abandons it before planning. |
| needs_revision | Readiness review (P7) returned Needs revision; planning artifacts exist but carry blocking gaps at cited loci. | planned, needs_revision, blocked, abandoned | Planning session / Mission Strategist revises at the cited loci and re-runs the P7 readiness gate. The independent Mission Reviewer (not QA Validator) owns the readiness verdict. |
| planned | Mission structure, milestones, feature briefs, and validation contract are defined. | in_progress, blocked, abandoned | Human owner or Mission Strategist starts execution, identifies a blocker, or cancels the mission. |
| in_progress | One or more milestones are being executed. | validating, blocked, abandoned | Milestone Orchestrator completes executable work, reports a blocker, or human owner stops the mission. |
| validating | Final mission validation contract is being checked. | complete, in_progress, blocked, abandoned | QA Validator owns pass/fail verdict. Mission Strategist may route or scope correction after a failed verdict, update the mission plan, or recommend blocking/abandoning, but may not pass validation. |
| blocked | Mission cannot advance without human decision, missing dependency, or unresolved validation failure. | planned, in_progress, validating, abandoned | Human owner resolves the blocker and chooses the correct return point, or abandons the mission. Re-entry to `validating` requires documented blocker resolution evidence and owner authorization. |
| complete | Mission validation contract is satisfied and traceable. | none | QA Validator records the passing verdict; human owner may record final acceptance. |
| abandoned | Mission is intentionally stopped before completion. | none | Human owner cancels the mission. |

## Mission Planning Phase Field

`planning_phase` tracks how far mission planning has advanced and is the field a fresh session reads to resume between gates (see the lost-in-the-middle restart path in `../skills/mission-planning/SKILL.md`). It is owned by the planning session, is distinct from `status`, and stops carrying meaning once `status` reaches `planned`.

| planning_phase | Gate | Meaning |
| --- | --- | --- |
| intake | P0 | Goal, constraints, non-goals, quality bar, and roots captured. |
| clarify | P1 | Domain scan, architecture clarify, and quality-attribute scan resolved (single STOP passed). |
| scope | P3 | Outcome, ADR-lite spine, and milestone headlines approved. |
| architecture | P4 | Spine finalized and shared interface contracts authored. |
| decompose | P5 | Milestone bodies and worker-sized feature briefs written. |
| validation | P6 | Mission and milestone validation contracts written. |
| ready | P7 | Readiness gate passed; `status` becomes `planned`. |

P2 research runs between `clarify` and `scope` without a distinct persisted phase value.

## Milestone Statuses

| Status | Meaning | Allowed next statuses | Trigger / owner |
| --- | --- | --- | --- |
| planned | Milestone scope, validation contract, and feature list are defined but not prepared for execution. | ready, skipped, blocked | Milestone Orchestrator confirms readiness, human owner skips it, or a blocker is found. |
| ready | Milestone can start; dependencies and execution guidance are sufficient. | in_progress, skipped, blocked | Milestone Orchestrator starts work, human owner skips it, or dependency issues block it. |
| in_progress | Features or correction work are being executed. | validating, blocked | Milestone Orchestrator sends completed work to validation or records a blocker. |
| validating | Milestone validation gate is running. | passed, correction_needed, blocked | The independent milestone-reviewer cold crew (not QA Validator) folds the verdict — passes, reports correctable failures, or identifies a blocking issue. QA Validator is the fallback single cold pass. |
| correction_needed | Validation failed but correction attempts remain and scope is actionable. | in_progress, blocked, skipped | Milestone Orchestrator dispatches correction work, retry limit is reached, or human owner skips. |
| blocked | Milestone cannot advance without human decision, external dependency, or retry exhaustion resolution. | ready, in_progress, validating, skipped | Human owner or Milestone Orchestrator resolves the blocker and chooses the correct return point, or skips. Re-entry to `validating` requires documented blocker resolution or correction evidence. |
| passed | Milestone validation contract is satisfied. | none | The milestone gate records pass and Milestone Orchestrator accepts the result. |
| skipped | Milestone is intentionally not executed for this mission path. | none | Human owner or Mission Strategist records skip rationale. |

### Gate-Integrity Precondition (`passed`)

A milestone may hold `status: passed` only when its directory holds a `validation-result.md`
whose `Verdict: Pass`, folded from an on-disk `milestone-review.md`, with `must_meet_pass`
`7/7` and no `★` recorded `Fail`. The status is **derived from that artifact, never asserted**:
`passed` with no backing result, a verdict that folds from a missing review, a `Verdict: Pass`
contradicting a `< 7/7` fold, or a `Pass` over a failing `★` are all integrity VIOLATIONS.
The deterministic verifier `scripts/status-integrity.sh <mission-root>` recomputes this and
exits non-zero on any violation; a skipped or faked gate is therefore a red exit, not a silent
omission. Mission `complete` likewise requires every non-skipped milestone `passed` under this
rule.

## Milestone Retry / State Fields

| Field | Meaning |
| --- | --- |
| correction_attempts | Number of correction cycles already attempted for this milestone after validation failure. |
| max_correction_attempts | Maximum correction cycles allowed before the milestone must become blocked or require human override. Default: `2`. |
| last_validation_result | Latest validation verdict, evidence summary, failure list, and recommended correction scope. |

Before automation exists, these fields live in milestone validation/execution notes or explicit metadata fields in the milestone artifacts. They must be updated whenever the milestone enters `validating`, `correction_needed`, `blocked`, or `passed`.

`correction_attempts` increments when the Milestone Orchestrator dispatches a scoped Correction Worker or correction feature after the milestone gate reports failed milestone validation. Each correction cycle is appended to the correction task's append-only Correction Log (never rewritten). Re-validation after a correction is a FULL independent re-gate of the whole milestone (fresh cold crew + re-run + live runtime pass over all seven ★, not a spot-check of the corrected criterion), and the gate enforces never-downgrade across rounds: a prior-round FAIL may become PASS only with new `ran` evidence cited in the log. The failed re-gate after a correction consumes the dispatched attempt. If `correction_attempts >= max_correction_attempts` after a failed re-gate, the milestone transitions to `blocked` unless the human owner explicitly authorizes more attempts; the resulting `blocked-report.md` Gate Attestation is copied from the final `milestone-review.md`, not self-recalled.

Milestone `blocked` -> `validating` requires documented blocker resolution or correction evidence and owner authorization. Owner authorization means Milestone Orchestrator authorization for normal correction evidence, or human owner authorization when the blocker required a human or external decision. The independent milestone gate still owns the validation verdict.

## Feature Statuses

| Status | Meaning | Allowed next statuses | Trigger / owner |
| --- | --- | --- | --- |
| briefed | Feature brief exists from mission planning, but execution artifacts are not yet prepared. | spec_ready, blocked, rejected | Feature Implementer drafts `spec.md`, blocks on missing context, or Milestone Orchestrator rejects scope. Trivial scope still creates a minimal spec before `planned`. |
| spec_ready | `spec.md` is created or updated and the implementation target is clear. | planned, blocked, rejected | Feature Implementer writes the plan, blocks on missing context, or Milestone Orchestrator rejects the spec. |
| planned | `plan.md` is created or updated and work can begin. | in_progress, blocked, rejected | Feature Implementer starts work, reports blocker, or Milestone Orchestrator rejects the plan. |
| in_progress | Implementation or document/package work is underway. | quick_validating, blocked, rejected | Feature Implementer completes scoped work, hits blocker, or determines the feature is invalid. |
| quick_validating | Feature-level checks are running and `validation.md` is being created or updated. | quick_validation_passed, rejected, blocked, in_progress | Feature Implementer records evidence. Move to `quick_validation_passed` when evidence satisfies the spec; return to `in_progress` only for same-session small fixups while attempts remain; move to `rejected` when spec, plan, or scope must be revised; move to `blocked` when context, dependency, decision, or retry limit prevents progress. |
| quick_validation_passed | Feature Implementer has recorded passing quick validation, but milestone acceptance has not happened yet. | accepted, rejected, blocked | Milestone Orchestrator accepts, rejects, or blocks the output after reviewing spec, plan, changed paths, and validation evidence. |
| accepted | Feature output is accepted for milestone integration. | none | Milestone Orchestrator accepts the validation evidence. |
| rejected | Feature output or scope is rejected and should not be integrated as-is. | briefed, spec_ready, planned, blocked | Milestone Orchestrator sends it back to the appropriate restart point or blocks for human decision. |
| blocked | Feature cannot advance without missing context, dependency, decision, or failed validation resolution. | briefed, spec_ready, planned, in_progress, quick_validating, rejected | Feature Implementer or Milestone Orchestrator records blocker; human owner or orchestrator resolves and chooses return point. |

## Feature Fixup / State Fields

| Field | Meaning |
| --- | --- |
| fixup_attempts | Number of same-session feature fixups attempted after quick validation finds a small, scoped failure. |
| max_fixup_attempts | Maximum same-session fixups before escalation. Default: `1` for risky or broad work, `2` for low-risk document/package edits. |
| last_feature_validation_result | Latest feature validation verdict, evidence summary, failure list, and fixup or escalation recommendation. |
| execution_mode | `full` (spec, plan, and build in one session) or `split` (the plan session stopped at `planned`; the build runs in a fresh session). Default: `full`. |
| split_decision | The `single \| split` call recorded at the `planned` state plus its one-line reason. In `full` mode the implementer evaluates `build_large(plan)`; an optional planner `execution_mode_hint` biases but does not bind. |

Before automation exists, these fields live in feature validation/execution notes or explicit metadata fields in the feature artifacts.

`fixup_attempts` increments when `quick_validating` returns to `in_progress` for a same-session small fixup. If validation still fails and `fixup_attempts >= max_fixup_attempts`, the feature must escalate to the Milestone Orchestrator and enter `blocked` or `rejected`. Further work is then governed by milestone correction/retry accounting.

The `planned -> in_progress` transition is an optional fresh-session boundary. For a `split` feature, the plan session ends at `planned` after writing `spec.md` and `plan.md`; the build runs in a new `feature-implementer` `build`-mode session that reads those artifacts and moves `planned -> in_progress` with a fresh context. Milestone Orchestrator treats a returned `status: planned` with `split_decision: split` as a dispatch signal for the build session, not as `blocked` or `rejected`. For a `full` feature the same edge stays in-session.
