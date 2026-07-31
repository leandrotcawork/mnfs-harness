# F0 — Fundação: Micro-Design Detalhado

Data: 2026-07-31 · Status: 7/7 seções + emenda HITL aprovadas pelo operador em conversa · Pai: `2026-07-29-harness-0.5-execution-design.md` (spec de execução, 5 rodadas Sol) · Aguarda: pass GPT (construtivo + adversarial) → aprovação final → plano de implementação.

Escopo F0: ledger de eventos + projetor + FSM + schemas + replay + drills + release atômico + migração. NADA de roteador (F1), pack (F2), gates (F3), coordenador (F4).

---

## 1. Catálogo de eventos + schema

`schemas/event.schema.json`:

```json
{
  "seq": 42,
  "ts": "2026-07-29T21:04:11.123Z",
  "type": "FEATURE_DISPATCHED",
  "scope": {"mission": "MIS-010", "milestone": "M01", "feature": "F02"},
  "actor": "hub:9a5801e2",
  "attempt": 1,
  "idempotency_key": "F02-a1-dispatch",
  "deadline": "2026-07-29T21:34:11Z",
  "payload": {},
  "prev_hash": "9c1d…",
  "hash": "e07a…",
  "harness_version": "0.5.0"
}
```

- `seq` denso sem buraco; `hash` = sha256(canonical(evento sem hash)); cadeia via `prev_hash`.
- `deadline` OBRIGATÓRIO quando o evento cria estado não-terminal (regra geral de expiração).
- `payload` por-tipo com sub-schema, ≤1 KB; conteúdo grande em `.mnfs/*/` hashado.
- Catálogo FECHADO (19 tipos) — tipo desconhecido rejeitado por emit E projetor; tipo novo = versão nova:
  - Planejamento: `MISSION_OPENED` · `FEATURE_PLANNED`
  - Dispatch: `FEATURE_DISPATCHED` · `BOOT_ACKED` · `DISPATCH_FAILED`
  - Execução: `CLAIM_RECORDED` · `LATE_ARRIVAL`
  - Gates: `GATE_RESULT` · `RECEIPT_RECORDED`
  - Integração: `LEASE_GRANTED` · `MERGE_COMMITTED` · `REBASE_REQUIRED`
  - Desvio: `BLOCKED` · `REPLAN_ORDERED`
  - HITL: `DECISION_REQUESTED` · `DECISION_RECORDED`
  - Fechamento: `FEATURE_CLOSED` · `MILESTONE_CLOSED` · `MISSION_CLOSED`
- `BLOCKED`/`REPLAN_ORDERED` genéricos com `reason` no payload (anti-explosão de tipos).

## 2. Protocolo de escrita do ledger

Escritor único: `runtime/emit.mjs`, invocado por (a) cartão/skill via Bash no hub, (b) hooks (stdin JSON → mesmo módulo). Processos Node distintos podem colidir →

1. **Lock `mkdir` atômico** (NTFS-safe, zero dependência): `.mnfs/.lock/` via mkdir (EEXIST = ocupado); dono grava `.lock/owner.json {pid, ts}`; retry 50ms×40 (2s); stale = SÓ pid comprovadamente morto → roubo logado (ver E2); dono vivo lento = erro nomeado `LOCK_HELD`, nunca remoção por idade.
2. **Append durável** (dentro do lock): validar tail → seq/prev_hash do último → `appendFileSync` linha JSONL + `fsync` → liberar. Linha <1 KB = 1 write.
3. **Reparo de tail**: última linha com JSON truncado OU hash que não fecha → truncar SÓ ela (fsync não completou = evento nunca aceito), log `repair` em stderr. Linha com hash válido NUNCA truncada.
4. **Idempotência**: `idempotency_key` duplicada dentro do lock → no-op com sucesso.

Conformidade Claude Code: hook timeout default 60s; orçamento emit+project delta <200ms (KAT falha >1s); `.mnfs/` resolvido por `CLAUDE_PROJECT_DIR`; exit codes — hooks de OBSERVAÇÃO falham abertos com log, só hooks de GATE usam exit 2.

## 3. Tabela FSM

Estados de feature (8): `PLANNED · DISPATCHED · IMPLEMENTING · IN-REVIEW · INTEGRATING · CLOSED · BLOCKED · FAILED` (REPLAN = volta a PLANNED com attempt+1).

