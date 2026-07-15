---
description: Validate an MNFS milestone with a cold independent reviewer crew and recommend correction scope when needed.
argument-hint: "[MILESTONE_PATH] [--apply]"
allowed-tools: Read, Glob, Grep, LS, Write, Edit, MultiEdit, Task, Bash
---

# MNFS Milestone Validate

The milestone gate is an INDEPENDENT cold-reviewer crew, never self-graded by the orchestrator that coordinated the milestone or the implementer that produced the evidence. This command session dispatches the crew, folds its findings, computes the verdict, and persists the result.

Treat runtime artifact paths as mission/workspace paths supplied by `$ARGUMENTS`. Treat package paths as relative to the plugin root (`mnfs-plugin/`) only when this command names package-owned files. The rubric lives at `mnfs-plugin/skills/validation/references/milestone-review-rubric.md`.

## Inputs

- milestone path from `$ARGUMENTS`;
- milestone validation contract;
- accepted feature artifacts (`feature.md`, `spec.md`, `plan.md`, `validation.md`) and changed paths;
- feature validation evidence with `Evidence type` tags;
- interface contracts the milestone's features share;
- integration, command, log, screenshot, CI, browser, rendered artifact, or manual QA evidence;
- correction_attempts, max_correction_attempts, and last_validation_result when available.

## Structural Precondition (deterministic, runs first)

This gate is a deterministic pre-check BEFORE the LLM crew, not advisory prose. Use `Bash` for exactly one read-only command — the integrity verifier — and nothing else.

1. Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/status-integrity.sh" <mission-root>` (the mission root that contains this milestone). It re-derives the claim/proof invariant, dangling-milestone, and evidence-existence checks and exits non-zero on any violation. Capture its full output.
2. Fold its result into the verdict, never ignore it:
   - a `ran-without-artifact` / `ran-cites-missing-artifact` / `ran-cites-empty-artifact` violation on a feature in THIS milestone means a claimed `ran` proof is not on disk → ★2 (evidence honesty) and ★3 (verifiability) cannot Pass; fold FAIL at the cited feature locus;
   - a `passed-no-result`, `verdict-*`, `never-downgrade-breach`, or `dangling-milestone` violation is a structural integrity breach → verdict is `Blocked`; do not dispatch the crew to launder a structurally broken state into a Pass;
   - `STATUS-INTEGRITY OK` is a precondition for a `Pass` verdict, never sufficient for one on its own — the crew, re-run, and live passes still run.
3. Only after the verifier is OK (or its violations are recorded and folded) proceed to Crew Dispatch.

## Crew Dispatch

1. Confirm the milestone validation contract and accepted feature evidence exist. If either is absent, the verdict is `Blocked` — do not dispatch.
**Ordering (race fix):** run the `qa-validator` execution + live-runtime pass to completion and let it
WRITE `_gate-evidence/round-<N>/` FIRST. Only AFTER that evidence is on disk, dispatch the cold
`milestone-reviewer` crew (including the ★2 evidence-honesty reviewers). The crew must always read a
fully-populated `_gate-evidence/`. Do not launch the ★2 reviewers in parallel with evidence production —
that is what produced the round-2 stale-read supersession.

2. Use the Task tool to launch a parallel crew of `milestone-reviewer` cold subagents. Give each the `<milestone-root>`, the `<rubric-path>` above, and a `<scope>` cluster. Default clusters:
   - reviewer A — `<scope>` = `★1,★5` (coverage + traceability);
   - reviewer B — `<scope>` = `★2,★3` (evidence honesty + verifiability);
   - reviewer C — `<scope>` = `★4,★7` (integration + security);
   - reviewer D — `<scope>` = `★6` (correction integrity), only when corrections ran.
3. Dispatch a SECOND independent adversarial reviewer for `★2` (evidence honesty) and for `★4` (integration/composition) — the two highest-blast-radius criteria. These are fresh subagents with no memory of the first pass.
4. Each scoped reviewer returns per-criterion PASS/FAIL with cited loci and computes no verdict of its own.

## Re-run Corroboration Pass

5. Also use Task to launch `qa-validator` (which has Bash) for an execution-grounded re-run pass. It re-runs a SAMPLE of the milestone validation-contract criteria's verification commands against the CURRENT integrated milestone state — not a replay of each feature's isolated quick-validation session, because the contract is checked after all features are built and integrated.
   - Sample = every mechanically re-runnable contract criterion + all security and high-risk criteria.
   - For each, record the criterion ID, command, recorded result, observed result, and one of: `reproduced` | `mismatch` | `could-not-reproduce` (with reason).
   - Non-mutating where possible; never fix defects; only report.
