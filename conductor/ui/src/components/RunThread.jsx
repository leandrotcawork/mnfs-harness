import { useMemo, useRef, useEffect, useState } from 'react';
import TallyDot from './TallyDot.jsx';
import DensityDial from './DensityDial.jsx';
import TranscriptItem from './TranscriptItem.jsx';
import SubagentBlock from './SubagentBlock.jsx';
import Composer from './Composer.jsx';
import { isTerminal } from '../lib/model.js';

const RUN_DISABLED_LABEL = {
  running: 'Mensagem em sessão viva chega na fase C',
};

export default function RunThread({
  run,
  density,
  onDensityChange,
  onAnswer,
  optimisticByQuestion,
  resumeState,
  isSolo,
  onToggleSolo,
}) {
  const bottomRef = useRef(null);
  const messageCount = useMemo(
    () => run.transcripts.reduce((n, t) => n + t.items.filter((i) => i.kind === 'text').length, 0),
    [run]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [run.runId, run.transcripts]);

  const pendingQuestion = run.pendingQuestions[0] ?? null;
  const hasWaitingState = run.state === 'waiting_operator';

  let composerMode = 'disabled';
  let disabledLabel = 'Run encerrada — sem estado';
  if (hasWaitingState && pendingQuestion) {
    composerMode = 'answer';
  } else if (hasWaitingState && !pendingQuestion) {
    disabledLabel = 'Aguardando operador — pergunta ainda não sincronizada';
  } else if (isTerminal(run.state)) {
    disabledLabel = `Run encerrada — ${run.state}`;
  } else if (run.state === 'started' || run.state === 'resumed') {
    disabledLabel = 'Mensagem em sessão viva chega na fase C';
  } else if (run.state === 'investigate') {
    disabledLabel = 'Run em investigação — sem canal de mensagem em fase A';
  } else {
    disabledLabel = 'Sem estado conhecido para esta run';
  }

  const optimistic = pendingQuestion ? optimisticByQuestion?.[pendingQuestion.questionId] : null;

  // Option chips on an ask_operator card fill the composer (DESIGN-DECK §3.1) — they never
  // send on their own; the operator still confirms with Ctrl+Enter / the send button.
  const [draft, setDraft] = useState('');
  useEffect(() => {
    setDraft('');
  }, [run.runId]);
  const fillComposer = (text) => setDraft(text);

  return (
    <section className={`run-thread${isSolo ? ' run-thread--solo' : ''}`} aria-label={`conversa com ${run.feature}`}>
      <header className="thread-header">
        <div className="thread-header__title">
          <TallyDot tally={run.tally} size={10} />
          <h2>{run.feature}</h2>
          <span className="mono thread-header__state">{run.state ?? 'sem estado'}</span>
        </div>
        <div className="thread-header__meta mono">
          <span>{run.runId.slice(0, 8)}</span>
          <span>·</span>
          <span>{run.role}</span>
          <span>·</span>
          <span>modelo n/d</span>
          <span>·</span>
          <span>custo n/d</span>
        </div>
        <div className="thread-header__controls">
          <DensityDial value={density} onChange={onDensityChange} />
          <button type="button" className="thread-header__solo" onClick={onToggleSolo}>
            {isSolo ? 'sair do solo (ESC)' : 'solo'}
          </button>
        </div>
      </header>

      <div className="thread-body">
        {run.transcripts.length === 0 && (
          <p className="ghost thread-body__empty">Sem sessão vinculada ainda (nenhum session_bound registrado).</p>
        )}
        {run.transcripts.map((t) => (
          <div key={t.sessionId} className="thread-session">
            {t.error && <p className="thread-body__error">falha ao ler transcript: {t.error}</p>}
            {t.items.map((item, i) => (
              <TranscriptItem
                key={item.uuid ? `${item.uuid}-${i}` : i}
                item={item}
                density={density}
                onPickOption={fillComposer}
                isNewestQuestion={i === t.items.length - 1}
              />
            ))}
            {t.subagentsError && <p className="thread-body__error">falha ao listar subagents: {t.subagentsError}</p>}
            {t.subagents.map((sub) => (
              <SubagentBlock key={sub.agentId} subagent={sub} density={density} />
            ))}
          </div>
        ))}

        {run.unmatchedQuestions.map((q) => (
          <TranscriptItem
            key={q.questionId}
            item={{ kind: 'tool_use', isAsk: true, question: q, name: 'ask_operator' }}
            density={density}
            onPickOption={fillComposer}
            isNewestQuestion
          />
        ))}

        {optimistic && (
          <div className="msg msg--operator msg--optimistic deck-anim-in">
            <span className="msg__tag mono">
              OPERADOR · {optimistic.status === 'sending' ? 'enviando…' : optimistic.status === 'error' ? 'falhou' : 'enviado'}
            </span>
            <p>{optimistic.text}</p>
            {optimistic.status === 'error' && <p className="thread-body__error">{optimistic.error}</p>}
          </div>
        )}

        {resumeState?.status && (
          <p className={`thread-body__notice${resumeState.status === 'error' ? ' thread-body__error' : ''}`}>
            {resumeState.status === 'pending' && 'retomando run (fase B)…'}
            {resumeState.status === 'ok' && 'retomada disparada.'}
            {resumeState.status === 'error' && `retomada automática indisponível: ${resumeState.message}`}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        mode={composerMode}
        disabledLabel={disabledLabel}
        placeholder="Responder pergunta do agente…"
        value={draft}
        onChange={setDraft}
        onSubmit={(text) => {
          if (!pendingQuestion) return;
          onAnswer(pendingQuestion.questionId, text);
          setDraft('');
        }}
        sending={optimistic?.status === 'sending'}
      />
      <p className="sr-only" aria-live="polite">
        {messageCount} mensagens · {run.pendingQuestions.length} pergunta(s) pendente(s)
      </p>
    </section>
  );
}
