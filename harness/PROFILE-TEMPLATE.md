# Harness Profile — <repo name>

**Layer:** REPO (this file lives in the product repo at `docs/HARNESS-PROFILE.md`).
This is a SCHEMA, not a form. The profile is a LIVING document: it starts thin (drafted by the
`harness-init` skill from scouts + a short operator interview) and grows by ratification —
every field finding the hub classifies as repo-level lands here, dated (core §0 amendment
protocol). Do not invent content to fill sections; leave them `open` until the field teaches you.

Every section header carries:

```
status: ratified | assumed | open
provenance: <date> · <source: harness-init scout | operator interview | field finding <id/desc>>
```

- `assumed` — inferred by scout/interview, not yet proven in the field. First contradicting
  field result converts it (fix + ratify).
- `open` — no binding yet. Ladder levels whose bindings are `open` may not run.

---

## 1. Identity & stack
`status:` · `provenance:`

Languages, build system, package manager, monorepo layout, OS/shell binding (which shell for
stack ops; which is forbidden), default branch name.

## 2. Verification ladder bindings (core §5)
`status:` · `provenance:`

Exact commands + required env per level:
- **L0** — build, typecheck, governance/boundary lanes (and any "run from clean worktree" caveats).
- **L1** — test suites: unit command, integration command, guard suites, full-sweep triggers.
- **L2** — dev stack up (script + ports), smoke checks, evidence capture paths.

## 3. Fresh-workspace bootstrap
`status:` · `provenance:`

Steps a brand-new worktree/clone needs BEFORE lanes run honestly (hermetic cache warms, module
downloads, generated-code refresh). Include the false-alarm signatures each missing step causes
— this section exists to stop chips from debugging phantom failures.

## 4. Test database / integration strategy
`status:` · `provenance:`

Isolation unit (per-run DB? per-run container? session reuse?), lifecycle commands, known
first-boot races + absorb rules, cross-track serialization triggers (core §3 shared-test-DB rule).

## 5. Collision axes — instantiation (core §3)
`status:` · `provenance:`

| Axis | Concrete binding in this repo |
|---|---|
| Contract artifacts | <API spec path(s) + generated SDK path(s)> |
| FE surface | <frontend root + named owned seams (router, nav, layout…)> |
| Migration | <migration dir + numbering policy + block-grant convention> |
| DB shape | <schema ownership rules> |
| Module | <module root(s) + boundary rule source> |

## 6. Shared seams & owners
`status:` · `provenance:`

Enumerate hub-owned seams (contract lock, migration number blocks, dev stack, harness control
files…). One writer per seam; chips `REQUEST`, never take.

## 7. Non-negotiables (per-endpoint / per-write checks, core §5)
`status:` · `provenance:`

Repo-specific integrity rules re-checked at L0–L2, each bound to its ADR/IC where one exists
(tenancy predicates, adapter boundaries, contract+SDK same-commit atomicity, write-path gates,
"unknown ≠ zero" bindings…).

## 8. Truth order (core §6)
`status:` · `provenance:`

Ordered list of which artifacts win a conflict (architecture docs > contracts > … > tests).
Stop-and-classify rule applies against THIS list.

## 9. Human gates
`status:` · `provenance:`

Actions requiring explicit operator authorization in this repo (push, dependency changes, live
writes to external systems, …).

## 10. Superseded protocols denylist
`status:` · `provenance:`

Named skills/protocols/docs that discovery might still surface but which are RETIRED here, with
supersede dates. Chip prompts pin this list verbatim (core §2 item h).

## Amendment log

Append-only. One line per ratification:

```
<date> · <section> · <ratified|assumed→ratified|corrected> · <finding + evidence pointer>
```
