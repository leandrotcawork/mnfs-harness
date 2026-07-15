# Mission Readiness Self Pre-Check

A fast author pre-flight the planning session runs BEFORE dispatching the `mission-reviewer`. It is not the gate — the gate is the independent reviewer running `readiness-review-rubric.md`. Catch the obvious gaps here so reviewer rounds aren't spent on trivial fails.

Run after all planned artifacts are written. If any line below is clearly unmet, fix it before dispatch.

## Pre-flight (author self-check)

- [ ] Every parent requirement is covered by a downstream artifact; no `TBD`/`TODO` in to-be-built scope. (rubric ★1)
- [ ] Enums, error codes, shapes, ports, and route prefixes are consistent across files and with the parent. (rubric ★2)
- [ ] Every cross-worker seam (routes, transport/cookies/CORS/proxy, shared files, version pins, id/time formats) is owned by an interface contract or ADR. (rubric ★3)
- [ ] Every acceptance criterion is concretely checkable with a real evidence path. (rubric ★4)
- [ ] No orphan artifacts, requirements, or goals. (rubric ★5)
- [ ] Every decision adopted without an operator answer is recorded under Accepted assumptions; none silently invented. (rubric ★5)
- [ ] No version-sensitive claim is silently `accepted`. (rubric ★6)
- [ ] No auth/PII/multi-role surface exists, or security is targeted (mitigation + validation criterion) or explicitly declined-with-reason. (rubric ★7)
- [ ] No empty template blocks; every decisive `None` has a reason. (rubric 9)
- [ ] If the diagram trigger is met, `architecture-map.md` exists and matches the contracts.

## Then dispatch the reviewer

Dispatch `mission-reviewer` (cold Task subagent) with the absolute `<mission-root>` and the absolute rubric path. The reviewer returns the verdict; the planning session persists `readiness-review.md` and runs the cap-3 auto-revise/escalate loop.

Persist the resulting verdict in `mission.md`:

- `Ready` -> `status: planned`
- `Needs revision` -> `status: needs_revision`
- `Blocked` -> `status: blocked`
