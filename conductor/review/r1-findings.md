## Findings

`conductor/src/permissions.mjs:23-34,82-88 — blocker — relative paths are resolved against process.cwd(), not ctx.cwd; when conductor starts below the worktree, ../outside can be approved although the SDK resolves it outside the worktree — resolve relative tool paths against ctx.cwd before canonicalization and containment.`

`conductor/src/permissions.mjs:44-46 — blocker — path syntax checks miss relative ADS and forward-slash device/UNC forms: sub\x:ads and //?/C:/<cwd>/x are allowed, while //host/share can throw instead of returning a hard deny — reject any ADS colon after the effective drive spec and both slash forms of UNC, \\.\, and \\?\ before filesystem access.`

`conductor/src/permissions.mjs:65-75 — blocker — raw prefix matching permits dangerous suffixes: go build -o C:/outside/x, go build -toolexec <program>, go test -exec <program>, git --no-pager diff --output=<outside>, and --ext-diff all pass — add command-specific full-argv validation forbidding output paths, helper execution, config overrides, ext-diff/textconv, and equivalent escape flags.`

`conductor/src/conductor.mjs:217-223 — blocker — roles.json omits AskUserQuestion and SDK 0.3.212 defines tools as the model-visible built-in inventory, making the entire question protocol unreachable despite the direct-gate unit test — include AskUserQuestion in the effective inventory while leaving it non-auto-approved and exclusively handled by gate; reconcile the contradictory literal options snippet in DESIGN.md.`

`conductor/src/conductor.mjs:229-280 — blocker — a park is considered clean whenever parkRequest exists: iterator completion without a result still produces waiting_operator, the 60-second grace restarts for every next(), and query.interrupt() is never used as the specified fallback — use one absolute drain deadline, require both a result and iterator completion, await fallback interrupt, and otherwise append investigate(unclean-park).`

`conductor/src/conductor.mjs:232-242 — blocker — the stream wait timer always uses modelWaitTimeoutMs; a writer tool allowed 30 minutes is cut off after about 10 minutes and classified failed without watchdog_kill — use the active phase deadline and ensure every timeout produces watchdog_kill followed by investigate.`

`conductor/src/conductor.mjs:289-315 — blocker — resume does not acquire the admission mutex or recheck writer/worktree occupancy; simultaneous resumes can both validate waiting_operator, append duplicate resumed events, overwrite the same attempt file, exceed the writer cap, or resume beside another session in the same worktree — serialize resume admission and answer publication under the mutex, rechecking state, cap, worktree, and resume count immediately before resumed.`

`conductor/src/viewer.mjs:28 — blocker — registry and model-controlled values are concatenated into innerHTML without escaping; a malicious question can execute same-origin JavaScript and submit its own answer with X-Conductor: 1 — build DOM nodes with textContent or contextually escape every run/question/attribute value and add a restrictive CSP.`

`conductor/src/conductor.mjs:83-94,109-110 — major — stale-lock recovery has a check/unlink race: one process can replace the stale lock after another checks it, then have its live lock deleted; release also unlinks without verifying ownership — serialize stale reaping and store/verify an unguessable ownership token before deletion and release.`

`conductor/src/conductor.mjs:116-128,169-189 — major — watchdog phase tracking does not track tool_use IDs; one tool_result or later assistant message switches to model_wait even while other tool calls remain outstanding — maintain a set of outstanding tool-use IDs and remain tool_running until all matching results arrive.`

`conductor/src/conductor.mjs:175-182 — major — Query.interrupt() returns a Promise but the timer neither awaits it nor handles rejection, so events may claim a kill before interruption succeeds — run an async timeout handler, await interrupt, record failure, and still force investigate.`

`conductor/src/conductor.mjs:45-63 — major — fingerprint generation silently converts Git failures into empty HEAD/branch/diff values, trim() can corrupt the first NUL-delimited untracked path when it begins with whitespace, and --show-toplevel does not provide an independent common repository identity for linked worktrees — fail closed on Git errors, preserve raw -z output, and derive/canonicalize the specified repo and worktree roots independently.`

`conductor/src/conductor.mjs:206,265-277 — major — the park fingerprint is captured before deny/drain and then persisted later; changes during drain are omitted from the park baseline — compute the fingerprint immediately before writing the clean park receipt.`

`conductor/src/conductor.mjs:266-284 — major — receipt.json is written for waiting_operator although DESIGN restricts it to terminal runs — write only the park receipt for a clean park and reserve receipt.json for completed, failed, cancelled, or investigate.`

`conductor/src/conductor.mjs:156,248-272 — major — every attempt resets sessionIds, denials, questions, and watchdog events, so the final receipt does not contain all attempts; SDK result errors are also discarded, and resumed fingerprintStart replaces the manifest’s original fingerprint — aggregate attempt files/events across the run and preserve result.errors plus the manifest start fingerprint.`

`conductor/src/conductor.mjs:295-315 — major — resume does not prove exactly one unanswered question, does not require a non-null session ID matching the prior session_bound event, and can use supplied answer B in the prompt while immutable stored answer A remains authoritative — validate the unique pending envelope/session binding and require supplied and stored answers to match, or always prompt from the stored answer.`

