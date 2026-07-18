# Product

## Register

product

## Users

Um operador (dono do harness) supervisionando uma frota de agentes de código IA em sessões longas, frequentemente à noite. Contexto: sala de controle pessoal — vários runs paralelos do conductor (Agent SDK), perguntas `ask_operator` chegando, missão/milestones em andamento. Job: saber em 3 segundos o que precisa dele AGORA, mergulhar num agente específico quando quiser, responder perguntas sem fricção, lançar novos runs.

## Product Purpose

Console de operação web ("mnfs deck") para o conductor: fleet view ao vivo dos agentes, transcript streaming por sessão (com subagents), fila de perguntas ask_operator respondível inline, board da missão/milestones, e lançamento de runs (repo picker + card). Consome a API do viewer do conductor (`/api/state`, `/api/answer`). Sucesso = o operador nunca mais precisa de N janelas de terminal para saber o estado da frota.

## Brand Personality

Vivo, operacional, confiável. HUD expressivo com disciplina de sala de transmissão: energia vem de cor-sinal comprometida e dados vivos, não de decoração. Metáfora-assinatura: **sala de transmissão/broadcast** — fleet como multiviewer de tiles iguais com borda-tally (vermelho = precisa do operador, verde = rodando, âmbar = atenção), strip fixo de missão no topo (relógio estilo MOCR/F1), board da missão como diagrama de blocos ferroviário (estado pintado no trilho).

## Anti-references

- Gradiente roxo/violeta "AI" em botões, texto, glows.
- Terminal-cosplay verde-fósforo (scanlines, glow-text, hacker skin).
- SaaS-cream minimal (fundos bege/creme, cards arredondados genéricos).
- FUI de filme: hexágonos, gauges radiais sem referente, data-rain, chrome sci-fi decorativo.
- Glassmorphism/blur decorativo como default.
- Trace-viewer post-hoc (LangSmith-like) como superfície principal: a UI é de operação ao vivo, forense é secundário.

## Design Principles

1. **Tally discipline** — cor de estado é a ÚNICA cor de estado; borda-tally no tile é o indicador, sem chrome extra. Vermelho é reservado para "precisa de você agora" e nunca decorativo.
2. **Shared truth strip** — como o MOCR: relógio da missão, contagem de perguntas pendentes e estado global sempre visíveis no topo, em qualquer tela.
3. **State lives on the object** — como painel CTC: estado pintado no próprio trilho/bloco/tile, não em legenda lateral.
4. **Solo sem reestruturar** — qualquer tile vai a fullscreen (solo) e volta sem mudar o layout do grid; o operador nunca perde o mapa mental.
5. **Ruído é um dial, não uma decisão** — transcript com toggle de densidade (Summary/Normal/Verbose) a um toque, tool-calls colapsados por padrão.

## Accessibility & Inclusion

WCAG AA: contraste ≥4.5:1 texto (≥3:1 large), estados de foco visíveis, navegação completa por teclado (incl. responder perguntas), `prefers-reduced-motion` respeitado em toda animação, cor nunca é o único canal de estado (tally sempre acompanhado de ícone/label).
