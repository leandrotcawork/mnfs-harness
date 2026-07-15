# Capability Dimensions Reference

Load at **P1a Domain Scan**, before the P1b architecture taxa. This card makes the
planner enumerate what a complete system in the detected domain could contain, so domain
breadth is an explicit operator choice — never a silent minimal default and never a silent
maximal one.

## Instantiation Protocol

1. Name the domain in one phrase (e.g. "internal ticket system", "recipe manager").
2. Walk all ten dimensions below. For each, list the concrete capabilities a typical
   system in this domain would offer, from your own knowledge.
3. Tag each capability `lean-core` (minimal usable product), `optional` (common but not
   required), or `out` (plausible but outside this brief).
4. Present ONE `AskUserQuestion` multi-select with every `lean-core` and `optional`
   capability as an option; pre-select only `lean-core`. The operator includes/excludes.
5. Record the included set to mission `## Domain Scope` (grouped by dimension) and every
   excluded capability to `## Non-Scope` with a one-line reason.

The generalization is the dimension set, not any per-domain list: a fixed frame you fill
for the specific domain (the same structural trick EARS uses for scenarios). It needs no
per-domain maintenance and works on novel domains.

## The Ten Dimensions

| # | Dimension | What it asks | Ticket-system example |
| --- | --- | --- | --- |
| 1 | Actors & roles | Who uses the system; permission tiers | admin / agent / requester |
| 2 | Core + supporting entities | Primary objects + what they need | tickets, users |
| 3 | Lifecycle & states | Status model and legal transitions | open→in_progress→resolved→closed, reopen |
| 4 | Collaboration | Multi-user interaction on an entity | comments, mentions, attachments |
| 5 | Classification & metadata | Fields that organize/prioritize | priority, category, tags, due_date |
| 6 | Audit & history | Change tracking, who-did-what | activity log, edit history |
| 7 | Notifications & delivery | How users learn of changes | email / in-app on assign or status |
| 8 | Search, filter & reporting | Finding and summarizing entities | list filter/sort, dashboards, export |
| 9 | Admin & config | Managing the system itself | user management, settings, seed |
| 10 | Integration & external | Crossing the system boundary | webhooks, API consumers, SSO, import |

## Classification Rule

- `lean-core`: remove it and the product is not usable for its stated purpose.
- `optional`: a real user would expect it eventually, but the brief works without it.
- `out`: enumerate it so the operator sees it was considered, then exclude by default.

Only `lean-core` is preselected. This preserves YAGNI while making every omission a visible
operator decision rather than a planner assumption.

## Recording

- Included → mission `## Domain Scope`, grouped by the dimension number/name above.
- Excluded → mission `## Non-Scope`, each with a one-line reason ("out of brief", "deferred",
  "operator declined").
- Chosen capabilities feed P3 scope, milestone split, feature density, and validation
  criteria. More capabilities → more milestones, but operator-chosen.

## Worked Example — novel domain (recipe manager)

Instantiating dimension 4 (Collaboration) for a recipe manager yields: ratings, comments,
shared collections, fork-a-recipe. Dimension 5 (Classification): cuisine, dietary tags,
prep-time, difficulty. No plugin change was needed — the dimension frame generalized.
