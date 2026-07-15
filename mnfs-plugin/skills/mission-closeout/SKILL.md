---
name: mission-closeout
description: Use this skill when a Mission Strategist needs to close an MNFS mission with final validation evidence, milestone traceability, unresolved risks, accepted limitations, and next-owner handoff.
---

# MNFS Mission Closeout

## Purpose

Close or block one MNFS mission after final validation evidence is available. Mission Strategist owns closeout routing and handoff. QA Validator owns the mission validation verdict.

## Required Inputs

- Mission path.
- Mission validation result.
- Milestone validation results.
- Final evidence index.
- Unresolved risks and accepted limitations.
- Next owner or next-session audience.
- Apply/write authorization if closeout artifacts may be updated.

## Inspect

Inspect only mission closeout artifacts, milestone verdict summaries, final validation evidence, and references needed for the current write set. Do not inspect unrelated missions, feature implementation details, prompt drafts, agent files, skill files, or development scaffold.

## Workflow

1. Confirm mission identity, final status, mission validation result, and milestone verdicts.
2. Separate final facts, missing evidence, accepted limitations, unresolved risks, and recommendations.
3. Confirm the QA Validator verdict is recorded before closing as complete.
4. If final evidence is missing, mark closeout as blocked and name the missing owner and evidence.
5. Consolidate a concise evidence index.
6. Record unresolved risks and accepted limitations without changing the QA verdict.
7. Prepare next-owner or next-session handoff with required files and next action.
8. Hand off to the human owner, Mission Strategist, or Milestone Orchestrator according to the closeout state.

## Reference Routing

Load only references needed for the current write set:

- `references/mission-validation-result.md` for final verdict, evidence index, risks, and closeout handoff.
- `references/blocked-report.md` when final closeout cannot advance.
- `references/execution-guide.md` only when the mission needs a next-session handoff section and the guide is the active handoff artifact.

## Allowed Outputs

With explicit write, apply, or create approval, update:

- mission `validation-result.md`;
- mission `blocked-report.md`;
- mission `execution-guide.md` handoff section when it is the active next-session artifact.

## Hard Limits

- Do not change QA Validator verdicts.
- Do not close a mission as complete without final validation evidence.
- Do not create new feature or milestone scope.
- Do not run deployment or release actions.
- Do not require prompt docs, agent files, skill files, or development scaffold at runtime.

## Context Rules

- Keep closeout focused on verdict, evidence, risks, accepted limitations, and next owner.
- Link evidence instead of copying long logs.
- Record missing evidence as blocked instead of inferring success.

## Completion Checks

Before handing off, confirm:

- mission ID/path is named;
- validation result path is named;
- milestone verdicts are summarized;
- evidence index is concise and inspectable;
- unresolved risks and accepted limitations are explicit;
- next owner and handoff reason are stated.

## Stop / Block

Stop with blocked when final validation result, milestone verdicts, required evidence, owner decision, or artifact write access is missing.

## Output

Use:

- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff
