# mnfs deck — hi-fi design spec (contrato de build)

Fonte de verdade visual: `scratchpad/deck-wireframe.html` (v2 chat-first, aprovado pelo operador)
+ PRODUCT.md (register: product; metáfora: sala de transmissão/broadcast).
Amendment ratificado: **um hub por missão** (hub ↔ missão 1:1; não existe hub global).

## 0. Stack & estrutura

- Vite + React 18, JavaScript (JSX, sem TypeScript — consistente com o repo .mjs).
- Pasta `conductor/ui/` — `npm create vite` shape: `index.html`, `src/main.jsx`, `src/App.jsx`,
  `src/styles/tokens.css`, `src/styles/base.css`, componentes em `src/components/`, dados em `src/lib/`.
- Zero UI framework (nada de Tailwind/MUI). CSS puro com custom properties (tokens abaixo).
  CSS Modules NÃO — usar arquivos .css por componente com classes prefixadas (`.deck-`, `.thread-`, etc.).
- Fontes via npm: `@fontsource/ibm-plex-sans` (400, 500, 600, 700) + `@fontsource/ibm-plex-mono`
  (400, 500, 600). `font-display: swap` já é default do fontsource.
- Dev proxy: `vite.config.js` com `server.proxy = { '/api': 'http://127.0.0.1:4317' }`.
- Build output: `conductor/ui/dist` (servido pelo viewer em produção).

## 1. Tokens (OKLCH, tema único dark operacional — decisão de registro, não omissão)

Cena física: operador sozinho, madrugada, sala escura, múltiplos monitores — dark é imposição
da cena, não estética. Sem tema claro no v1.

```css
:root {
  /* ground */
  --bg: oklch(0.165 0.012 230);          /* near-black azulado frio */
  --surface: oklch(0.205 0.014 230);     /* painéis, sidebar */
  --raised: oklch(0.245 0.016 230);      /* cards de mensagem, hover */
  --line: oklch(0.32 0.018 230);         /* bordas 1px */
  /* ink */
  --ink: oklch(0.93 0.006 210);          /* texto primário  (AA sobre bg/surface) */
  --ink-muted: oklch(0.72 0.014 210);    /* secundário (≥4.5:1 sobre surface) */
  --ink-faint: oklch(0.56 0.014 210);    /* SÓ large/bold ou decorativo */
  /* brand (interação, seleção, links, foco) — NUNCA estado */
  --brand: oklch(0.78 0.10 200);
  --brand-ink: oklch(0.17 0.02 200);     /* texto sobre brand */
  --brand-dim: oklch(0.60 0.08 200);
  /* tally — ÚNICAS cores de estado (tally discipline) */
  --tally-red: oklch(0.62 0.21 25);      /* precisa do operador AGORA */
  --tally-green: oklch(0.70 0.15 150);   /* rodando saudável */
  --tally-amber: oklch(0.79 0.13 80);    /* atenção / investigate / parked-other */
  --tally-off: oklch(0.42 0.012 230);    /* terminal (completed/cancelled) */
  /* type */
  --font-ui: 'IBM Plex Sans', system-ui, sans-serif;
  --font-data: 'IBM Plex Mono', ui-monospace, monospace;
  /* scale 1.2 fixa rem: 12 / 13 / 16 / 19 / 23 */
  --text-caption: 0.75rem; --text-secondary: 0.8125rem; --text-body: 1rem;
  --text-sub: 1.1875rem; --text-heading: 1.4375rem;
  /* space 4pt */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 24px; --s-6: 32px; --s-7: 48px;
  --radius: 6px; --radius-lg: 10px;
  /* z scale semântico */
  --z-sticky: 10; --z-overlay: 20; --z-modal: 30; --z-toast: 40;
}
```

Regras de cor:
- Vermelho tally NUNCA decorativo; aparece só quando um run está `waiting_operator`.
- Brand cyan carrega interação (foco, seleção, botões, links); nunca codifica estado de run.
- Estado nunca só por cor: tally sempre com label/ícone junto (WCAG).
- Texto de dado (ids, custos, MET, telemetria, estados) = `--font-data` com `tabular-nums`.

## 2. Shell (grid areas)

```
"strip strip strip"   48px
"tree  thread ctx"    1fr
colunas: 264px 1fr 320px
```

- **Truth strip** (topo, fixo, `--z-sticky`): esquerda logo `mnfs deck` + nome da missão;
  centro MET (mission elapsed time `T+ HH:MM:SS`, mono, ticka 1s — derivado do started
  mais antigo do estado; se sem runs, `T+ --:--:--`); direita: badge de perguntas pendentes
  (fundo `--tally-red`, texto branco, `N pergunta(s)` — clicável, pula pra primeira),
  contagem de runs por estado (`2 run · 1 wait`), botão overview (ícone grade, atalho `O`).