Fonte única: `runtime/fsm.mjs` exporta a tabela como dado; projetor valida; cartões/status derivam legenda dela.

| De | Evento | Para | Deadline criado | Protegida |
|---|---|---|---|---|
| — | FEATURE_PLANNED | PLANNED | não | não |
| PLANNED | FEATURE_DISPATCHED | DISPATCHED | boot_ack_timeout | não |
| DISPATCHED | BOOT_ACKED | IMPLEMENTING | impl_timeout | não |
| DISPATCHED | DISPATCH_FAILED | FAILED | — | não |
| IMPLEMENTING | CLAIM_RECORDED | IN-REVIEW | review_timeout | não |
| IMPLEMENTING | DISPATCH_FAILED (timeout) | FAILED | — | não |
| FAILED | LATE_ARRIVAL(.ack) | IMPLEMENTING | herda original | não |
| FAILED | LATE_ARRIVAL(.claim validado) | IN-REVIEW | herda original | não |
| FAILED | FEATURE_DISPATCHED (attempt+1) | DISPATCHED | novo | não |
| IN-REVIEW | GATE_RESULT(accept) | INTEGRATING | integrate_timeout | **SIM** |
| IN-REVIEW | GATE_RESULT(reject) | FAILED | — | não |
| INTEGRATING | MERGE_COMMITTED | CLOSED | — | **SIM** |
| INTEGRATING | REBASE_REQUIRED | IN-REVIEW | review_timeout | não |
| não-terminal | BLOCKED | BLOCKED | não (relógio para) | não |
| BLOCKED | DECISION_RECORDED / REPLAN_ORDERED | estado anterior restaurado / PLANNED (attempt+1) | restaura / não | não |

Regras duras:
- 2ª FAILED com mesma assinatura de defeito → única transição aceita é REPLAN_ORDERED (projetor rejeita 3º dispatch idêntico — anti-doom-loop compilado).
- LATE_ARRIVAL com attempt < atual = registrado, estado inalterado (supersedido).
- Transições PROTEGIDAS (2): entrar em INTEGRATING e CLOSED — só elas têm hook fail-closed (exit 2). Resto falha aberto com log. Break-glass: `OPERATOR_OVERRIDE` via `/harness override`, sempre no ledger. (Nota: OPERATOR_OVERRIDE entra no catálogo como 20º tipo.)
- Agregação derivada (sem evento de estado próprio): milestone = min das features; qualquer BLOCKED propaga; todas CLOSED + GATE_RESULT(M) accept → MILESTONE_CLOSED. Missão idem.
- Deadlines iniciais em routing.json: boot_ack 10min · impl 4h · review 2h · integrate 30min — chutes declarados, F5 calibra.

## 4. Projetor + checkpoint atômico

`state.json` (cursor embutido — emenda A2 do spec pai):

```json
{
  "schema_version": "0.5.0",
  "cursor": {"seq": 42, "event_hash": "e07a…"},
  "state_hash": "b91c…",
  "mission": {"id": "MIS-010", "status": "OPEN"},
  "milestones": {"M01": {"status": "OPEN"}},
  "features": {"F02": {"status": "IMPLEMENTING", "attempt": 1, "deadline": "…",
    "session": "local_…", "manifest_hash": "ab3f…", "defect_signatures": []}}
}
```

- Escrita: dentro do MESMO lock do ledger (1 lock só) → tmp + fsync + `renameSync` (same-volume NTFS = atômico; tmp dentro de `.mnfs/`).
- Leitura: TODO consumidor valida `state_hash` recomputado + `cursor.event_hash` confere no ledger. Desvio → REBUILD TOTAL (nunca conserto incremental, nunca consumo silencioso de estado inválido).
- Incremental, rebuild e replay = MESMA função (muda ponto de partida). `replay --at-event N` = projeção 0→N em memória, compara state_hash, read-only.
- `/harness status` lê SÓ o checkpoint validado via state-view (leitor único do ledger = projetor).
- Leitores read-only (outra sessão, viewer) leem checkpoint SEM lock — rename atômico garante versão íntegra.

## 5. Replay + catálogo de drills/KATs

Estrutura vitest: `emit.test.mjs` · `fsm.test.mjs` · `project.test.mjs` · `drills/catalog.json` + `drill.test.mjs`.

