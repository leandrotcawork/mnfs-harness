import TallyDot from './TallyDot.jsx';

function lastText(run) {
  for (let i = run.transcripts.length - 1; i >= 0; i -= 1) {
    const items = run.transcripts[i].items;
    for (let j = items.length - 1; j >= 0; j -= 1) {
      if (items[j].kind === 'text') return items[j].text;
    }
  }
  return null;
}

export default function Overview({ runs, onSelectRun, onClose }) {
  return (
    <div className="overview" role="dialog" aria-label="overview — parede multiviewer">
      <div className="overview__bar">
        <span className="mono">overview</span>
        <button type="button" className="overview__close" onClick={onClose}>fechar (ESC)</button>
      </div>
      <div className="overview__grid">
        {runs.length === 0 && <p className="ghost">Nenhuma run ativa.</p>}
        {runs.map((run) => {
          const question = run.pendingQuestions[0];
          const text = lastText(run);
          return (
            <button
              key={run.runId}
              type="button"
              className={`overview-tile overview-tile--${run.tally}`}
              onClick={() => onSelectRun(run.runId)}
            >
              <div className="overview-tile__head">
                <TallyDot tally={run.tally} />
                <span className="mono">{run.feature}</span>
                <span className="mono ghost">{run.state ?? 'sem estado'}</span>
              </div>
              {question ? (
                <div className="overview-tile__question">
                  <p className="overview-tile__clamp">{question.question}</p>
                  <span className="overview-tile__answer-btn">responder →</span>
                </div>
              ) : (
                <p className="overview-tile__clamp">{text || 'sem mensagens ainda'}</p>
              )}
              <div className="overview-tile__meta mono ghost">
                <span>{run.role}</span>
                <span>·</span>
                <span>custo n/d</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
