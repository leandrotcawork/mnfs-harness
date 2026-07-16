---
name: harness-init
description: Bootstrap the harness in a product repo that has no docs/HARNESS-PROFILE.md yet. Scouts the codebase + interviews the operator, then drafts the minimum viable profile with honest assumed/open markers. Use on first harness boot in a virgin repo, or when harness-hub finds the profile missing. Never run it to overwrite a ratified profile.
---

# Harness Init — emergent profile bootstrap

Goal: produce `docs/HARNESS-PROFILE.md` (schema: `PROFILE-TEMPLATE.md` next to
`HARNESS-CORE.md` in this plugin) good enough for L0/L1 to run — nothing more. The profile is
designed to be born thin and grow by ratification (core §0); inventing unverified detail here
is a defect, not thoroughness.

## Protocol

1. **Refuse overwrite.** If `docs/HARNESS-PROFILE.md` exists with any `ratified` section, stop
   and route the operator to the amendment protocol instead.
2. **Scout (parallel, read-only investigators — never tree-crawl in the main session).**
   Dispatch investigator subagents for repo facts:
   - build/test surface: manifests (`package.json`, `go.work`, `Cargo.toml`, `pyproject.toml`…),
     CI configs, existing scripts dirs → candidate L0/L1 commands;
   - contract artifacts: OpenAPI/GraphQL/proto specs, generated SDK dirs;
   - migrations: dirs, numbering convention;
   - FE surface: frontend root, router/layout files;
   - module layout: module roots, boundary/governance configs;
   - dev stack: launch scripts, declared ports;
   - existing doctrine: AGENTS.md / CLAUDE.md / docs for stated invariants worth importing.
   Every scout claim lands as `assumed` with `provenance: harness-init scout <date>`.
3. **Interview (one AskUserQuestion batch, ≤4 questions; second batch only if blocking).**
   Only what code cannot reveal:
   - human gates (push policy, dependency changes, live external writes);
   - shell/OS binding;
   - truth order (offer scouted candidate as default);
   - known superseded protocols to denylist.
   Unanswered → section stays `open`, never guessed.
4. **Draft.** Write `docs/HARNESS-PROFILE.md` following the template schema exactly: every
   section with `status:` + `provenance:`; sections without evidence stay `open` with one line
   saying what evidence would fill them. Seed the `## Amendment log` with the init entry.
5. **Validate minimum viability.** L0 and L1 bindings must be runnable commands (execute L0
   once if the operator permits; record result in provenance). If not runnable → report
   BLOCKED-equivalent to the operator; do not hand a dead profile to the hub.
6. **Hand off.** Report: sections `assumed` vs `open`, the exact commands bound, and the
   standing rule — first field contradiction of any `assumed` binding is a finding → fix +
   ratify, per core §0.

## Hard rules

- Read-only toward the repo except the single new profile file.
- No mission content in the profile (queue/DAG live in `.mnfs/`).
- No method content in the profile (that is core; propose upstream instead).
- Every claim marked `assumed` or `ratified` — nothing unlabeled.