`conductor/src/registry.mjs:75-100 — major — lifecycle validation is a read-then-append operation without per-run serialization; concurrent resume/mark/terminal writers can both validate the same predecessor and append an impossible transition history — serialize lifecycle transition validation and append across processes.`

`conductor/src/permissions.mjs:37-42 — major — .ssh, .aws, .gnupg, credentials, .claude.json, and id_rsa are denied only outside cwd, allowing the hard-denied fragments inside the worktree — deny those fragments everywhere; apply the outside-cwd exception only to .env.`

`conductor/src/permissions.mjs:7,65-75 — major — never-list classification is literal and position-sensitive: git --no-pager push, npm --silent publish, GIT push, and remove-item become capability requests instead of hard denials — normalize executable/subcommand case where appropriate and recognize global options before matching forbidden operations.`

`conductor/roles.json:11 — major — reviewer prefixes place --no-ext-diff before the Git subcommand, where Git rejects it as an unknown global option; all reviewer Bash entries are unusable — put command-specific flags after diff/log/show and omit --no-ext-diff from status, with the same correction ratified in DESIGN.md.`

`conductor/src/viewer.mjs:61-67 — major — duplicate detection has an existence-check race; concurrent submissions make writeAnswer throw EEXIST, which is returned as 400 rather than the required 409 — map destination-exists errors to 409 and rely on the immutable write as the atomic duplicate decision.`

`conductor/src/questions.mjs:27-36 — minor — immutable answers use hard-link publication instead of the specified flushed-temp rename protocol, making behavior filesystem-dependent — implement an atomic no-replace publication consistent with the contract, with explicit EEXIST handling.`

## MISSING-TESTS

- Registry:

  - Caller-supplied `eventId` rejection.
  - Caller-supplied `schemaVersion` rejection.
  - Two-child-process concurrent append integrity.
  - Allowed transitions other than `started → waiting_operator → resumed`.
  - Every transition from each terminal state.
  - First lifecycle event other than `started`.
  - State preservation for `session_bound`, `capability_request`, `answer_applied`, and `watchdog_kill`.
  - Required-reason enforcement.

- Permissions:

  - Win32 case-insensitive containment.
  - Relative ADS.
  - `\\.\` device path.
  - `\\?\` device path.
  - Forward-slash device form.
  - UNC and forward-slash UNC.
  - Stage-1 CR, single quote, `<`, `cmd`, `cmd.exe`, `pwsh`, `sh`, and `bash`.
  - Unknown Bash input fields.
  - Stage-2 invalid token characters and Unicode-whitespace behavior.
  - Never-list entries `wget`, `del`, `rmdir`, `sc`, `reg`, `schtasks`, and `Remove-Item`.
  - Never-list commands with case changes or leading global options.
  - Actual reviewer policy denying Write; the existing assertion uses `{tools:['Read']}` instead.
  - `Edit` and `NotebookEdit` containment.
  - Each hard-deny read fragment and the `.env` inside/outside-cwd distinction.
  - Dangerous matrix suffixes such as `-o`, `-exec`, `-toolexec`, `-vettool`, `--output`, `--ext-diff`, and `--textconv`.

- Questions:

  - All four listed mandatory cases are represented, but no concurrent immutable-answer race is tested.

- Conductor:

  - Every non-success SDK result subtype and query exception.
  - Clean park requiring an actual result plus iterator exit.
  - Absolute 60-second drain grace.
  - Interrupt fallback.
  - Unclean park producing `investigate`.
  - Actual park-receipt-before-waiting ordering; the current test only observes both afterward.
  - Stale-by-age lock.
  - PID-dead lock.
  - Concurrent stale-lock reclaim.
  - Concurrent writer-cap admission.
  - Concurrent same-worktree admission.
  - Resume cap.
  - Resume drift.
  - Unique pending-question validation.
  - Stored/supplied answer mismatch.
  - Missing or mismatched prior session ID.
  - Concurrent resume.
  - Resume while writer cap is full or worktree is active.
  - `operator_wait` watchdog disabled.
  - `tool_running` timeout.
  - `model_wait` timeout.
  - Multiple outstanding tool-use IDs.
  - Generic/system/status messages not resetting watchdog.
  - Receipt-before-terminal ordering; existence after completion does not prove ordering.
  - Receipt field completeness and aggregation across attempts.
  - Absence of terminal receipt during clean parking.
  - Reachability of AskUserQuestion through the real SDK tool inventory.

- Viewer:

  - Actual assertion that the bound address is `127.0.0.1`.
  - Rejection of a non-local Origin.
  - Unknown event ID returning 409.
  - Concurrent duplicate returning 409.
  - Invalid answer-map schema.
  - Viewer never appending to registry.
  - Model/registry-controlled HTML escaping and self-answer XSS prevention.

## Verdict

REJECT — fail-closed path containment is bypassable, the Bash matrix permits filesystem and process escapes, model-controlled XSS defeats operator approval, AskUserQuestion is not model-visible, and park/watchdog/resume concurrency semantics do not satisfy the ratified protocol.