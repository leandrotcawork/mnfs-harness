# Research Note Reference

## Purpose

Use this reference when decision-relevant evidence would bloat mission, milestone, or feature brief artifacts.

## Load When

Load only when the write set includes `MIS-<nn>-<slug>/research/*.md`.

## Target Path

`MIS-<nn>-<slug>/research/<topic>.md`

## Required Metadata

```yaml
id: R-<nn>
type: research
status: draft
owner: Mission Strategist | Codebase Investigator | Architecture Analyst | External Researcher | Improvement Analyst
parent: MIS-<nn>
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0 | QA-1 | QA-2 | QA-3 | QA-4
lifecycle_scope: support
```

## Artifact Shape

~~~markdown
# Research Note

```yaml
id: R-<nn>
type: research
status: draft
owner:
parent: MIS-<nn>
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0
lifecycle_scope: support
```

## Topic

## Sources Checked

- Source:
- Why it matters:

## Findings

- Finding:
- Evidence:

## Recommendation

## Impact On Mission

## Handoff

- Current status:
- Next owner:
- Next action:
- Required files/evidence:
- Blockers or open decisions:
````

## Writing Rules

- Create a research note only when it changes scope, architecture, validation, milestone design, or handoff.
- Keep findings factual and cite inspectable sources.
- Separate recommendation from evidence.
- Record source limitations when research is incomplete or conflicting.

## Anti-Bloat Boundary

- Do not create research notes for trivia.
- Do not paste full articles, long logs, or unrelated source material.
- Do not let research notes make final Mission Strategist scope decisions.

## Validation Check

- Topic, sources, findings, recommendation, impact, and handoff are filled.
- Every finding has evidence.
- Impact states whether mission scope, validation, architecture, or milestone design changed.
````