- **Tree** (sidebar): árvore de conversas da missão. Raiz = `HUB · <missão>` (um por missão),
  filhos = milestones (se houver dados de missão) e runs (agrupados por feature).
  Cada nó: dot tally 8px + nome + meta mono (role, custo). Nó ativo: fundo `--raised` +
  barra 2px `--brand` à esquerda do texto (indicador de seleção, não de estado).
  Botão `+ nova run` no rodapé da tree (abre launch flow).
- **Thread** (centro): a conversa selecionada (ver §3). Composer SEMPRE presente na base.
- **Ctx** (direita): painel de contexto por tipo de thread (ver §4). Colapsável (atalho `]`).
- Responsivo: <1100px ctx vira drawer overlay; <780px tree vira drawer; thread nunca some.

## 3. Threads (chat-first)

Toda superfície é uma conversa. Tipos:

### 3.1 Run thread (fase A — 100% real)
- Mensagens do transcript da sessão (viewer `/api/state` → `runs[].transcripts[].messages`).
  Formato SDK: entradas com `type` (`assistant`/`user`/`system`/`result`) e
  `message.content` array (`text`, `tool_use`, `tool_result`, `thinking`). Render:
  - `text` → bolha de markdown-lite (parágrafos + `code` inline + fenced code; sem lib pesada,
    parser mínimo próprio ou `marked` se necessário — preferir mínimo próprio).
  - `tool_use` → linha colapsada: chevron + nome da tool (mono) + resumo do input (1 linha,
    truncado); expande pra JSON pretty. Colapsado por default (ruído é um dial).
  - `tool_result` → anexado ao tool_use correspondente (match por tool_use_id) quando expandido.
  - `thinking` → só no modo Verbose, estilo faint itálico.
  - subagents (`transcripts[].subagents[]`) → card "subagent <agentId>" colapsado; expande
    inline mostrando as mensagens do subagent com indentação + borda `--line`.
- **ask_operator = mensagem destacada**: card com borda 2px `--tally-red`, label
  `PERGUNTA AO OPERADOR`, texto da pergunta, contexto (colapsável), e se houver `options`,
  chips clicáveis que preenchem o composer. Depois de respondida: borda vira `--tally-off`,
  mostra a resposta do operador como mensagem do operador (alinhada à direita, fundo
  `--raised`, borda esquerda... NÃO — sem side-stripe: fundo `--raised` + label `OPERADOR`).
- **Density dial** no header do thread: `Sum / Norm / Verb` (segmented control).
  Sum = só texto do assistant + perguntas + resultado; Norm = + tool_use colapsados;
  Verb = + thinking + tool_results expandíveis. Persistir em localStorage.
- **Composer**: textarea auto-grow + botão enviar (`Ctrl+Enter`).
  - Run `waiting_operator` com pergunta pendente → composer ativo, placeholder
    "Responder pergunta do agente…", enviar = `POST /api/answer` e em seguida
    `POST /api/resume` (fase B). Feedback: mensagem do operador aparece otimista no thread
    com estado `enviando…` até o próximo poll confirmar.
  - Run `running` → composer desabilitado com label honesto
    "Mensagem em sessão viva chega na fase C" (sem controle fake).
  - Run terminal → composer desabilitado, label "Run encerrada — <estado>".
- Header do thread: nome (feature), estado (label mono + dot tally), runId curto, role,
  modelo, custo acumulado, botão "solo" (fullscreen do thread, ESC volta — solo sem
  reestruturar).

### 3.2 Hub thread (um por missão)
- Fase A: hub renderiza como feed de eventos da missão derivado do estado (runs criadas,
  perguntas, terminais) — cards de evento com link pro thread filho. Composer desabilitado
  com label "Conversar com o hub chega na fase C". SEM mensagens fake.
- Ctx do hub: mini-multiviewer (grade de tiles pequenos, 1 por run, borda tally),
  custo total da missão, fila de decisões (perguntas pendentes → link).

### 3.3 Milestone thread
- Só aparece se `/api/mission` retornar dados (arquivo `mission.json` opcional no state dir).
  Sem dados → nós de milestone não aparecem na tree (nada de placeholder morto).

