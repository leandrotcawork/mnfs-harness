# mnfs-harness

Casa única de duas peças que funcionam como um sistema só:

1. **`mnfs-plugin/`** — o plugin **mnfs-workflow** para Claude Code: planejamento e execução
   de trabalho em três níveis — **Missão → Milestone → Feature** — com gates de qualidade,
   evidência obrigatória e artefatos restartáveis em disco.
2. **`harness/`** — a doutrina **hub-and-chips**: como sessões de IA (Claude + Codex/GPT)
   executam esses milestones em paralelo com qualidade — quem roda o quê, com qual modelo,
   com qual evidência.

O plugin planeja; o harness executa. Os dois compartilham o mesmo princípio: **evidência não
escrita = não aconteceu**.

---

## Layout do repositório

```
mnfs-plugin/          plugin Claude Code (marketplace "mnfs-local") — SOURCE OF TRUTH
  commands/           9 slash commands (/mission-init, /milestone-start, ...)
  skills/             8 skills (protocolos: mission-planning, milestone-execution, ...)
  agents/             10 agents (feature-implementer, qa-validator, reviewers frios, ...)
  contracts/          topologia canônica de artefatos (.mnfs/MIS-*/M-*/F-*)
  scripts/            status-integrity.sh (gate de integridade), sync-shared-references.sh
  docs/               documentação de design (future-plugin-spec.md = ASPIRACIONAL, não é o shipped)
harness/              doutrina hub-and-chips (template canônico)
  HARNESS.md          a doutrina completa (§1 matriz de modelos ... §8 handoff)
  skills/harness-hub/     skill que boota a sessão HUB (orquestrador)
  skills/harness-worker/  skill de regras para qualquer sessão despachada
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
  necessário para os workers GPT (rode `/codex:setup` uma vez para verificar auth/sandbox).
- **`agent-browser@0.29.1` global** — sem ele o gate de validação live-UI de milestones com
  superfície de usuário retorna `Blocked` (isso não é bug: é falta do pré-requisito).

Plugin: este repo entra como marketplace de diretório. No `known_marketplaces.json` do Claude
Code (`~/.claude/plugins/known_marketplaces.json`), a entrada `mnfs-local` aponta para
`<este-repo>/mnfs-plugin`. Editou o plugin aqui? Sincronize os arquivos alterados para o cache
(`~/.claude/plugins/cache/mnfs-local/mnfs-workflow/<versão>/`) ou reinstale, senão as sessões
vivas continuam vendo a versão velha.

---

## Parte 1 — MNFS: planejar e executar missões

### O modelo mental

- **Missão** (`MIS-nn`): um objetivo de produto com arquitetura decidida, contratos de
  interface e uma fila de milestones. Vive em `.mnfs/MIS-nn-slug/mission.md`.
- **Milestone** (`M-nn`): uma fatia de engenharia coerente com resultado observável, superfícies
  exclusivas (Ownership & Concurrency) e contrato de validação próprio.
- **Feature** (`F-nn`): unidade do tamanho de um worker — brief denso o bastante para uma sessão
  fresca implementar sem reinventar decisões (spec → plan → código → validação).

Todo estado vive em arquivos sob `.mnfs/` — qualquer sessão nova retoma do disco, nunca de
memória de chat. Planejamento é **parallel-first**: a missão declara o DAG de dependências e a
matriz de ownership (arquivos, seções OpenAPI, blocos de migration, superfície FE, tabelas DB)
para que milestones independentes rodem simultaneamente.

### Quickstart — uma missão do zero ao fim

```
/mission-init "<objetivo>"                       # P0-P7: entrevistas de clarificação (você
                                                  #   responde menus/perguntas), escopo, decomposição,
                                                  #   revisão de prontidão por crew independente
/mission-init <mission-path> --apply              # persiste (sem --apply é TUDO dry-run!)

# por milestone, na ordem do DAG:
/milestone-start <mission-path> M-01 --apply      # orquestra: despacha features, aceita/rejeita
/milestone-validate <milestone-path> --apply      # gate frio independente + QA + live-drive
#   falhou? → /correction-create <milestone-path> <report> --apply → revalidar

# fechamento:
/mission-validate <mission-path> --apply          # veredito QA da missão
/mission-closeout <mission-path> --apply          # consolida evidência e encerra

