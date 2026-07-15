# Skills And Methodology Research

## Research Questions

- Which local skills/plugins already cover MNFS planning, execution, review, validation, research, delegation, and closeout?
- Where do existing skills conflict with Mission -> Milestone -> Feature ownership or evidence gates?
- Which external software delivery practices should MNFS incorporate before defining its skill map?
- What should MNFS reuse, adapt/wrap, create, or reject?

## Local Skills/Plugins Reviewed

| Candidate | What it is good at | Where it does not fit MNFS | Decision | Evidence |
|---|---|---|---|---|
| Superpowers brainstorming | Intent exploration before creative work. | Not always needed for already-specified missions. | Adapt/wrap | Local `brainstorming` description requires it before creative work. |
| Superpowers writing-plans | Detailed code implementation plans with tests and commands. | Too feature-code-specific for Mission/Milestone planning. | Adapt/wrap | Local `writing-plans` skill requires bite-sized task plans. |
| Superpowers executing-plans | Executing a written plan with checkpoints. | Does not own MNFS artifacts or hierarchy. | Adapt/wrap | Local `executing-plans` description. |
| Superpowers subagent-driven-development | Independent task execution with review checkpoints. | Can violate milestone ordering if used before dependency review. | Adapt/wrap | Local skill targets independent tasks. |
| Superpowers TDD | Test-first feature/bugfix implementation. | Insufficient alone for UI, integration, release, or acceptance validation. | Reuse/adapt | Local TDD skill; external TDD sources below. |
| Superpowers systematic-debugging | Root-cause investigation before fixes. | Needs MNFS correction scope and retry limits. | Reuse/adapt | Local debugging skill. |
| Superpowers review skills | Code-review stance and feedback processing. | QA Validator, not reviewer, owns MNFS verdict. | Adapt/wrap | Local requesting/receiving review skills. |
| Superpowers verification-before-completion | Fresh evidence before completion claims. | Must be tied to MNFS validation contracts. | Reuse | Local skill says evidence before assertions. |
| Superpowers using-git-worktrees | Isolated implementation work. | Workspace may not be a git repo. | Adapt/wrap | Current workspace is not a git repository. |
| Browser plugin | Local browser QA, screenshots, interaction checks. | Only applies to browser-visible products. | Reuse | Local Browser skill controls local targets and screenshots. |
| GitHub plugin | PR/issue orientation, review comments, CI repair, PR publishing. | Requires GitHub context; publishing is not a default MNFS action. | Reuse/adapt | Local GitHub skill descriptions. |
| Context7 MCP | Current docs for libraries/frameworks/SDKs/APIs/CLIs/cloud. | Not for business logic, refactoring, general methodology, or code review. | Reuse | Workspace AGENTS.md and exposed Context7 tools. |
| Codex skill/plugin creators | Future MNFS skill/plugin packaging. | Not phase execution tools. | Reuse | Local `skill-creator` and `plugin-creator` descriptions. |
| GitNexus skills | Codebase exploration, impact analysis, PR review, debugging. | Optional; may require index/tool availability and should not replace evidence files. | Adapt/wrap | Local GitNexus skill descriptions. |
| MNOS milestone handoff | Closeout/handoff inspiration. | MNOS-specific, not MNFS hierarchy. | Adapt concepts | Local `mnos-milestone-handoff` description. |
| Cavecrew/caveman skills | Compressed delegation/review output. | Style conflicts with professional MNFS artifacts; ownership less explicit. | Reject baseline; optional internal only | Local descriptions emphasize compressed/caveman output. |
| Documents/PDF/Presentations/Spreadsheets/Calendar | Artifact-specific production or scheduling. | Not workflow core for software delivery. | Reject for core map | Local plugin descriptions. |

## External Sources Reviewed