Catálogo versionado, cada entrada `{id, inject, expect}`; TODA falha termina em bloqueio determinístico com erro NOMEADO (nunca crash genérico, nunca silêncio). Drills rodam em tmpdir isolado; guard impede tocar `.mnfs/` real.

| id | Injeção | Exigido |
|---|---|---|
| D1 | seq fora de ordem | emit rejeita, ledger intacto |
| D2 | idempotency_key duplicada | no-op, 1 evento |
| D3 | prev_hash adulterado no meio | project para em erro nomeado, não projeta além |
| D4 | tail truncado no byte N | repair remove só a última; anteriores intactas |
| D5 | state.json com byte flipado | leitura detecta → rebuild |
| D6 | cursor.seq além do log | rebuild, sem crash |
| D7 | tipo de evento desconhecido | emit E project rejeitam |
| D8 | payload 2 KB | emit rejeita |
| D9 | lock stale (pid morto) | roubo com log; dono vivo → LOCK_HELD |

KATs adicionais: emit concorrente ×2 processos reais (spawn, cenário hub+hook) · crash pós-write pré-fsync · property com seed: incremental == rebuild (state_hash idêntico) · 10k eventos <200ms · interleaving A3 (ACK/CLAIM entre dreno e expiração, com/sem re-dispatch) · ack tardio + worker morto → FAILED/REPLAN no mesmo toque · transição ilegal · 3º dispatch idêntico rejeitado · agregação com BLOCKED · override auditado.

`npm test` = gate de release do plugin.

## 6. Schemas restantes

Validação: **ajv** (única dependência de runtime do core), compilado no load. Regra: artefato inválido não circula — rejeição na borda com erro nomeado por campo.

- `manifest.schema.json` (valida: dispatch-lint hook + worker no BOOT-ACK): `{manifest_version, dispatch_id, attempt, feature, scope, base_sha, pack_hash, pack_path, pack_generated_at, pack_ttl_min, gates[], seats[], risk, budget{tokens_reserved}, deadline_boot_ack}`.
- `claim.schema.json` (worker escreve; hub valida no dreno antes de CLAIM_RECORDED): `{dispatch_id, tree_hash, criteria[{id, status, command, evidence_path}], files_touched[], written_at}`. `files_touched` fora da zona do pack = rejeitado na borda.
- `receipt.schema.json` (só runner escreve; merge-gate valida): `{claim_ref, tree_hash, worktree, runs[{criterion, command, exit_code, output_hash, duration_ms}], runner_version, verdict}`.
- `state-view.schema.json` (read-only p/ status + viewer futuro): por entidade `{status, attempt, deadline, blocker_reason, last_transition, freshness}` — sem payloads, sem caminhos internos. Inclui seção `awaiting_operator: [D-001…]`.
- `telemetry.schema.json` (gêmeo por transição, emitido pelo runtime): `{event_seq, dispatch_id, phase, tokens{in,out,cache_read}, cost_usd, duration_ms, coverage: complete|partial}`. Partial nunca calibra política.
- `decision.schema.json` (HITL): `{decision_id, level: 1|2|3, question, context_refs[], options[{id, summary, impact}], recommendation, blocks[], status: open|decided, choice, decided_by, decided_at}` — materializado em `.mnfs/decisions/D-xxx.md` com frontmatter validado.
- `pricing.json`: modelo→preço/Mtok com effective_date; modelo desconhecido → cost_usd null (degrade, não chute).

Schemas empacotados NO plugin (versão do plugin = versão dos schemas).

## 7. HITL — escalação tipada (emenda aprovada)

| Nível | Classe | Decide | Registro |
|---|---|---|---|
| 1 | Detalhe de execução dentro da zona | Worker | nota no claim |
| 2 | Trade-off dentro do escopo da missão | Hub | DECISION_RECORDED {by: hub} |
| 3 | Escopo/contrato/produto/budget/risco | OPERADOR | DECISION_REQUESTED → DECISION_RECORDED {by: operator} |

- Regra dura: mudar contrato, critério de aceitação, budget ou fronteira de feature = nível 3 SEMPRE. Worker nunca fala com operador direto — escala ao hub; hub triageia.
- `DECISION_REQUESTED {decision_id, level, question_ref, blocks[]}` → features afetadas BLOCKED (relógio parado; reconcile não expira); tracks não-afetadas continuam.
- Operador presente: AskUserQuestion no hub, resposta vira DECISION_RECORDED imediato. Ausente: `/harness status` mostra `⏸ AGUARDANDO OPERADOR`. Brainstorm grande: decisão aponta sessão dedicada; resultado vira a decisão registrada (exceção deliberada, não default).
- Decisões no ledger são citáveis por packs futuros ("D-001 decidiu X; não re-litigar").

