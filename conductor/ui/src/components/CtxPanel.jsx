import TallyDot from './TallyDot.jsx';

function RunCtx({ run, onResume, resumeState }) {
  const messageCount = run.transcripts.reduce((n, t) => n + t.items.length, 0);
  const canResume = run.state === 'waiting_operator' && run.pendingQuestions.length === 0 && run.transcripts.length > 0;
  const canInvestigateResume = run.state === 'investigate';
  return (
    <div className="ctx-panel__stack">
      <div className="ctx-block ctx-block--solid">
        <div className="ctx-block__title">contexto: RUN</div>
        <dl className="ctx-kv mono">
          <div><dt>role</dt><dd>{run.role}</dd></div>
          <div><dt>modelo</dt><dd>n/d</dd></div>
          <div><dt>custo</dt><dd>n/d</dd></div>
          <div><dt>itens no transcript</dt><dd>{messageCount}</dd></div>
          <div><dt>fingerprint</dt><dd>n/d</dd></div>
        </dl>
      </div>
      <div className="ctx-block">
        <div className="ctx-block__title">ledger</div>
        <p className="ghost">estado atual: <span className="mono">{run.state ?? 'sem estado'}</span> — histórico de eventos não é exposto por /api/state hoje.</p>
      </div>
      <div className="ctx-block">
        <div className="ctx-block__title">retomar</div>
        {canResume || canInvestigateResume ? (
          <button type="button" className="ctx-block__resume" onClick={() => onResume(run.runId)} disabled={resumeState?.status === 'pending'}>
            {resumeState?.status === 'pending' ? 'retomando…' : 'POST /api/resume'}
          </button>
        ) : (
          <p className="ghost">sem ação de retomar disponível para o estado atual.</p>
        )}
        {resumeState?.status === 'error' && <p className="thread-body__error">{resumeState.message}</p>}
      </div>
    </div>
  );
}

function HubCtx({ runs, pendingQuestions, onSelectRun }) {
  return (
    <div className="ctx-panel__stack">
      <div className="ctx-block ctx-block--solid">
        <div className="ctx-block__title">contexto: HUB — fleet</div>
        <div className="mini-multiviewer">
          {runs.length === 0 && <p className="ghost">sem runs</p>}
          {runs.map((r) => (
            <button key={r.runId} type="button" className={`minitile minitile--${r.tally}`} onClick={() => onSelectRun(r.runId)}>
              <TallyDot tally={r.tally} size={6} /> <span className="mono">{r.feature}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ctx-block">
        <div className="ctx-block__title">custo missão</div>
        <p className="ghost mono">n/d — /api/state não expõe custo acumulado</p>
      </div>
      <div className="ctx-block">
        <div className="ctx-block__title">fila de decisões</div>
        {pendingQuestions.length === 0 && <p className="ghost">sem perguntas pendentes</p>}
        <ul className="ctx-decision-list">
          {pendingQuestions.map((q) => (
            <li key={q.questionId}>
              <button type="button" onClick={() => onSelectRun(q.runId)}>{q.feature} — {q.question.slice(0, 60)}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function CtxPanel({ type, run, runs, pendingQuestions, onSelectRun, onResume, resumeState, collapsed, onToggleCollapse }) {
  return (
    <aside className={`ctx-panel${collapsed ? ' ctx-panel--collapsed' : ''}`} aria-label="painel de contexto">
      <button type="button" className="ctx-panel__toggle" onClick={onToggleCollapse} aria-label={collapsed ? 'abrir painel de contexto' : 'fechar painel de contexto'}>
        {collapsed ? '‹' : '›'}
      </button>
      {!collapsed && (
        <div className="ctx-panel__body">
          {type === 'run' && run && <RunCtx run={run} onResume={onResume} resumeState={resumeState} />}
          {type === 'hub' && <HubCtx runs={runs} pendingQuestions={pendingQuestions} onSelectRun={onSelectRun} />}
          {type === 'launch' && <p className="ghost ctx-panel__empty">preencha o card à esquerda para ver o preview.</p>}
          {type === 'milestone' && <p className="ghost ctx-panel__empty">board CTC entra quando mission.json existir.</p>}
          {!run && type === 'run' && <p className="ghost ctx-panel__empty">selecione uma conversa.</p>}
        </div>
      )}
    </aside>
  );
}
