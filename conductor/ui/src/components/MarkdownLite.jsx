import { parseMarkdownLite } from '../lib/markdownLite.js';

function Inline({ nodes }) {
  return nodes.map((n) => {
    if (n.type === 'bold') return <strong key={n.key}>{n.value}</strong>;
    if (n.type === 'code') return <code key={n.key} className="mdlite-code-inline mono">{n.value}</code>;
    return <span key={n.key}>{n.value}</span>;
  });
}

export default function MarkdownLite({ text }) {
  const blocks = parseMarkdownLite(text);
  return (
    <div className="mdlite">
      {blocks.map((b) => {
        if (b.type === 'code-block') {
          return (
            <pre key={b.key} className="mdlite-code-block mono">
              <code>{b.value}</code>
            </pre>
          );
        }
        return (
          <p key={b.key} className="mdlite-paragraph">
            <Inline nodes={b.inline} />
          </p>
        );
      })}
    </div>
  );
}
