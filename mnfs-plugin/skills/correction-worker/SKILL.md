---
name: correction-worker
description: Fix only scoped MNFS validation failures with reproduction, smallest change, targeted validation, remaining-failure reporting, and retry limits.
---

# MNFS Correction Worker

## Purpose

Use this skill when Milestone Orchestrator assigns a scoped correction task or correction feature after QA Validator reports blocking validation failures.

## Trigger

- Milestone Orchestrator assigns a correction task or correction feature after blocking QA findings.

## Required Inputs

- Correction task or correction feature ID.
- Failed validation report and original QA failure evidence.
- Assigned failed criteria or blocking failures.
- Assigned scope and allowed paths.
- Retry count and retry limit.
- Required targeted validation commands or manual QA steps.
- Relevant artifacts needed to reproduce, inspect, fix, and validate the assigned failure.

## Inspect

Inspect only the assigned failure, allowed paths, relevant artifacts, and validation commands. Do not inspect unrelated failures or broaden scope without Milestone Orchestrator authorization.

## Workflow

1. Confirm the scoped correction assignment exists.
2. Confirm failed criteria, QA evidence, assigned scope, allowed paths, retry state, and validation commands are available.
3. Preserve the original QA failure trace.
4. Reproduce or inspect the assigned failure.
5. Apply the smallest scoped fix.
6. Keep changes within allowed paths.
7. Rerun targeted validation.
8. Record expected result, actual result, command output, and evidence artifacts.
9. Report remaining failures and risks.
10. Hand back to QA Validator for revalidation, or Milestone Orchestrator when blocked or scope-limited.

## Allowed Outputs

When the correction assignment grants write access, update only the assigned correction task or correction feature artifacts, changed files inside allowed paths, and targeted validation evidence. Do not update milestone or mission validation verdicts.

## Reference Routing

Load only references needed for the current write set:

- `references/correction-task.md` when updating a correction task.
- `references/feature.md` when the correction is tracked as a correction feature.
- `references/feature-spec.md` when a correction feature needs `spec.md`.
- `references/feature-plan.md` when a correction feature needs `plan.md`.
- `references/feature-validation.md` when recording targeted correction validation.
- `references/blocked-report.md` when correction cannot advance.

## Hard Limits

- Do not fix unassigned issues.
- Do not add product scope.
- Do not change validation criteria.
- Do not reset retry counters.
- Do not claim milestone, mission, or formal QA pass.
- Do not continue when the fix exceeds assigned scope.

## Handoff Target

- QA Validator for revalidation when the scoped fix is complete.
- Milestone Orchestrator when blocked, scope-limited, or missing required inputs.

## Completion Checks

Before handing off, confirm:

- correction task or feature ID is named;
- assigned scope and allowed paths are listed;
- original QA failure trace is preserved;
- changed paths are listed;
- evidence and commands are named;
- original blocking failure resolved Yes/No is stated when the handoff is a successful revalidation handoff;
- remaining failures are listed or explicitly absent;
- next owner and handoff reason are stated.

## Stop / Block

Stop with blocked when scope, evidence, reproduction, allowed paths, validation commands, environment, dependency, or retry policy prevents completion.

Stop with rejected when the correction scope must be redefined before work can continue.

## Failure Behavior

- Report blocked when required scope, evidence, reproduction, allowed paths, validation commands, environment, dependency, or retry policy is missing.
- Report rejected when the correction scope must change before work can continue.
- Preserve the original QA failure trace in the report.

## Output

Use the common output shape:

- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff

Include these correction-worker fields inside the relevant sections:

- Status (Pass/Fail/Blocked of the fix attempt)
- Assigned failure(s) addressed
- Smallest-fix summary
- Files changed (paths)
- Targeted validation evidence (command + result paths)
- Original blocking failure resolved (Yes/No)
- Handoff reason
- Handoff target
