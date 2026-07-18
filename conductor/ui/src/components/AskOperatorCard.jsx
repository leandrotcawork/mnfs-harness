import { useState } from 'react';
import MarkdownLite from './MarkdownLite.jsx';

/**
 * Highlighted ask_operator card — question, optional context, and option chips that fill
 * the composer. Only rendered while the question is still pending (item.question truthy);
 * once answered the SDK's own tool_result + the operator's real follow-up user message take
 * over in the ordinary transcript flow (see model.js note 4/limitation in ui report).
 */
export default function AskOperatorCard({ question, onPickOption, isNewest }) {
  const [contextOpen, setContextOpen] = useState(false);
  return (
    <div className={`ask-card${isNewest ? ' deck-anim-pulse' : ''} deck-anim-in`} role="group" aria-label="pergunta ao operador">
      <div className="ask-card__label">
        <TallyLike />
        PERGUNTA AO OPERADOR
        <span className="ask-card__runId mono">{question.feature}</span>
      </div>
      <div className="ask-card__question">
        <MarkdownLite text={question.question} />
      </div>
      {question.context && (
        <div className="ask-card__context">
          <button type="button" className="ask-card__context-toggle" aria-expanded={contextOpen} onClick={() => setContextOpen((v) => !v)}>
            {contextOpen ? '▾' : '▸'} contexto
          </button>
          {contextOpen && (
            <pre className="mono ask-card__context-body"><code>{question.context}</code></pre>
          )}
        </div>
      )}
      {Array.isArray(question.options) && question.options.length > 0 && (
        <div className="ask-card__options">
          {question.options.map((opt, i) => (
            <button key={i} type="button" className="ask-card__chip" onClick={() => onPickOption(opt)}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TallyLike() {
  return <span className="tally-dot tally-dot--red" style={{ width: 8, height: 8 }} aria-hidden="true" />;
}
