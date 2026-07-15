# mnfs-harness

Um sistema de desenvolvimento com IA em duas camadas que funcionam juntas:

- **MNFS** (`mnfs-plugin/`) — plugin Claude Code de **planejamento**: transforma um objetivo em
  Missão → Milestones → Features com arquitetura decidida, contratos de interface, contratos de
  validação e evidência obrigatória — tudo em arquivos restartáveis sob `.mnfs/`.
- **Harness hub-and-chips** (`harness/`) — a camada de **execução**: um hub orquestrador +
  sessões-chip por milestone + workers GPT/Claude executam o que o MNFS planejou, em paralelo,
  com gates de qualidade.

Na prática você usa **um comando para planejar e uma frase para executar**. O resto o sistema
coordena sozinho. Princípio compartilhado: **evidência não escrita = não aconteceu**.

---

## Layout do repositório

```
mnfs-plugin/          plugin Claude Code (marketplace "mnfs-local") — SOURCE OF TRUTH
  commands/           slash commands: /mission-init, /status, e os GATES
                      (/milestone-validate, /correction-create, /mission-validate,
                      /mission-closeout) — invocados PELO harness, não por você
  skills/             skills (protocolos: mission-planning, validation, mission-closeout)
  agents/             agents de planejamento e veredito (reviewers frios, qa-validator,
                      investigadores) — a execução é 100% do harness
  contracts/          topologia canônica de artefatos (.mnfs/MIS-*/M-*/F-*)
  scripts/            status-integrity.sh (gate de integridade), sync-shared-references.sh
  docs/               4 referências de runtime (shared-standards, state-model,
                      validation-system, file-contracts — carregadas por skills)
harness/              doutrina hub-and-chips (template canônico)
  HARNESS.md          a doutrina completa (§1 matriz de modelos ... §8 handoff)
  skills/harness-hub/     skill que boota a sessão HUB (orquestrador)
  skills/harness-worker/  regras para qualquer sessão despachada
  skills/codex-dispatch/  papel → flags exatas de /codex:rescue
```

**Regra de binding:** dentro de um repositório de produto (ex.: `marketplace-central`), o
`docs/superpowers/HARNESS.md` DAQUELE repo é o que vale para execução. Este repo guarda o
template canônico: melhorias pousam aqui E no(s) repo(s) de produto; divergência é conflito a
reconciliar (repo de produto vence para missões em voo).

---

## Instalação

Pré-requisitos:

- **Claude Code** (CLI ou desktop).
- **Codex CLI** (`npm install -g @openai/codex`) + plugin `openai-codex` do Claude Code —
  os workers GPT rodam nele (rode `/codex:setup` uma vez para verificar auth/sandbox).
- **`agent-browser@0.29.1` global** — sem ele a validação live-UI de milestones com superfície
  de usuário retorna `Blocked` (não é bug: é falta do pré-requisito).

### Instalar o plugin no Claude Code

Este repo é um plugin marketplace do Claude Code (manifesto em
`.claude-plugin/marketplace.json`). Instalação direta do GitHub, dentro do Claude Code:

```
/plugin marketplace add leandrotcawork/mnfs-harness
/plugin install mnfs-workflow@mnfs-harness
```

Ou pelo terminal:

```bash
claude plugin marketplace add leandrotcawork/mnfs-harness
claude plugin install mnfs-workflow@mnfs-harness
```

Docs oficiais: https://code.claude.com/docs/en/discover-plugins e
https://code.claude.com/docs/en/plugin-marketplaces.

**Desenvolvimento local** (clone deste repo): adicione o marketplace pelo caminho local —
`/plugin marketplace add ./mnfs-harness` — ou aponte a entrada em
`~/.claude/plugins/known_marketplaces.json` para `<este-repo>`. Editou o plugin aqui?
Sincronize os arquivos alterados para o cache
(`~/.claude/plugins/cache/<marketplace>/mnfs-workflow/<versão>/`) ou reinstale — o cache é
derivado, a fonte é `mnfs-plugin/`.

No repo de produto: copie `harness/HARNESS.md` para `docs/superpowers/HARNESS.md`, a skill
`harness-worker` + `codex-dispatch` para `.agents/skills/` (tracked, workers em worktree
precisam ver), e `harness-hub` para `.claude/skills/`.

---

## Como se usa de verdade (a jornada completa)

