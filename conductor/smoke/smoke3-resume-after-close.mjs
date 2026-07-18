// SMOKE-3 (A3): close() mid-turn, then resume by sessionId with a new turn.
// Verifies: resume works after forceful close; agent retains earlier context (magic word).
import { query } from '@anthropic-ai/claude-agent-sdk';

const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
const base = {
  model: 'claude-haiku-4-5-20251001',
  maxTurns: 4,
  maxBudgetUsd: 0.2,
  settingSources: [],
  permissionMode: 'default',
  allowedTools: []
};

// Phase 1: establish context, then close mid-second-turn.
let sessionId = null;
const q1 = query({
  prompt: 'Remember this magic word: ABRAXAS-77. Confirm you memorized it, then count slowly from 1 to 50, one number per line.',
  options: base
});
let closed = false;
const closeTimer = setTimeout(() => {
  log('closing q1 mid-stream');
  closed = true;
  q1.close();
}, 8_000);
try {
  for await (const msg of q1) {
    if (msg.type === 'system' && msg.subtype === 'init') { sessionId = msg.session_id; log(`init session=${sessionId}`); }
    if (msg.type === 'result') log(`q1 result subtype=${msg.subtype}`);
  }
} catch (e) {
  log(`q1 iterator threw (expected on close): ${String(e).slice(0, 100)}`);
}
clearTimeout(closeTimer);
log(`phase1 done closed=${closed} sessionId=${sessionId}`);
if (!sessionId) { log('FAIL no sessionId'); process.exit(1); }

await new Promise((r) => setTimeout(r, 2000));

// Phase 2: resume with new turn.
let magicOk = false, resumed = false;
const q2 = query({
  prompt: 'What was the magic word I told you earlier? Reply with just the word.',
  options: { ...base, resume: sessionId }
});
const killer = setTimeout(() => { log('TIMEOUT q2'); q2.close(); }, 120_000);
try {
  for await (const msg of q2) {
    if (msg.type === 'system' && msg.subtype === 'init') { resumed = true; log(`resumed session=${msg.session_id} (same=${msg.session_id === sessionId})`); }
    if (msg.type === 'result') {
      log(`q2 result subtype=${msg.subtype} text=${msg.result?.slice(0, 80)}`);
      magicOk = /ABRAXAS-77/i.test(msg.result ?? '');
    }
  }
} catch (e) {
  log(`q2 threw: ${String(e).slice(0, 200)}`);
}
clearTimeout(killer);
log(`DONE resumed=${resumed} magicRecalled=${magicOk}`);
console.log(magicOk ? 'A3 CONFIRMED' : 'A3 FALSIFIED/PARTIAL — resume after close did not retain context');
process.exit(magicOk ? 0 : 1);