6. A `mismatch` means the assembled milestone does not actually satisfy that criterion now (e.g. a later feature broke an earlier one) — fold it as FAIL on ★2 (evidence honesty) and ★3 (verifiability) where the observable diverged. A `could-not-reproduce` cannot PASS on re-run alone; it falls back to the cold crew's inspection verdict.

## Live Runtime Validation Pass

7. In the same `qa-validator` invocation, when the milestone exposes a RUNNABLE surface, the agent MUST start the running milestone and drive it live — not inspect it. Command re-run proves a check ran; it does not prove the assembled milestone works end to end for a user.
   - Determine the surface: UI/browser, network API/service, or both. A pure non-runnable library/CLI milestone records `not-applicable` with a reason.
   - UI: drive the running milestone with the `agent-browser` CLI per the gate card
     `${CLAUDE_PLUGIN_ROOT}/skills/validation/references/ui-live-drive.md`. Pass that card path to the
     `qa-validator` dispatch. The pass runs the smoke preflight first (`agent-browser open about:blank
     && agent-browser screenshot`); on failure the UI outcome is `could-not-drive` → the verdict is
     `Blocked`. Drive each UI criterion's declared `Drive` steps against its pinned `Fixture` and capture
     the five mandatory artifacts per flow into `<milestone>/_gate-evidence/round-<N>/ui/`.
   - API/service: start the service and exercise its real endpoints (request/response, status codes, persisted effects) against the contract criteria; capture request/response artifacts.
8. Record per exercised flow: surface type, tool used, flow, expected vs observed, artifact path, and outcome `validated` | `defect` | `could-not-drive` | `not-applicable`.
   - `defect` -> fold FAIL on ★1 (criteria coverage) and ★3 (verifiability), and ★4 where a seam broke.
   - `could-not-drive` on a user-facing/runnable milestone (no live-driven evidence available) -> the verdict is `Blocked` (missing required evidence), never a silent `Pass`. Record the missing tool/runtime.
   - Non-mutating where feasible; never fix defects; only report.

## Fold And Compute

- A ★ criterion FAILS if ANY reviewer that covered it returns FAIL at a cited locus, OR the qa-validator re-run pass reports a `mismatch`, OR the qa-validator live runtime pass reports a `defect` for one of its checks, OR the Structural Precondition verifier reported a violation folded onto that criterion. UNION all findings (structural precondition + cold crew + re-run pass + live runtime pass); NEVER downgrade a sub-reviewer FAIL, a re-run mismatch, a live defect, or a structural violation to PASS.
- Compute the verdict from the seven folded ★ results: ALL seven PASS → `Pass`; any FAIL → `Fail`; required artifacts absent, OR a user-facing/runnable milestone with no live-driven evidence (`could-not-drive`) → `Blocked`.
- Verdict → milestone status: Pass → `passed`; Fail → `correction_needed`; Blocked → `blocked`.
- Persist the folded crew review to `<MILESTONE_PATH>/milestone-review.md` (rubric Output Contract shape), then fold the verdict + per-criterion ★ table into `validation-result.md`.
- The crew adds no new criterion and cannot change the milestone validation contract.

## Re-gate After Correction

When this validation runs after a correction cycle (round > 1):

- Re-gate the WHOLE milestone, not only the corrected criterion: dispatch a FRESH cold crew (no memory of prior rounds) plus the re-run pass plus the live runtime pass over the full milestone. A scoped spot-check of the fixed criterion is not a milestone re-gate — a correction can break a previously-passing seam.
- Stamp the review with its round number (`milestone-review.md` `round <n>`); never overwrite a prior round's review.
- Never-downgrade across rounds: a ★ criterion that was FAIL in a prior round may only become PASS with NEW `ran` evidence cited in the append-only correction log; confirm no prior FAIL flipped to PASS without it.
- Read (do not reset) `correction_attempts`/`max_correction_attempts`. A failed re-gate consumes the dispatched attempt.
- If the re-gate is `Fail` AND `correction_attempts >= max_correction_attempts`, the milestone is `blocked` (retry exhausted): with `--apply`, write a GATE-ATTESTED `blocked-report.md` whose Gate Attestation section copies the final folded verdict, round, `milestone-review.md` path, attempts/cap, still-failing ★ with defect loci, and the never-downgrade confirmation — never a self-recalled summary. Correction dispatch itself remains the Milestone Orchestrator's, not this gate's.

