export default function TruthStrip({ missionName, met, pendingCount, tallyCounts, onJumpToFirstQuestion, onOpenOverview, onToggleTree }) {
  return (
    <header className="truth-strip">
      <button type="button" className="truth-strip__tree-toggle" onClick={onToggleTree} aria-label="abrir árvore de conversas">
        <span aria-hidden="true">☰</span>
      </button>
      <div className="truth-strip__brand">
        <span className="truth-strip__logo">mnfs deck</span>
        {missionName && <span className="truth-strip__mission mono">{missionName}</span>}
      </div>
      <div className="truth-strip__met mono" aria-live="off">{met}</div>
      <div className="truth-strip__right">
        <span className="truth-strip__runcount mono">
          {tallyCounts.green} run · {tallyCounts.red} wait
        </span>
        {pendingCount > 0 && (
          <button type="button" className="truth-strip__badge" onClick={onJumpToFirstQuestion}>
            {pendingCount} pergunta{pendingCount === 1 ? '' : 's'}
          </button>
        )}
        <button type="button" className="truth-strip__overview" onClick={onOpenOverview} title="overview (O)">
          <span aria-hidden="true">▦</span> overview
        </button>
      </div>
    </header>
  );
}
