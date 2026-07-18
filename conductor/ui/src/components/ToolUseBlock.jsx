import { useState } from 'react';

function summarizeInput(input) {
  if (input == null) return '';
  try {
    const flat = JSON.stringify(input);
    return flat.length > 96 ? `${flat.slice(0, 96)}…` : flat;
  } catch {
    return String(input);
  }
}

/** Collapsed-by-default tool_use row; expands to pretty JSON input + attached tool_result. */
export default function ToolUseBlock({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`tool-block deck-anim-in${item.result?.isError ? ' tool-block--error' : ''}`}>
      <button
        type="button"
        className="tool-block__head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`tool-block__chevron${open ? ' tool-block__chevron--open' : ''}`} aria-hidden="true">▸</span>
        <span className="mono tool-block__name">{item.name}</span>
        <span className="tool-block__summary mono">{summarizeInput(item.input)}</span>
        {item.result?.isError && <span className="tool-block__error-flag">erro</span>}
      </button>
      {open && (
        <div className="tool-block__body">
          <pre className="mono tool-block__json"><code>{JSON.stringify(item.input, null, 2)}</code></pre>
          {item.result && (
            <div className="tool-block__result">
              <div className="tag-label">tool_result</div>
              <pre className="mono tool-block__json"><code>{item.result.text}</code></pre>
            </div>
          )}
          {!item.result && <div className="tool-block__pending ghost">aguardando tool_result…</div>}
        </div>
      )}
    </div>
  );
}
