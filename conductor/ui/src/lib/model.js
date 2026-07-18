// mnfs deck — normalization layer
// Turns the raw /api/state (transcriptSnapshot) payload into shapes the UI renders.
//
// Raw shape (from conductor/src/viewer.mjs):
//   { runs: [{ runId, feature, role, cwd, state, transcripts: [
//       { sessionId, messages: SessionMessage[], subagents: [{agentId, messages, error?}], error? }
//     ] }],
//     pendingQuestions: [{ questionId, runId, feature, question, options?, context? }] }
//
// SessionMessage = { type: 'user'|'assistant'|'system', uuid, session_id, message, parent_tool_use_id, parent_agent_id }
// `message` is the raw Anthropic API message: { role, content } where content is either a
// string or an array of blocks ({type:'text'|'tool_use'|'tool_result'|'thinking', ...}).
//
// ASSUMPTIONS beyond what viewer.mjs documents (no server change made — read only):
// 1. `message.content` can be a bare string (Anthropic API allows this for simple user/text
//    turns) — normalized into a single `text` block.
// 2. There is no wall-clock timestamp anywhere in /api/state (ledger `ts` is never returned,
//    SessionMessage carries no ts). MET therefore cannot be the true "oldest started" event
//    time. We approximate it with the client's first-observed-run timestamp (first poll that
//    contains at least one run) and label it plainly; this is a client-side proxy, not the
//    server truth, and is documented in the ctx panel as such.
// 3. There is no cost/token telemetry field anywhere in /api/state. Cost in ctx panels renders
//    "n/d" (not available) rather than a fabricated number.
// 4. pendingQuestions carry no link to a specific tool_use id in the transcript, so we match
//    ask_operator tool_use blocks (by tool name) to pending questions for the same run in
//    encounter order (FIFO) — a best-effort positional match, not a guaranteed one.
// 5. `role`/`cwd` on a run are the only identity fields; there is no explicit model name or
//    accumulated cost, so the ctx panel shows role only and marks model/cost as n/d.

export const TALLY = { RED: 'red', GREEN: 'green', AMBER: 'amber', OFF: 'off' };

const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled']);
const RUNNING_STATES = new Set(['started', 'resumed']);

export function tallyForState(state) {
  if (state === 'waiting_operator') return TALLY.RED;
  if (RUNNING_STATES.has(state)) return TALLY.GREEN;
  if (state === 'investigate' || (typeof state === 'string' && state.startsWith('parked'))) return TALLY.AMBER;
  if (TERMINAL_STATES.has(state)) return TALLY.OFF;
  return TALLY.OFF;
}

export function isTerminal(state) {
  return TERMINAL_STATES.has(state);
}

function contentToBlocks(content) {
  if (content == null) return [];
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (Array.isArray(content)) return content;
  return [];
}

/**
 * Flattens one transcript's SessionMessage[] into a linear list of render-ready items,
 * pairing tool_result blocks back onto their originating tool_use by tool_use_id, and
 * tagging ask_operator tool_use blocks with a FIFO-matched pending question (if any).
 */
