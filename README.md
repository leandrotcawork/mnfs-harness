# mnfs-harness

Single home for the MNFS planning plugin + the hub-and-chips development harness — one system.

## Layout

- `mnfs-plugin/` — the `mnfs-workflow` Claude Code plugin (marketplace `mnfs-local`).
  SOURCE OF TRUTH. `known_marketplaces.json` points here; the plugin cache under
  `.claude/plugins/cache/mnfs-local/` is derived. Edit here, then sync changed files to the
  cache (or reinstall) so live sessions pick them up.
- `harness/` — canonical copies of the hub-and-chips harness doctrine and skills:
  - `HARNESS.md` — doctrine template.
  - `skills/harness-worker/SKILL.md` — worker-facing skill (tracked in product repos at
    `.agents/skills/harness-worker/`).
  - `skills/harness-hub/SKILL.md` — hub boot skill (lives at `.claude/skills/harness-hub/`
    in the operator's checkout; that path is gitignored in product repos, so this copy is
    the durable one).

## Binding rule

Inside a product repo (e.g. `marketplace-central`), the repo's own
`docs/superpowers/HARNESS.md` is BINDING for that repo's execution. This repo holds the
canonical template: improvements land here AND in the product repo(s); divergence is a
conflict to reconcile, product repo wins for in-flight missions.

## History

- Recreated 2026-07-15: original plugin source (`Documents/Codex/2026-06-16/...`) was lost;
  rebuilt from the live plugin cache, then extended with parallel-first planning
  (P5 decomposition rule, mission Parallel Execution Plan, milestone Ownership & Concurrency,
  feature owned/forbidden/parallel-safe fields, rubric ★3 sharpening).
