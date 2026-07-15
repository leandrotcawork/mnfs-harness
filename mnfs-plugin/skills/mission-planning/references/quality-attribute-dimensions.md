# Quality Attribute Dimensions Reference

Load at **P1c Quality-Attribute & Risk Scan**, after the P1b architecture taxa resolve and
before the P1 STOP. This card makes the planner enumerate the non-functional bars a system in
the chosen scope could carry, so quality is an explicit operator choice — never a silent
"functional-only" default. It is the non-functional sibling of `capability-dimensions.md`.

## Instantiation Protocol

1. Take the capability set chosen in P1a and the architecture decided in P1b as the surface.
2. Walk all seven attributes below. For each, decide from the surface whether it carries a real
   bar (e.g. a user waits on a response → Performance; an auth or PII surface → Security).
3. Tag each attribute `target` (carries a bar worth fixing now), `baseline` (preselected minimum
   — see the table), or `decline` (no bar this mission).
4. Present ONE `AskUserQuestion` multi-select with every attribute as an option; pre-select the
   `baseline` set per the table's right column. The operator includes/excludes.
5. For each included attribute, capture a concrete target (a number, a policy, or a named control)
   — fold these into the P1b question batch so total operator burden stays ≤4 questions per call.
6. Record included attributes to mission `## Quality Attributes` (target + owning ADR/seam) and
   excluded attributes to `## Non-Functional Scope` with a one-line reason.

The generalization is the attribute set, not any per-domain list: a fixed frame you fill for the
specific surface (the same structural trick `capability-dimensions.md` and EARS use). It needs no
per-domain maintenance and works on novel domains.

## The Seven Attributes (ISO 25010-lite)

| # | Attribute | What it asks | Baseline-preselect when… |
| --- | --- | --- | --- |
| Q1 | Performance / responsiveness | latency/throughput targets, payload + list sizes | a real user waits on a response |
| Q2 | Security | authN/authZ depth, secret handling, input trust; STRIDE-lite (below) | any auth, PII, or multi-role surface exists |
| Q3 | Reliability / availability | failure modes, restart/recovery, data durability | data must survive restart/crash |
| Q4 | Observability | logging, error surfacing, audit/trace | any failure must be diagnosable post-hoc |
| Q5 | Usability / accessibility | a11y bar, error UX, i18n | a human-facing UI exists |
| Q6 | Maintainability | module boundaries, test depth, lint/type bar | always (baseline minimal) |
| Q7 | Compatibility / portability | target runtime/OS/browser, version pins | crosses runtimes or pins native deps |

## STRIDE-lite (nested under Q2 Security only)

When Q2 is a target, prompt which of these threats apply to the chosen surface; each that applies
gets a named mitigation AND a validation criterion. Do not produce a separate threat-model artifact.

| Threat | Applies when | Mitigation lands as |
| --- | --- | --- |
| Spoofing | identity can be forged | auth control + a 401 criterion |
| Tampering | request/data can be altered | validation/integrity check + a rejected-input criterion |
| Repudiation | actions need attribution | audit/log line + an observability criterion |
| Information disclosure | PII/secrets can leak | access control / no-secret-in-logs + a 403 / log-scrub criterion |
| Denial of service | unbounded work is reachable | input bounds / rate cap + a bounded-load criterion |
| Elevation of privilege | a role can exceed its grant | authz matrix + a 403-per-forbidden-action criterion |

## Classification Rule

- `target`: there is a real, statable bar (a number, a policy, a control) and the mission is
  worse without it. Capture the concrete target now.
- `baseline`: the preselected minimum for this surface (per the table). Included unless declined.
- `decline`: no bar this mission. Record the one-line reason so the omission is a visible operator
  decision, not a planner assumption.

Only `baseline` is preselected. This preserves YAGNI while making every non-functional omission a
visible operator decision.

## Recording

- Included → mission `## Quality Attributes`: one row per attribute with its concrete target and the
  ADR or seam that owns it. Each in-scope attribute also gets ≥1 validation-contract criterion
  (mission and/or milestone) with a concrete observable.
- Declined → mission `## Non-Functional Scope`, each with a one-line reason ("no PII", "single-user
  localhost", "out of brief").
- Risks surfaced while scanning → the mission `## Risks` register (one row each, with mitigation,
  trigger, owner).
- Security on an auth/PII surface may NOT be silently omitted: it is either targeted or explicitly
  declined-with-reason (readiness rubric ★7 enforces this).

## Worked Example — novel surface (recipe manager with public sharing)

Q1 Performance: target "recipe list p95 < 300ms over 200 seeded recipes". Q2 Security: public
share links → STRIDE info-disclosure applies → mitigation "share token is unguessable + expires",
criterion "GET with a revoked token → 404". Q5 Usability: target "WCAG AA contrast on the recipe
form". Q3/Q4/Q7 declined ("single-region hobby app", reason recorded). No plugin change was needed —
the attribute frame generalized.