## 8. Release atômico + migração 0.4→0.5

Release:
- Plugin semver; `harness_version` em plugin.json E em todo evento emitido (replay sabe qual versão interpretava cada trecho).
- Gate de release: `npm test` verde + `runtime/selfcheck.mjs` (ajv compila schemas, routing.json válido, tabela FSM íntegra, versões batem) + entrada no HARNESS-CHANGELOG. Vermelho = não versiona.
- Selfcheck também no SessionStart, SEM cache: roda inteiro toda sessão (~100ms com ajv). Cache + chave de invalidação = problema novo para economizar nada (reconsideração 2026-07-31).
- Schema de evento: mudanças aditivas dentro de 0.5.x; breaking = 0.6.

Migração — **quiesce-and-cutover** (reconsideração 2026-07-31; substitui DUAL-READ/conversor/journal):
- Pré-condição: trabalho em voo 0.4 TERMINA no 0.4 antes da troca (1 operador controla os 2 repos — fechar a missão corrente é barato). Sem conversão de estado em voo, sem meio-a-meio.
- Sequência: (1) quiesce (nenhuma missão aberta) → (2) backup enumerado `.mnfs-backup-<ts>/` (`.mnfs/` + seção hooks do settings + HARNESS-PROFILE) → (3) swap de plugin/settings (mecanismo nativo) → (4) ledger 0.5 nasce ZERADO com `MISSION_OPENED`-gênese cujo payload aponta artefatos 0.4 como leitura histórica (paths, read-only).
- Rollback = restaurar backup + reativar 0.4. Um passo, determinístico, coberto por drill.
- Piloto: mnfs-harness; marketplace-central só migra após piloto operar 0.5 de ponta a ponta.
- O que foi cortado e por quê: DUAL-READ/shadow-ledger/comparação/journal de conversão eram maquinário para migrar SEM parar — luxo que 1 op/1 máquina não precisa; quiesce elimina a classe inteira de estados intermediários.

## 9. Emendas — rodada Sol F0-1 (2026-07-31) + reconsideração anti-over-engineering (aprovada pelo operador 2026-07-31)

Filtro: solução mais simples que fecha; sem daemon/DB/crypto. Teste da reconsideração aplicado item a item: "se cortar, qual resultado de missão piora?" Cortados = nenhum piora. Mantidos = falso verde, status mentiroso ou veredicto errado.

**E1 Canonicalização MÍNIMA (simplificada na reconsideração).** `canonical()` = `JSON.stringify` com chaves ordenadas recursivamente (~10 ln). Só o runtime escreve e só o runtime lê — regras de unicode/float/null e vetores KAT byte-exatos eram cerimônia cross-runtime que não existe aqui; cortadas. `hash` = sha256 dos bytes canônicos do evento sem `hash`; `prev_hash` INCLUÍDO no preimage (cadeia fica: custa 2 linhas e pega edição manual do ledger — ameaça real: worker confuso com Write tool). MESMA função para `state_hash`. Verificação: property test escreve→lê→confere, sem vetores fixos.

**E2 Lock sem roubo por idade (fecha crítico dono-vivo).** Roubo APENAS com PID comprovadamente morto (process check). Sequência de roubo serializada por steal-mutex (`.mnfs/.lock-steal/` mkdir) → recheca morte → rmdir+mkdir do lock principal → libera steal-mutex. Owner token imutável em `owner.json {token, pid, acquired_at}`; escritor REVALIDA token imediatamente antes do append e da publicação do checkpoint (re-read + compare). Dono vivo lento = contender retorna erro nomeado `LOCK_HELD` → surfaced como pendência HITL, nunca remoção. KATs: dono vivo pausado >30s + 2 emitters; double-steal com 2 contenders.

