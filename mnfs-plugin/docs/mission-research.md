# MNFS Mission Research

## Purpose

Mission research gathers only the evidence needed for Mission Strategist decisions. It supports scope, milestone design, validation contracts, and risk decisions without bloating mission artifacts.

## Research Owners

| Research need | Owner |
| --- | --- |
| Current implementation state | Codebase Investigator |
| Boundaries, data flow, integration risk | Architecture Analyst |
| Current library, framework, SDK, API, CLI, or cloud behavior | External Researcher |
| Professionalizing improvements tied to mission risk | Improvement Analyst |

## Research Rules

- Inspect local code and artifacts before external recommendations.
- Use current official documentation when third-party behavior affects a decision.
- Separate facts, assumptions, recommendations, and decisions.
- Put long evidence in `research/*.md`.
- Keep mission, milestone, and feature artifacts focused on decisions and handoffs.
- Do not use research to expand scope beyond the mission outcome.

## Mission Planning Inputs

Mission Strategist may request:

- codebase audit notes;
- architecture analysis notes;
- external research notes;
- improvement analysis notes;
- user constraints and acceptance criteria.

## Mission Planning Outputs

Research may support:

- accepted, rejected, and deferred scope;
- mission validation contract;
- milestone order;
- lightweight feature briefs;
- execution guide;
- blocker or owner-decision report.