### Passo 1 — Planejar: `/mission-init`

```
/mission-init "<seu objetivo>"          # entrevista guiada: escopo, capacidades, arquitetura,
                                         #   qualidade — você responde menus e perguntas
/mission-init <mission-path> --apply     # persiste (sem --apply é tudo dry-run!)
```

O planning roda um protocolo com gates (P0–P7): clarificação → pesquisa → aprovação de escopo →
decomposição **parallel-first** (DAG de dependências + matriz de ownership por milestone:
arquivos, seções OpenAPI, blocos de migration, superfície FE, tabelas DB) → contratos de
validação → revisão de prontidão por uma crew de reviewers frios independentes.

Sai disso: `.mnfs/MIS-nn-slug/` com `mission.md` (incl. `## Parallel Execution Plan`),
`M-nn/milestone.md` (incl. `## Ownership & Concurrency`), briefs de feature e
`validation-contract.md` por nível. Isso é o **contrato de execução** — a única interface entre
as duas camadas.

### Passo 2 — Executar: bootar o HUB e deixar o harness coordenar

Abra uma sessão no repo de produto e diga **"assume o controle"** (ou invoque a skill
`harness-hub`). A partir daí o harness abstrai a execução inteira:

1. O hub lê a missão, monta a matriz de colisão a partir do `Parallel Execution Plan` e autora
   um **chip** por milestone acionável (aparece como card de task — você lança com um clique,
   em Opus).
2. Cada chip, num git worktree isolado, roda o loop P1–P8 sozinho: board de tasks → planos GPT
   em batch → implementação por slice com teste falhando primeiro (workers GPT) → revisão
   independente por slice → escada de verificação L0–L2 → **dual gate** (revisão Opus completa
   + revisão GPT, mesmo SHA fixo) → **gate MNFS de milestone**: o chip roda
   `/milestone-validate --apply` (crew fria de reviewers + QA com live-drive de browser — só QA
   passa milestone; falhou → `/correction-create` escopa e o chip despacha o worker corretivo)
   → evidência nos paths do contrato (`validation-result.md`, `F-*/validation.md`, ledger).
3. O chip devolve `CLOSED` (ou `BLOCKED`/`REQUEST`/`ESCALATION`); o hub aceita, faz merge
   `--no-ff`, roda a escada pós-merge no master integrado, sobe o dev stack e autora os
   próximos chips pelo DAG — milestones independentes rodam **em paralelo**. Todos os
   milestones fechados → o hub roda `/mission-validate` e `/mission-closeout`.

### Seu papel de operador (só isto)

- Lançar cada chip quando o hub o surfar (1 clique).
- Responder escalações/decisões que o hub não pode tomar (perguntas objetivas via menu).
- Autorizar o que é gate humano por design: push, mudança de dependência, escrita live em ML.
- `/status <path>` quando quiser ver o quadro (status + scan de integridade dos artefatos).

Você NÃO digita comandos de execução por milestone — o hub e os chips fazem isso.

### Como as duas camadas se encaixam (fluxo único, sem fallback)

O MNFS define **o que** é feito, **o que prova** que foi feito e **quem dá o veredito**
(briefs, contratos de validação, rubrica binária, crew fria de reviewers, QA com live-drive).
O harness define **quem executa e como** (hub, chips, workers GPT, dual gate). Não existem
duas engines: em 2026-07-15 a camada de execução própria do plugin (agents
milestone-orchestrator / feature-implementer / correction-worker e os comandos
/milestone-start, /feature-context, /feature-accept) foi **removida** — o harness é a única
engine, e nos gates ele invoca a máquina de veredito do MNFS (`/milestone-validate`,
`/correction-create`, `/mission-validate`, `/mission-closeout`). Onde um artefato MNFS nomeia
"Milestone Orchestrator" / "Feature Implementer" / "Correction Worker", leia: chip / worker de
implementação / worker corretivo do harness (binding canônico em
`mnfs-plugin/docs/shared-standards.md` § Role Binding).

---

## Papéis (quem é quem no sistema)