**E3 Durabilidade Windows declarada (fecha fsync/NTFS).** Append: open fd → write → `fs.fsyncSync(fd)` → close, erro tratado. Checkpoint: fsync do tmp ANTES do rename. LIMITE DECLARADO: durabilidade de metadata de diretório pós-power-loss não é garantida pelo Node/NTFS — rename do checkpoint pode regredir; recovery já cobre (ledger autoritativo + rebuild; tail repair no ledger). Drills simulam torn states; power-loss real fora de alcance de teste, coberto por design (nada depende do checkpoint sobreviver).

**E4 BLOCKED com snapshot de retorno (fecha restauração não-replayável).** Payload de `BLOCKED` EXIGE `{previous_status, remaining_deadline_ms, lease_ref?}` — validado por sub-schema; projetor rejeita BLOCKED sem snapshot. Desbloqueio (`DECISION_RECORDED`/`REPLAN_ORDERED` restaurador) repõe `previous_status` com `deadline = ts_do_desbloqueio + remaining_deadline_ms`. BLOCKED durante INTEGRATING REVOGA o lease (payload registra; retomada re-solicita lease). Replay 100% do log. Decisões nível 3 (operador) SEM TTL — humano soberano; status mostra idade (refutado DECISION_EXPIRED).

**E5 Contrato durável ACK/CLAIM no F0 (fecha A3-A5 ausentes).** Paths: `.mnfs/acks/<dispatch_id>-a<attempt>.ack` · `.mnfs/claims/<dispatch_id>-a<attempt>.json`. Worker grava artefato ANTES de notificar. `attempt` passa a ser campo OBRIGATÓRIO em manifest, ack, claim e evento (corrige claim.schema §6). Reconcile sob o lock único, ordem fixa: drenar disco → revalidar artefato do attempt no instante da decisão → expirar → compensar (LATE_ARRIVAL por tipo). Interleavings da Seção 5 viram drills nomeados deste protocolo.

**E6 Sandbox de drill simples (simplificada na reconsideração).** Executor de drill cria tmpdir próprio e passa o root EXPLICITAMENTE a todo helper mutador (nunca herdado de CLAUDE_PROJECT_DIR); helper exige prefixo sob esse root. KAT: drill apontado para repo real → recusa nomeada. Cortado: nonce, realpath, defesa contra symlink/junction — ninguém ataca a própria máquina; o risco real (env herdado apontando pro repo) o prefix-check explícito já fecha.

**E7 Agregação total (fecha FAILED indefinido).** Ordem de severidade: `BLOCKED > FAILED > INTEGRATING > IN-REVIEW > IMPLEMENTING > DISPATCHED > PLANNED > CLOSED`. Milestone/missão = pior estado entre filhas + `{worst_feature, reason}` no state-view. MILESTONE_CLOSED exige todas CLOSED + GATE_RESULT(M) accept (inalterado). KATs: CLOSED+FAILED, FAILED+BLOCKED, retry pós-FAILED.

**E8 CORTADA na reconsideração — selfcheck sem cache.** Cache + chave de invalidação = problema novo para economizar ~100ms por sessão. Selfcheck roda inteiro a cada SessionStart. Hooks de transição PROTEGIDA continuam fail-closed se selfcheck da sessão falhou (isso fica; o CACHE morre).

**E9+E10 CORTADAS na reconsideração — migração vira quiesce-and-cutover (§8).** DUAL-READ, shadow-ledger, conversor 0.4→0.5, journal de conversão e comparação em checkpoints eram maquinário para migrar SEM parar o trabalho. 1 operador pode simplesmente terminar a missão em voo no 0.4 e trocar com tudo quiesce. Achados do Sol (fonte do DUAL-READ indefinida, tabela de conversão ausente, crash entre fronteiras) morrem por eliminação da classe: não há estado intermediário para corromper. Fica: backup enumerado + rollback de um passo + drill.

**REFUTADO — registry histórico de FSM/schemas por versão.** Dentro de 0.5.x mudanças são ADITIVAS: o interpretador corrente lê todos os eventos 0.5.x (KAT: log 0.5.0 lido por runtime 0.5.1). Breaking = 0.6 com re-baseline: ledger novo, antigo arquivado com estado final consolidado como evento-gênese. Sem museu de interpretadores.

## Fora de escopo F0 (para constar)

Roteador/cartões (F1) · pack.mjs (F2) · receipt runner e risk resolver (F3) · CAS/lease (F4) · calibração/deck (F5). F0 entrega o esqueleto andante: evento real gravado → projetado → replayado → hook lendo state.json no próprio mnfs-harness.