- [OpenAI Codex workflows](https://developers.openai.com/codex/workflows): agentic coding works best with explicit context and a clear definition of done.
- [OpenAI Codex skills](https://developers.openai.com/codex/skills): skills package instructions/resources/scripts; plugins distribute skills/apps/MCP integrations; progressive disclosure reduces context load.
- [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md): project guidance is loaded before work and can layer global/project instructions.
- [GitHub Copilot cloud agent docs](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent): agentic coding pattern of repository research, plan, branch changes, tests, diff review, and PR.
- [Anthropic skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices): good skills are concise, structured, and tested with real use.
- [Martin Fowler on spec-driven development](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html): spec before AI-written code; spec becomes source of truth.
- [Agile Alliance TDD](https://agilealliance.org/glossary/tdd/) and [Fowler TDD](https://martinfowler.com/bliki/TestDrivenDevelopment.html): test, pass, refactor cycle; TDD improves design discipline but must be practiced correctly.
- [Agile Alliance ATDD](https://agilealliance.org/glossary/atdd/): customer/development/testing perspectives define acceptance tests before implementation.
- [ADR guidance](https://adr.github.io/): ADRs capture significant decisions, rationale, trade-offs, and consequences.
- [Google SRE Production Readiness Review](https://sre.google/sre-book/evolving-sre-engagement-model/): readiness reviews verify accepted operational standards and reliability preparation.
- [DORA capabilities](https://dora.dev/capabilities/): test automation, small batches, and fast feedback improve delivery capability, including AI-accelerated teams.
- [Scrum Guide](https://scrumguides.org/scrum-guide.html): Product Goal, Sprint Goal, Definition of Done, and verified increments support focus and transparency.

## Findings

- Existing skills cover strong tactics but not the MNFS hierarchy. No local skill owns Mission -> Milestone -> Feature artifacts, scoped correction loops, and validation contracts together.
- Superpowers should be treated as available tactical ingredients, not as automatic phase mappings. `writing-plans` is a good feature-plan source, but it is not a mission planner.
- MNFS should make validation explicit and evidence-based. Codex workflows, TDD/ATDD, PRR, DORA, and Scrum all converge on clear done criteria, small feedback loops, and verified increments.
- Specs and acceptance criteria should precede feature implementation. This aligns with SDD and ATDD, while TDD applies inside implementation where automated tests are feasible.
- Browser, GitHub, Context7, and GitNexus are evidence/research accelerators. They should be invoked by phase rules, not embedded as mandatory dependencies for every mission.
- Future MNFS skills should be concise and progressive-disclosure-friendly; plugin packaging should wait until skill contracts stabilize.

## Comparison Matrix

| Candidate | MNFS phase fit | Strength | Gap | Risk | Reuse/adapt/create decision | Required customization | Evidence |
|---|---|---|---|---|---|---|---|
| `verification-before-completion` | All gates | Strong evidence discipline | Generic, not MNFS contract-aware | False pass if command is wrong | Reuse | Bind to validation contracts and artifact status | Local skill |
| `test-driven-development` | Feature/correction | Red/green/refactor discipline | Not enough for acceptance/UI/integration | Unit-test tunnel vision | Reuse/adapt | Require ATDD/QA criteria alongside TDD | Agile Alliance/Fowler |
| `writing-plans` | Feature plan | Concrete steps and commands | Too narrow for mission/milestone | Context bloat if copied wholesale | Adapt/wrap | Output to `plan.md`; concise MNFS format | Local skill |
| `executing-plans` | Feature execution | Plan-following workflow | No MNFS handoff/status model | Skips hierarchy if unwrapped | Adapt/wrap | Require spec/plan/validation artifacts | Local skill |
| `subagent-driven-development` | Parallel feature groups | Fresh workers and checkpoints | Only safe for independent tasks | Parallel drift/shared-file conflicts | Adapt/wrap | Dependency and ownership gate first | Local skill; DORA small batches |
| Browser plugin | Feature/milestone QA | Real UI evidence | Only browser-visible apps | Screenshots without verdict | Reuse | QA Validator interprets evidence | Local Browser skill |
| GitHub plugin | PR/CI/review | Remote collaboration evidence | GitHub-specific | Accidental publishing/scope expansion | Reuse/adapt | Make publish actions explicit opt-in | Local GitHub skills |
| Context7 MCP | Research/implementation | Current official docs | Not general methodology | Overuse on non-doc questions | Reuse | Enforce AGENTS resolve/query rule | AGENTS.md; tool metadata |
| GitNexus | Mission/research/review | Indexed code intelligence | Optional availability | Hidden graph assumptions | Adapt/wrap | Require cited file/command evidence | Local GitNexus skills |
| Codex skill/plugin creators | Automation packaging | Correct skill/plugin scaffolding | Not execution workflow | Premature plugin complexity | Reuse for packaging | Start instruction-only skills | OpenAI skills docs |
| MNOS handoff | Closeout | Similar handoff/evidence pattern | Different namespace/method | Leaking MNOS assumptions | Adapt concepts | Translate to MNFS contracts | Local MNOS skill |
| Cavecrew/caveman | Delegation/context saving | Compact subagent output | Style/ownership mismatch | Professional artifact degradation | Reject baseline | Only internal, translated output if used | Local cavecrew/caveman skills |
| Documents/PDF/etc. | Artifact-specific | High-quality document outputs | Not core software workflow | Tool bloat | Reject core | Use only when mission artifact type requires | Local plugin list |
| New MNFS skills | All MNFS phases | Own hierarchy/contracts | Need authoring/testing | Over-specific skills can bloat context | Create | Purpose/inputs/outputs/blocked behavior per skill | External skill best practices |

## Recommendations

- Reuse: verification-before-completion, TDD where code-testable, systematic-debugging, Browser, Context7, GitHub, Codex skill/plugin creators.
- Adapt/wrap: brainstorming, writing-plans, executing-plans, subagent-driven-development, review skills, worktrees, GitNexus, MNOS closeout concepts.
- Create: `mnfs:mission-planning`, `mnfs:milestone-execution`, `mnfs:feature-context-pack`, `mnfs:feature-execution`, `mnfs:feature-validation-review`, `mnfs:milestone-validation`, `mnfs:correction-worker`, `mnfs:mission-closeout`.
- Package strategy: start as local instruction-only skills; add scripts for scaffolding/status/validation only after repeated manual use proves stable contracts; bundle as plugin when multiple MNFS skills and optional integrations need distribution.
- Validation strategy: feature validation combines SDD/spec adherence, TDD evidence where practical, ATDD acceptance criteria, and QA-level evidence. Milestone/mission validation should follow PRR/release-readiness style: pass only with explicit evidence.

## Rejected Options

- Hardcoded phase mapping to Superpowers skills: rejected because Superpowers covers tactics, not the full MNFS hierarchy.
- Cavecrew/caveman as baseline MNFS output format: rejected due professional documentation mismatch and unclear artifact ownership.
- GitHub publishing (`yeet`) as default closeout: rejected; publishing should be explicit and human-directed.
- Artifact plugins as core MNFS tooling: rejected unless the mission specifically produces documents, PDFs, decks, or spreadsheets.
- Context7 for general methodology/code review: rejected by AGENTS.md scope; use web/primary sources or local evidence instead.