| Papel | Onde vive | Faz |
|---|---|---|
| HUB | sessão permanente (skill `harness-hub`) | autora chips, adjudica paralelismo, aceita, merge, deploy |
| Chip de milestone | sessão Opus em worktree | orquestra UM milestone fim-a-fim, emite eventos |
| Workers GPT | Codex via `/codex:rescue` | planejam features, implementam slices, investigam |
| Reviewer por slice | subagent Claude independente | revisa cada slice antes da próxima (implementer ≠ reviewer) |
| Dual gate | Opus + GPT, mesmo SHA | revisão final do diff do milestone, ambos devem limpar |
| Gate de milestone | `/milestone-validate` (chip invoca) | crew fria `milestone-reviewer` + `qa-validator` com live-drive de browser — só QA passa |
| `mission-reviewer` (MNFS) | crew fria no planning P7 | gate de prontidão do plano, rubrica binária ★1–★7 |
| Gate de missão | `/mission-validate` + `/mission-closeout` (hub invoca) | veredito QA da missão e encerramento com evidência |

---

## Painel Codex (os workers GPT)

Interface prática — 5 comandos:

| Comando | Uso |
|---|---|
| `/codex:rescue --model <m> --effort <e> --wait <prompt>` | despachar QUALQUER trabalho GPT |
| `/codex:status [job-id]` | jobs ativos/recentes |
| `/codex:result [job-id]` | saída final verbatim |
| `/codex:cancel [job-id]` | cancelar background job |
| `/codex:setup` | verificar CLI + auth (1× por máquina) |

### Papel → flags (NUNCA digite de memória — skill `codex-dispatch`)

| Papel | Flags |
|---|---|
| Planejar feature | `--model gpt-5.6-sol --effort medium --wait` |
| Implementar (padrão) | `--model gpt-5.6-luna --effort high --wait` |
| Implementar (complexo) | `--model gpt-5.6-sol --effort low --wait` |
| Investigar / leitura em massa | `--model gpt-5.6-luna --effort medium --wait` |
| Dual gate (lado GPT) | `--model gpt-5.6-sol --effort medium --wait` |

**Sempre `--effort` explícito** — o default global do codex é `xhigh`: esquecer a flag não dá
erro, só fica silenciosamente mais lento e caro.

**Dois caminhos, stdin oposto:** `/codex:rescue` (padrão, via app-server) nunca trava em stdin.
`codex exec` cru no shell (só probe de precondição / worker OS-process em background) trava
PARA SEMPRE em shell não-tty sem stdin fechado: PowerShell `@() | codex exec ...` · bash
`codex exec ... < /dev/null`. Silêncio ≥2 min = travou, mate e reemita.

---

## Referência — comandos de gate (invocados pelo fluxo, não decorados por você)

```
/mission-init "<objetivo>" [--apply]              # você — planeja a missão
/status <mission-path>                            # você — quadro + integridade dos artefatos
/milestone-validate <milestone-path> --apply      # chip, no P7 — gate frio + QA live-drive
/correction-create <milestone-path> <report> --apply   # chip — escopa correção pós-falha
/mission-validate <mission-path> --apply          # hub — veredito QA da missão
/mission-closeout <mission-path> --apply          # hub — consolida evidência e encerra
```

Pegadinha única que importa: `--apply` em todo comando que muta (senão é dry-run).

---

## Contribuindo neste repo

- Editou `mnfs-plugin/`? Sincronize para o cache do Claude Code (ou reinstale) — o cache é
  derivado, este repo é a fonte.
- Editou um reference card compartilhado entre skills? Rode
  `mnfs-plugin/scripts/sync-shared-references.sh --check` (cards são cópias byte-idênticas por
  design).
- Melhorou a doutrina do harness? Aplique aqui E no `docs/superpowers/HARNESS.md` do(s) repo(s)
  de produto — os dois andam juntos.

## Histórico

- 2026-07-15: repo criado (fonte original do plugin perdida; reconstruído do cache vivo).
  Parallel-first planning (P5, Parallel Execution Plan, Ownership & Concurrency, rubrica ★3 com
  auditoria de disjunção em 6 eixos). Análise de sistema: superfície morta removida, dedup
  comando↔skill, skill `codex-dispatch`. **Unificação por camadas**: a engine de execução do
  plugin (milestone-orchestrator, feature-implementer, correction-worker + /milestone-start,
  /feature-context, /feature-accept + skills de execução) foi removida — harness = única engine;
  MNFS = contrato + veredito; gates do harness invocam /milestone-validate, /correction-create,
  /mission-validate, /mission-closeout (Role Binding em docs/shared-standards.md). README
  reescrito como fluxo único.
