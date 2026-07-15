# Validation System

MNFS validation converts mission, milestone, and feature intent into explicit criteria, evidence, and verdict ownership. It prevents advancement by assumption: required evidence must exist, and blocking failures must be resolved or escalated.

## Criterion Grammar

Use one section per criterion. Keep names short and observable.

```markdown
## Criterion: <name>
ID: <stable immutable code, e.g. M-01-C03; assigned once, never renumbered>
Level: Mission | Milestone | Feature
Type: Functional | Engineering | Architecture | QA | Documentation | Security | Performance
Required: Yes | No
Status: Pending | Pass | Fail | Blocked | Not run
Evidence:
- Command:
- Expected:
- Actual:
- Artifact:
Blocking failure:
Blocking failure observed: Yes | No
Owner:
```

**UI criteria — `Drive` block (optional).** A criterion whose surface is a browser UI carries a
`Drive (UI — agent-browser; UI criteria only)` block: a pinned `Fixture` (the single canonical seed
the feature worker and the gate both use) and declared `Steps` (open/fill/click/assert). The milestone
gate's live-runtime pass executes these identical steps every round via the `agent-browser` CLI (see
`skills/validation/references/ui-live-drive.md`), capturing durable evidence into
`_gate-evidence/round-<N>/ui/`. The deterministic `status-integrity.sh` backstop refuses a
`passed` UI milestone that lacks all-`validated` `_gate-evidence/round-*/ui/flows.json`
(`passed-without-live-ui`).

Field rules:

- `ID` is a stable, immutable criterion identifier. It is copied verbatim into the feature context pack so a feature builds to — and is later judged against — the exact criterion. Never renumber or reuse an ID.
- `Level` identifies the gate where the criterion is judged.
- `Type` groups criteria by validation concern.
- `Required: Yes` means evidence must be present before advancement.
- `Required: No` means the criterion can inform risk acceptance but does not block by missing evidence alone.
- `Evidence` must record the command or manual step, expected outcome, actual outcome, and artifact path or link when available.
- `Blocking failure` names the failure condition that prevents advancement if observed.
- `Owner` names who records or judges the item.

Advancement rules:

- Missing evidence for `Required: Yes` blocks advancement.
- Missing evidence for `Required: No` does not block by itself.
- If a criterion's `Blocking failure` condition is observed, it blocks advancement regardless of `Required` value.
- Non-required criteria may be accepted as risks only when the owner records the reason and impact.
- The independent milestone-reviewer cold crew owns the milestone validation verdict; QA Validator owns the mission validation verdict (and is the fallback single cold pass for the milestone gate).
- Feature Implementer records quick feature validation; Milestone Orchestrator accepts, rejects, or blocks feature output.
- QA Validator owns feature-level verdicts only when Milestone Orchestrator explicitly invokes formal feature validation review.
- Validation contracts describe expected criteria; validation result artifacts record the actual verdict, evidence summary, and remaining risks.

## QA Levels

| Level | Meaning | Typical evidence |
| --- | --- | --- |
| QA-0 | Not applicable | Rationale for why QA does not apply. |
| QA-1 | Mechanical checks only | Tests, lint, typecheck, build, formatting, static checks. |
| QA-2 | Local/manual product flow evidence without browser automation, screenshots, or log artifact requirement | Manual flow notes, local app behavior, command output. |
| QA-3 | Browser/app/tool-assisted validation with durable screenshots, logs, or rendered artifacts | Browser screenshots, app logs, network/output logs, rendered artifacts. |
| QA-4 | Full release-style validation, including CI and integration evidence | CI run, integration checks, release checklist, cross-system evidence. |

Select the lowest QA level that proves the contract. Raise it when user-facing behavior, integration risk, or release readiness requires stronger evidence.

At the milestone gate, a user-facing or otherwise runnable milestone requires QA-3 or higher: the qa-validator pass drives the running milestone live (agent-browser headless for UI; real endpoints for an API) through its acceptance flows and captures durable artifacts. A user-facing/runnable milestone with no live-driven evidence (`could-not-drive`) is Blocked, not Pass.

## Evidence Rules

- Evidence must be reproducible enough for the next worker to inspect or rerun.
- Commands should include exact command text and pass/fail result.
- Manual QA should include the flow, observed result, and environment.
- Screenshots, logs, rendered files, CI links, or generated reports should be linked as artifacts.
- If a check cannot run, record why, what is missing, and whether that blocks advancement.

## Verdict Ownership

- Feature gate: Feature Implementer records quick validation in `validation.md` with evidence-honesty types; Milestone Orchestrator accepts, rejects, or blocks it for milestone integration, evidence-bound — never accepting on `assumed`/`could-not-run` evidence or without a cited `ran` artifact, and routing auth/PII/security-surface or high-integration features to independent QA Validator review before acceptance. The independent milestone gate re-checks all accepted evidence.
- Formal feature review: QA Validator owns the feature-level verdict only when explicitly invoked by Milestone Orchestrator.
- Milestone gate: an independent milestone-reviewer cold crew (dispatched by `/milestone-validate`) compares milestone output to the milestone validation contract against the milestone review rubric, plus a qa-validator execution pass that (a) re-executes a sample of the contract checks against the current integrated milestone state and (b) for user-facing/runnable milestones drives the running milestone live (agent-browser headless for UI; real endpoints for API) through its acceptance flows to confirm it actually works; the gate folds all of it (a FAIL, a re-run mismatch, or a live defect never downgraded; a user-facing milestone with no live-driven evidence is Blocked), and records Pass, Fail, or Blocked. QA Validator is the fallback single cold pass when the crew cannot be dispatched.
- Mission gate: QA Validator compares final output to the mission validation contract and records Pass, Fail, or Blocked.
- Correction scope after milestone failure is created by Milestone Orchestrator from QA Validator findings.

## Failure Handling

- Failed blocking criterion: stop advancement and route correction or blocked reporting, regardless of `Required` value.
- Missing required evidence: stop advancement until evidence is supplied or a human owner explicitly changes the contract.
- Correctable milestone failure: Milestone Orchestrator dispatches correction work within retry policy, appending each cycle to the append-only correction log; the corrected milestone is then re-gated in FULL by the independent gate (fresh cold crew + re-run + live runtime pass over the whole milestone), which enforces never-downgrade across rounds.
- Retry exhausted or unavailable dependency: create `blocked-report.md` and wait for human decision. A retry-exhausted milestone block must be gate-attested — its Gate Attestation copied from the final `milestone-review.md` (verdict, round, still-failing ★ with defect loci, never-downgrade confirmation), not self-recalled by the orchestrator.
