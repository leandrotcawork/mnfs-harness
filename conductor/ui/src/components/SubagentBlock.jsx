import { useState } from 'react';
import TranscriptItem from './TranscriptItem.jsx';

export default function SubagentBlock({ subagent, density }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="subagent-block deck-anim-in">
      <button type="button" className="subagent-block__head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={`tool-block__chevron${open ? ' tool-block__chevron--open' : ''}`} aria-hidden="true">▸</span>
        <span className="mono">subagent {subagent.agentId}</span>
        {!subagent.error && <span className="ghost mono">{subagent.items.length} msgs</span>}
        {subagent.error && <span className="tool-block__error-flag">falha ao ler</span>}
      </button>
      {open && (
        <div className="subagent-block__body">
          {subagent.error && <div className="ghost">{subagent.error}</div>}
          {subagent.items.map((it, i) => (
            <TranscriptItem key={it.uuid ? `${it.uuid}-${i}` : i} item={it} density={density} />
          ))}
        </div>
      )}
    </div>
  );
}