export function flattenMessages(messages, { pendingQuestionsForRun = [] } = {}) {
  const items = [];
  const toolUseIndex = new Map(); // tool_use_id -> item (for attaching results)
  let questionCursor = 0;

  for (const sm of messages || []) {
    const role = sm?.message?.role ?? sm?.type;
    const blocks = contentToBlocks(sm?.message?.content);
    if (blocks.length === 0) continue;
    for (const block of blocks) {
      if (block.type === 'text') {
        // The very first user-text of a session is the card prompt injected by the
        // conductor, not something the human operator typed — label it as such.
        const isCardPrompt = role === 'user' && !items.some((i) => i.kind === 'text' && i.role === 'user');
        items.push({ kind: 'text', role, uuid: sm.uuid, text: block.text, isCardPrompt });
      } else if (block.type === 'thinking' || block.type === 'redacted_thinking') {
        items.push({ kind: 'thinking', role, uuid: sm.uuid, text: block.thinking ?? block.text ?? '' });
      } else if (block.type === 'tool_use') {
        const isAsk = block.name === 'ask_operator' || block.name === 'mcp__conductor__ask_operator';
        const item = {
          kind: 'tool_use',
          role,
          uuid: sm.uuid,
          id: block.id,
          name: block.name,
          input: block.input,
          result: null,
          isAsk,
          question: null,
        };
        if (isAsk && questionCursor < pendingQuestionsForRun.length) {
          item.question = pendingQuestionsForRun[questionCursor];
          questionCursor += 1;
        }
        toolUseIndex.set(block.id, item);
        items.push(item);
      } else if (block.type === 'tool_result') {
        const target = toolUseIndex.get(block.tool_use_id);
        const resultText = Array.isArray(block.content)
          ? block.content.map((c) => c.text ?? '').join('\n')
          : (typeof block.content === 'string' ? block.content : JSON.stringify(block.content));
        if (target) {
          target.result = { text: resultText, isError: !!block.is_error };
        } else {
          items.push({ kind: 'tool_result_orphan', role, uuid: sm.uuid, text: resultText, isError: !!block.is_error });
        }
      }
    }
  }
  return items;
}

export function flattenSubagent(sub) {
  if (sub.error) return { agentId: sub.agentId, error: sub.error, items: [] };
  return { agentId: sub.agentId, items: flattenMessages(sub.messages) };
}

/**
 * Builds the render model for a single run: ordered transcript items across all of its
 * sessions (fase A: normally one), each carrying its own subagents.
 */
export function buildRunThread(run, pendingQuestions) {
  const questionsForRun = pendingQuestions.filter((q) => q.runId === run.runId);
  const transcripts = (run.transcripts || []).map((t) => {
    if (t.error) return { sessionId: t.sessionId, error: t.error, items: [], subagents: [] };
    return {
      sessionId: t.sessionId,
      items: flattenMessages(t.messages, { pendingQuestionsForRun: questionsForRun }),
      subagents: (t.subagents || []).map(flattenSubagent),
      subagentsError: t.subagentsError,
    };
  });
  // Any pending question not matched positionally to a tool_use (e.g. transcript read
  // failed, or the ask_operator call predates what getSessionMessages returned) still
  // needs to surface — append as a trailing synthetic ask card so the operator never
  // loses a question they must answer.
  const matchedIds = new Set();
  for (const t of transcripts) {
    for (const it of t.items) {
      if (it.kind === 'tool_use' && it.isAsk && it.question) matchedIds.add(it.question.questionId);
    }
  }
  const unmatched = questionsForRun.filter((q) => !matchedIds.has(q.questionId));

  return {
    runId: run.runId,
    feature: run.feature,
    role: run.role,
    cwd: run.cwd,
    state: run.state,
    tally: tallyForState(run.state),
    transcripts,
    unmatchedQuestions: unmatched,
    pendingQuestions: questionsForRun,
  };
}

export function buildModel(raw) {
  const runs = (raw?.runs || []).map((r) => buildRunThread(r, raw?.pendingQuestions || []));
  const pendingQuestions = raw?.pendingQuestions || [];
  const tallyCounts = runs.reduce(
    (acc, r) => {
      acc[r.tally] = (acc[r.tally] || 0) + 1;
      return acc;
    },
    { red: 0, green: 0, amber: 0, off: 0 }
  );
  return { runs, pendingQuestions, tallyCounts };
}

export function firstPendingQuestion(model) {
  if (!model?.pendingQuestions?.length) return null;
  return model.pendingQuestions[0];
}

export function formatMet(startMs, nowMs) {
  if (!startMs) return 'T+ --:--:--';
  const totalSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `T+ ${h}:${m}:${s}`;
}

export function relativeTime(fromMs, nowMs) {
  const deltaSec = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (deltaSec < 5) return 'agora';
  if (deltaSec < 60) return `${deltaSec}s atrás`;
  const min = Math.floor(deltaSec / 60);
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  return `${h}h atrás`;
}
