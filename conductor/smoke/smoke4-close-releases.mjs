// SMOKE-4 (A5): close() while an MCP tool handler promise is HELD (never resolves).
// Verifies: iterator ends, held promise abandoned without wedging process, exit <= 10s.
import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

let handlerEntered = false;
const server = createSdkMcpServer({
  name: 'conductor',
  version: '1.0.0',
  tools: [
    tool('ask_operator', 'Ask operator.', { question: z.string() }, async () => {
      handlerEntered = true;
      log('handler entered — holding forever');
      await new Promise(() => {}); // never resolves
      return { content: [] };
    })
  ]
});

const q = query({
  prompt: 'Call ask_operator with question "test". Wait for the answer.',
  options: {
    model: 'claude-haiku-4-5-20251001',
    maxTurns: 3,
    maxBudgetUsd: 0.2,
    settingSources: [],
    permissionMode: 'default',
    mcpServers: { conductor: server },
    canUseTool: async (n, i) => ({ behavior: 'allow', updatedInput: i })
  }
});

let closeAt = null;
const closer = setInterval(() => {
  if (handlerEntered && !closeAt) {
    closeAt = Date.now();
    log('calling close() with handler held');
    clearInterval(closer);
    q.close();
  }
}, 500);
const globalKiller = setTimeout(() => { log('GLOBAL TIMEOUT 120s'); process.exit(1); }, 120_000);

let iterEnded = false;
try {
  for await (const msg of q) {
    if (msg.type === 'system' && msg.subtype === 'init') log('init');
    if (msg.type === 'result') log(`result subtype=${msg.subtype}`);
  }
  iterEnded = true;
} catch (e) {
  iterEnded = true;
  log(`iterator threw (acceptable): ${String(e).slice(0, 120)}`);
}
const releaseMs = closeAt ? Date.now() - closeAt : null;
clearTimeout(globalKiller);
log(`DONE iterEnded=${iterEnded} handlerEntered=${handlerEntered} msFromCloseToEnd=${releaseMs}`);
const pass = iterEnded && handlerEntered && releaseMs !== null && releaseMs <= 10_000;
console.log(pass ? 'A5 CONFIRMED (iterator released bounded)' : 'A5 FALSIFIED/PARTIAL');
// process exit itself proves no wedge; exit code by pass
process.exit(pass ? 0 : 1);