## Fallback

If Task or the `milestone-reviewer` plugin agent is unavailable, state the fallback explicitly, then run a single cold full pass over all seven ★ criteria in this session PLUS the `★2`+`★4` adversarial second pass AND the re-run corroboration pass AND the live runtime validation pass, applying the same fold-and-compute rule. The `qa-validator` agent and the `validation` skill workflow are the fallback identity for executing that single-session cold pass and the re-run pass. The cold-crew result and the single-pass fallback follow the same rubric and the same verdict rule.

## Runtime Rules

- issue exactly one folded verdict: Pass, Fail, or Blocked;
- missing required evidence blocks advancement;
- a load-bearing criterion proven only by `assumed` or `could-not-run` evidence FAILS — never Pass;
- when validation fails, report the folded blocking failures with defect loci and recommended correction scope;
- the gate may recommend correction scope but must not execute corrections;
- retry fields may be read and reported, but correction dispatch belongs to Milestone Orchestrator.

## Persist Always, Transition On Apply

The verdict artifacts are the product of a gate run and are NOT dry-run-gated: whenever the crew + re-run + live passes execute, ALWAYS write `milestone-review.md` and `validation-result.md` (the folded verdict, per-★ table, structural-precondition output, re-run and live records). A verdict that exists only in this chat session is not a verdict.

Only the STATE TRANSITION is `--apply`-gated: flip `milestone.md` `status:` (passed/correction_needed/blocked) and write retry/blocked fields only when `$ARGUMENTS` includes `--apply` or the user explicitly confirms apply/write/create. Without `--apply`, still write the two verdict artifacts, then end the report with a one-line banner: `STATUS NOT FLIPPED — re-run with --apply to record the milestone status transition.`

## Always Write (the verdict is the product, not the transition)

- `<MILESTONE_PATH>/milestone-review.md`
- `<MILESTONE_PATH>/validation-result.md`

## With Apply, Only Write (the state transition)

- `<MILESTONE_PATH>/milestone.md` `status:` + retry/state fields
- `<MILESTONE_PATH>/execution-guide.md` correction scope or handoff section when configured
- `<MILESTONE_PATH>/blocked-report.md` when retry limits or external blockers stop progress

### Post-Write Attestation (when a Pass writes `status: passed`)

After writing `status: passed` and its `validation-result.md`, re-run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/status-integrity.sh" <mission-root>`. It MUST exit `STATUS-INTEGRITY OK`. A non-OK exit means the green status is not backed by its proof artifact — the Pass is invalid: revert the milestone to the pre-write state and record `Blocked` with the verifier output. The green write is therefore self-attesting; a milestone never holds `status: passed` that the deterministic verifier would reject.

## Forbidden

- computing a verdict without persisting `milestone-review.md` and `validation-result.md` (a verdict that exists only in the transcript is not a verdict);
- computing a `Pass` verdict or writing `status: passed` without running the Structural Precondition verifier and the Post-Write Attestation;
- using `Bash` for anything other than the read-only `status-integrity.sh` integrity verifier;
- self-grading the milestone by the orchestrator or implementer that produced the evidence;
- passing without required evidence;
- passing a load-bearing criterion on `assumed`/`could-not-run` evidence;
- downgrading any sub-reviewer FAIL to PASS during the fold;
- implementation fixes;
- correction task or correction feature creation;
- broad rewrite recommendation outside the milestone contract;
- validation criteria changes;
- milestone or mission advancement by assumption.

## Output

Use these sections:

- Summary
- Findings
- Evidence
- Risks
- Recommendation
- Next Handoff

Include these required fields inside the output shape:

- Status
- Validation verdict (folded)
- Structural precondition result (`status-integrity.sh` output + exit; pre-dispatch and post-write attestation)
- Contract checked
- Crew composition and per-★ fold result
- Re-run corroboration sample (criterion ID, command, recorded vs observed, reproduced/mismatch/could-not-reproduce)
- Live runtime validation (surface type, tool used, flow, expected vs observed, artifact path, validated/defect/could-not-drive/not-applicable)
- Artifact paths (incl. `milestone-review.md`)
- Evidence/commands
- Blocking failures with defect loci
- Recommended correction scope (milestone/feature scope only; mission verdicts route scope to Mission Strategist)
- Required next inputs
- Handoff reason
