import MarkdownLite from './MarkdownLite.jsx';
import ToolUseBlock from './ToolUseBlock.jsx';
import AskOperatorCard from './AskOperatorCard.jsx';

/**
 * Renders one flattened transcript item honoring the density dial:
 * sum = assistant text only; norm = + collapsed tool_use; verb = + thinking + tool_result.
 * (tool_result is always attached inside ToolUseBlock's own expand — verb's addition is
 * making thinking visible; tool_result was always reachable by expanding in norm too, matching
 * "colapsado por default" rather than hidden entirely.)
 */
export default function TranscriptItem({ item, density, onPickOption = () => {}, isNewestQuestion }) {
  if (item.kind === 'tool_use' && item.isAsk && item.question) {
    return <AskOperatorCard question={item.question} onPickOption={onPickOption} isNewest={isNewestQuestion} />;
  }
  if (item.kind === 'text') {
    if (item.isCardPrompt) {
      if (density === 'sum') return null;
      return (
        <div className="msg msg--tool deck-anim-in">
          <span className="msg__tag mono">card (prompt da run)</span>
          <pre className="mono msg__card-prompt"><code>{item.text}</code></pre>
        </div>
      );
    }
    const roleClass = item.role === 'user' ? 'msg--operator' : 'msg--agent';
    return (
      <div className={`msg ${roleClass} deck-anim-in`}>
        <span className="msg__tag mono">{item.role === 'user' ? 'OPERADOR' : 'agente'}</span>
        <MarkdownLite text={item.text} />
      </div>
    );
  }
  if (item.kind === 'thinking') {
    if (density !== 'verb') return null;
    return (
      <div className="msg msg--thinking deck-anim-in">
        <span className="msg__tag mono">thinking</span>
        <p className="msg__thinking-text">{item.text}</p>
      </div>
    );
  }
  if (item.kind === 'tool_use') {
    if (density === 'sum') return null;
    return <ToolUseBlock item={item} />;
  }
  if (item.kind === 'tool_result_orphan') {
    if (density !== 'verb') return null;
    return (
      <div className={`msg msg--tool deck-anim-in${item.isError ? ' msg--error' : ''}`}>
        <span className="msg__tag mono">tool_result (sem tool_use correspondente)</span>
        <pre className="mono"><code>{item.text}</code></pre>
      </div>
    );
  }
  return null;
}
