import TallyDot from './TallyDot.jsx';
import Composer from './Composer.jsx';

/**
 * Hub thread — fase A renders it as a feed of events derived from current /api/state
 * (there is no ledger timestamp exposed to the client, so this is a live snapshot digest,
 * not a true ordered event history; each card is honest about that framing).
 */
export default function HubThread({ missionName, runs, pendingQuestions, onSelectRun }) {
  const cards = [];
  for (const run of runs) {
    cards.push({
      key: `run-${run.runId}`,
      tally: run.tally,
      title: `run ${run.feature}`,
      body: `role ${run.role} · estado ${run.state ?? 'sem estado'}`,
      runId: run.runId,
    });
  }
  for (const q of pendingQuestions) {
    cards.push({
      key: `q-${q.questionId}`,
      tally: 'red',
      title: `pergunta pendente — ${q.feature}`,
      body: q.question,
      runId: q.runId,
    });
  }

  return (
    <section className="run-thread" aria-label="conversa com o hub">
      <header className="thread-header">
        <div className="thread-header__title">
          <TallyDot tally="green" size={10} />
          <h2>HUB{missionName ? ` · ${missionName}` : ''}</h2>
        </div>
        <div className="thread-header__meta mono">
          <span>{runs.length} run(s)</span>
        </div>
      </header>
      <div className="thread-body">
        <p className="ghost hub-feed__note">
          feed derivado do estado atual — sem timestamp de ledger exposto pela API ainda, então isto é um retrato ao vivo, não um histórico ordenado.
        </p>
        {cards.length === 0 && <p className="ghost">Nenhuma run na missão ainda.</p>}
        {cards.map((c) => (
          <button key={c.key} type="button" className="hub-card deck-anim-in" onClick={() => c.runId && onSelectRun(c.runId)}>
            <TallyDot tally={c.tally} />
            <div className="hub-card__body">
              <div className="hub-card__title mono">{c.title}</div>
              <div className="hub-card__desc">{c.body}</div>
            </div>
            <span className="hub-card__link">ver thread →</span>
          </button>
        ))}
      </div>
      <Composer mode="disabled" disabledLabel="Conversar com o hub chega na fase C" />
    </section>
  );
}