/status <path>                                    # qualquer momento: status + scan de integridade
```

### As 5 pegadinhas de quem está começando

1. **`--apply` em todo comando que muta.** Sem ele, tudo é dry-run — o comando relata o que
   FARIA e não escreve nada. Primeira vez sempre dry-run (leia o report), depois `--apply`.
2. **Paths são argumentos.** Você retipa `.mnfs/MIS-nn-slug` / `M-nn-slug` nos comandos
   seguintes — copie do report anterior, não invente.
3. **Gates não se auto-disparam.** `/milestone-start` terminar NÃO valida o milestone; você
   invoca `/milestone-validate` em seguida. Idem `/mission-validate` e `/mission-closeout`.
4. **`/feature-context` e `/feature-accept` são opcionais** — escape hatches para inspecionar
   ou intervir manualmente em UMA feature. O loop do `/milestone-start` já faz os dois
   automaticamente.
5. **Só QA passa um milestone.** Orquestrador aceita features; o veredito do milestone vem do
   gate frio (`/milestone-validate`), nunca da própria sessão que implementou.

### Papéis (quem é quem)

| Agente | Papel |
|---|---|
| `mission-reviewer` / `milestone-reviewer` | revisores FRIOS, read-only, rubrica binária — o gate de prontidão (P7) e o gate de milestone |
| `qa-validator` | dono dos vereditos formais (missão/feature) + corroboração live |
| `milestone-orchestrator` | coordena um milestone: despacho, aceite, correção |
| `feature-implementer` | executa UMA feature em sessão fresca (spec → plan → código → validação) |
| `correction-worker` | conserta UMA falha de validação com escopo travado |
| `codebase-investigator` / `external-researcher` | evidência de repo / pesquisa externa citada |
| `mission-strategist` | autoridade macro + closeout |
| `mission-planner` | atalho de CLI (`claude --agent mnfs-workflow:mission-planner`) — mesmo protocolo do `/mission-init`, persona dedicada |

---

## Parte 2 — Harness hub-and-chips: execução paralela com qualidade

Doutrina completa em [harness/HARNESS.md](harness/HARNESS.md). Resumo operacional:

### A topologia

- **HUB** (uma sessão permanente, boota com a skill `harness-hub`): dona do merge, do deploy,
  dos seams compartilhados (lock de OpenAPI, blocos de número de migration, dev stack). Autora
  os "chips" e adjudica paralelismo pela matriz de colisão.
- **CHIPS** (uma sessão Opus por milestone, em git worktree isolado): orquestram UM milestone
  fim-a-fim e falam com o hub SÓ por eventos: `CLOSED`, `BLOCKED`, `ESCALATION`, `REQUEST`,
  `SPLIT-REQUEST`, `ACK`.
- **Workers** (GPT via codex, subagents Claude): planejam, implementam, revisam, investigam —
  despachados pelo chip, nunca tocam infra compartilhada.

### O loop por milestone (P1–P8)

Board de tasks → plano em batch (GPT Sol medium) → implementação por slice com teste falhando
primeiro (GPT Luna high / Sol low) → revisão independente POR slice → escada de verificação
L0–L2 → **dual gate** (revisão Opus completa + revisão GPT Sol medium, no mesmo SHA fixo,
ambas limpas) → **QA de browser fresco** (só QA passa milestone) → `CLOSED` com evidência.
O hub então: aceita → merge `--no-ff` → escada pós-merge no master integrado → deploy → próximo
chip pelo DAG.

### Regras que não se negociam

Um escritor por seam compartilhado. OpenAPI + SDK no mesmo commit. Números de migration são
grants pré-alocados. Desconhecido ≠ zero (fail honest). Nunca: push sem permissão do operador,
reset/revert/stash/clean, ler `.env*`, instalar dependência como ritual. Checklist anti-slop
com REJECT automático (abstração especulativa, comentário narrando, try-catch cobertor em
leitura de integridade, test theater).

---

## Parte 3 — Painel Codex (os workers GPT)

Os workers de planejamento/implementação/investigação rodam no **Codex CLI** via plugin
`openai-codex`. Interface, na prática, são 5 comandos:

| Comando | Uso |
|---|---|
| `/codex:rescue --model <m> --effort <e> --wait <prompt>` | despachar QUALQUER trabalho GPT (o caminho padrão) |
| `/codex:status [job-id]` | ver jobs ativos/recentes |
| `/codex:result [job-id]` | saída final de um job terminado, verbatim |
| `/codex:cancel [job-id]` | cancelar job em background |
| `/codex:setup` | verificar/instalar CLI + auth (rodar 1× por máquina) |

### Matriz de papéis → flags (NUNCA digite de memória)

A skill `codex-dispatch` (no repo de produto: `.agents/skills/codex-dispatch/`) resolve:

| Papel | Invocação |
|---|---|
| Planejar feature | `--model gpt-5.6-sol --effort medium --wait` |
| Implementar (padrão) | `--model gpt-5.6-luna --effort high --wait` |
| Implementar (complexo: state machine, SQL difícil) | `--model gpt-5.6-sol --effort low --wait` |
| Investigar / leitura em massa | `--model gpt-5.6-luna --effort medium --wait` |
| Revisão do dual gate (lado GPT) | `--model gpt-5.6-sol --effort medium --wait` |

**Sempre passe `--effort` explícito**: o default global do codex é `xhigh` — esquecer a flag
não dá erro, só fica silenciosamente mais lento e mais caro.

### Os dois caminhos codex (stdin oposto!)

1. **`/codex:rescue`** — caminho padrão, via app-server JSON-RPC. Sem risco de travar em stdin.
2. **`codex exec` cru no shell** — SÓ para o probe de precondição do hub ou workers OS-process
   em background. Em shell não-tty ele **trava para sempre** esperando stdin fechar:
   PowerShell `@() | codex exec ...` · bash `codex exec ... < /dev/null`. Silêncio ≥2 min =
   é o travamento, mate e reemita.

---

## Contribuindo neste repo

- Editou `mnfs-plugin/`? **Sincronize para o cache** do Claude Code (ou reinstale) — o cache é
  derivado, este repo é a fonte.
- Editou um reference card compartilhado entre skills? Rode
  `mnfs-plugin/scripts/sync-shared-references.sh --check` (os cards são cópias byte-idênticas
  por design; o manifest lista os grupos).
- Melhorou a doutrina do harness? Aplique aqui E no `docs/superpowers/HARNESS.md` do(s) repo(s)
  de produto — os dois andam juntos.

## Histórico

- 2026-07-15: repo criado (fonte original do plugin perdida; reconstruído do cache vivo).
  Parallel-first planning adicionado (P5, Parallel Execution Plan, Ownership & Concurrency,
  rubrica ★3 com auditoria de disjunção em 6 eixos). Análise de sistema: 2 agents órfãos
  removidos, dedup comando↔skill, skill `codex-dispatch`, este README.