### 3.4 Overview (multiviewer wall)
- Tela cheia (rota `/overview`, atalho `O`, ESC volta): grade responsiva
  `repeat(auto-fit, minmax(280px, 1fr))` de tiles IGUAIS, um por run.
  Tile: borda 2px tally, header (feature + estado label), última mensagem de texto
  (2 linhas clamp), meta mono (custo, role, tempo desde último evento).
  Clique = vai pro thread. Sem composer aqui.
- Tile `waiting_operator`: pergunta em destaque no corpo do tile + botão "responder".

### 3.5 Launch as conversation
- `+ nova run` abre thread de lançamento: form conversacional em passos no corpo do thread
  (não modal): (1) repo/worktree — input path + `GET /api/repos` se disponível, senão input
  livre; (2) role — select de roles.json via `/api/roles` (fase B) ou input livre;
  (3) modelo + budget; (4) instructions (textarea). Preview do card.json montado (mono,
  editável como JSON cru com validação de parse). Botão `Dispatch` → `POST /api/launch`.
  Erros do endpoint aparecem como mensagem no thread.

## 4. Painéis de contexto (ctx)

- Run: telemetria (turns, custo, denials count), ledger events (lista mono compacta,
  timestamps relativos), fingerprint status, botão resume (se parked e sem pergunta).
- Hub: mini-multiviewer + custo missão + fila de decisões.
- Milestone: board CTC (SVG blocos ligados por trilho, estado pintado no trilho) — só com
  dados reais de mission.json.

## 5. Dados (src/lib/api.js + src/lib/model.js)

- Poll `GET /api/state` a cada 2s (`setInterval` + `visibilitychange` pausa quando hidden).
  Header `x-conductor: 1` em todos os requests.
- `model.js` normaliza: runs → threads; deriva dot tally
  (`waiting_operator`→red, `running`/`started`→green, `investigate`/`parked*`→amber,
  terminal→off); extrai perguntas pendentes; monta feed do hub; calcula MET.
- Diff mínimo por render: manter referência estável por runId; virtualização só se
  mensagens > 200 (senão render direto — não engenheirar).
- Falha de poll: banner fino no topo do thread `viewer offline — tentando reconectar`
  (amber), dados antigos continuam visíveis (shared truth degrada com honestidade).

## 6. Motion

- Tally transition: `border-color 240ms cubic-bezier(0.22, 1, 0.36, 1)`.
- Nova mensagem: fade+rise 6px 180ms ease-out (conteúdo visível por default — animação
  aplicada via animation, não gated por classe de reveal).
- Pergunta nova chegando: pulse único da borda red (2 ciclos, para) + badge do strip anima.
- `prefers-reduced-motion: reduce` → tudo vira transição instantânea/crossfade.

## 7. A11y

- Foco visível: outline 2px `--brand` offset 2px, global.
- Navegação teclado: tree = listbox com setas; `O` overview; `ESC` fecha solo/overview;
  `Ctrl+Enter` envia; `[`/`]` toggles drawers; atalhos documentados em tooltip do strip.
- Live region (`aria-live="polite"`) anuncia novas perguntas pendentes.
- Contraste: verificar `--ink-muted` sobre `--surface` ≥4.5:1 (ajustar L se preciso).

## 8. Fase B — endpoints novos no viewer (código core, com testes)

Guardas iguais aos existentes (localhost origin + header `x-conductor`):
- `POST /api/resume` `{runId}` → spawna `node bin/conductor.mjs resume --state <dir> <runId>`
  detached (stdio ignore, unref), responde `{ok:true}` imediato. 404 se runId desconhecido,
  409 se estado não é parked/waiting.
- `POST /api/launch` `{card}` → valida shape mínimo (worktree string), escreve card em
  `<state>/cards/<uuid>.json` (atomicWriteJson), spawna
  `node bin/conductor.mjs run --card <path> --state <dir>` detached, responde `{ok:true, cardPath}`.
- `GET /api/roles` → conteúdo de roles.json (nomes + models) se existir.
- `GET /api/mission` → `<state>/mission.json` se existir, senão 404.
- Servir estático: `GET /` e assets de `conductor/ui/dist` se a pasta existir (fallback pra
  página atual do viewer se não). Content-Type correto, sem directory traversal
  (normalizar + prefixo check).

## 9. Anti-slop (bans ativos)

Sem side-stripes coloridos >1px como accent (tally é BORDA COMPLETA do card/tile),
sem gradiente em texto, sem glassmorphism, sem eyebrow uppercase em toda seção, sem
card-grid idêntico fora do multiviewer (lá a igualdade É a semântica de broadcast),
sem verde-fósforo terminal, sem roxo AI, sem hexágonos/FUI.
