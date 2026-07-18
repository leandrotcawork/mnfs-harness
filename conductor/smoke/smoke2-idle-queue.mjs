// SMOKE-2 (A2): held-open AsyncIterable prompt. Turn 1, then 60s idle, then push turn 2.
// Verifies: subprocess stays alive idle between turns; second injected turn is processed.
import { query } from '@anthropic-ai/claude-agent-sdk';

const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

const queue = [];
let notify = null;
let closed = false;
function push(text) {
  queue.push({
    type: 'user',
    message: { role: 'user', content: [{ type: 'text', text }] },
    parent_tool_use_id: null
  });
  notify?.();
}
async function* stream() {
  while (!closed) {
    while (queue.length) yield queue.shift();
    await new Promise((r) => (notify = r));
  }
}

push('Reply with exactly: TURN-ONE-OK');

const q = query({
  prompt: stream(),
  options: {
    model: 'claude-haiku-4-5-20251001',
    maxTurns: 6,
    maxBudgetUsd: 0.2,
    settingSources: [],
    permissionMode: 'default',
    allowedTools: []
  }
});

let turn1Done = false;
let turn2Done = false;
const killer = setTimeout(() => {
  log('GLOBAL TIMEOUT 240s — closing');
  closed = true;
  notify?.();
  q.close();
}, 240_000);

for await (const msg of q) {
  if (msg.type === 'system' && msg.subtype === 'init') log(`init session=${msg.session_id}`);
  if (msg.type === 'result') {
    log(`RESULT subtype=${msg.subtype} text=${msg.result?.slice(0, 80)}`);
    if (!turn1Done) {
      turn1Done = /TURN-ONE-OK/.test(msg.result ?? '');
      log(`turn1 ok=${turn1Done}; idling 60s before injecting turn 2...`);
      setTimeout(() => {
        log('pushing turn 2');
        push('Reply with exactly: TURN-TWO-OK');
        // give it time to answer, then end the stream
        setTimeout(() => { closed = true; notify?.(); }, 90_000);
      }, 60_000);
    } else if (!turn2Done) {
      turn2Done = /TURN-TWO-OK/.test(msg.result ?? '');
      log(`turn2 ok=${turn2Done} — ending stream`);
      closed = true;
      notify?.();
    }
  }
}
clearTimeout(killer);
log(`DONE turn1=${turn1Done} turn2=${turn2Done}`);
process.exit(turn1Done && turn2Done ? 0 : 1);
