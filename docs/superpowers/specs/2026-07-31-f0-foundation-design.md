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

1. **Lock `mkdir` atômico** (NTFS-safe, zero dependência): `.mnfs/.lock/` via mkdir (EEXIST = ocupado); dono grava `.lock/owner.json {pid, ts}`; retry 50ms×40 (2s); stale = pid morto OU ts>30s → roubo logado.
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
| D9 | lock stale (pid morto) | roubo após 30s com log |

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
- Selfcheck também no SessionStart (cacheado): bundle incompleto detectado antes de qualquer dispatch.
- Schema de evento: mudanças aditivas dentro de 0.5.x; breaking = 0.6.

Migração:
- Estados `LEGACY → MIGRATING → DUAL-READ → CUTOVER` (+`ROLLED-BACK`) em `.mnfs/migration.json` por repo.
- Trabalho em voo 0.4: termina no 0.4 OU re-validado (manifests re-emitidos como eventos 0.5 via `harness-migrate`, actor "migration"). Nunca meio-a-meio.
- DUAL-READ: hooks 0.5 só observam (log, sem exit 2) enquanto 0.4 decide; divergência = bug report. CUTOVER: 0.5 decide, hooks 0.4 removidos do settings (cutover físico = mecanismo nativo de plugin/settings).
- Backup `.mnfs-backup-<ts>/` antes de escrever; ROLLED-BACK = restaurar + reativar 0.4 (procedimento coberto por drill).
- Piloto de migração: mnfs-harness; marketplace-central só após CUTOVER provado.

## Fora de escopo F0 (para constar)

Roteador/cartões (F1) · pack.mjs (F2) · receipt runner e risk resolver (F3) · CAS/lease (F4) · calibração/deck (F5). F0 entrega o esqueleto andante: evento real gravado → projetado → replayado → hook lendo state.json no próprio mnfs-harness.
