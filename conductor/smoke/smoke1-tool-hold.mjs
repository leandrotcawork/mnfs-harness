// SMOKE-1 (A1+A4): in-process MCP tool whose handler blocks ~45s awaiting "operator",
// then returns. Verifies: tool call reaches handler, long hold survives, result flows back,
// tool naming/inventory works.
import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const HOLD_MS = 45_000;
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

let handlerCalledAt = null;
const opServer = createSdkMcpServer({
  name: 'conductor',
  version: '1.0.0',
  tools: [
    tool(
      'ask_operator',
      'Ask the human operator a question and wait for their answer.',
      { question: z.string() },
      async ({ question }) => {
        handlerCalledAt = Date.now();
        log(`handler received question: ${JSON.stringify(question)} — holding ${HOLD_MS / 1000}s`);
        await new Promise((r) => setTimeout(r, HOLD_MS));
        log('handler releasing answer');
        return { content: [{ type: 'text', text: 'OPERATOR-ANSWER: yes, proceed with plan B' }] };
      }
    )
  ]
});

const q = query({
  prompt:
    'Call the ask_operator tool exactly once with question "May I proceed?". ' +
    'Then reply with exactly the answer text you received, nothing else.',
  options: {
    model: 'claude-haiku-4-5-20251001',
    maxTurns: 4,
    maxBudgetUsd: 0.2,
    settingSources: [],
    permissionMode: 'default',
    mcpServers: { conductor: opServer },
    // NOTE: gated tool must NOT be in allowedTools — bare entries shadow canUseTool
    canUseTool: async (toolName, input) => {
      log(`canUseTool: ${toolName}`);
      return { behavior: 'allow', updatedInput: input };
    }
  }
});

let sawResult = false;
const killer = setTimeout(() => {
  log('GLOBAL TIMEOUT 180s — closing');
  q.close();
}, 180_000);

for await (const msg of q) {
  if (msg.type === 'system' && msg.subtype === 'init') log(`init session=${msg.session_id} tools=${JSON.stringify(msg.tools?.filter((t) => t.includes('conductor')))}`);
  if (msg.type === 'assistant') {
    for (const b of msg.message.content) {
      if (b.type === 'tool_use') log(`assistant tool_use name=${b.name}`);
      if (b.type === 'text' && b.text.trim()) log(`assistant text: ${b.text.slice(0, 120)}`);
    }
  }
  if (msg.type === 'result') {
    sawResult = true;
    log(`RESULT subtype=${msg.subtype} num_turns=${msg.num_turns} cost=$${msg.total_cost_usd?.toFixed(4)}`);
    if (msg.subtype === 'success') log(`final: ${msg.result?.slice(0, 200)}`);
  }
}
clearTimeout(killer);
const heldMs = handlerCalledAt ? Date.now() - handlerCalledAt : null;
log(`DONE sawResult=${sawResult} handlerCalled=${handlerCalledAt !== null} holdSurvived=${heldMs !== null && heldMs >= HOLD_MS}`);
process.exit(sawResult && handlerCalledAt !== null ? 0 : 1);
