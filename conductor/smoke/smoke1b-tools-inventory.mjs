// SMOKE-1b (A4): does options.tools (built-in inventory restriction) suppress or keep
// in-process MCP tools? tools: ['Read'] + mcpServers conductor -> init list must show
// mcp__conductor__ask_operator for A4 CONFIRMED.
import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

const server = createSdkMcpServer({
  name: 'conductor',
  version: '1.0.0',
  tools: [
    tool('ask_operator', 'Ask operator.', { question: z.string() }, async () => ({
      content: [{ type: 'text', text: 'OPERATOR-ANSWER: proceed' }]
    }))
  ]
});

const q = query({
  prompt: 'Call ask_operator with question "ready?" and then reply with the answer received.',
  options: {
    model: 'claude-haiku-4-5-20251001',
    maxTurns: 4,
    maxBudgetUsd: 0.2,
    settingSources: [],
    permissionMode: 'default',
    tools: ['Read'],                       // built-in inventory restricted
    mcpServers: { conductor: server },
    canUseTool: async (n, i) => { log(`canUseTool: ${n}`); return { behavior: 'allow', updatedInput: i }; }
  }
});

let initTools = null, invoked = false, answered = false;
const killer = setTimeout(() => { log('TIMEOUT'); q.close(); }, 120_000);
for await (const msg of q) {
  if (msg.type === 'system' && msg.subtype === 'init') {
    initTools = msg.tools ?? [];
    log(`init tools total=${initTools.length} mcp=${JSON.stringify(initTools.filter((t) => t.startsWith('mcp__')))} builtins=${JSON.stringify(initTools.filter((t) => !t.startsWith('mcp__')))}`);
  }
  if (msg.type === 'assistant') for (const b of msg.message.content) if (b.type === 'tool_use' && b.name === 'mcp__conductor__ask_operator') invoked = true;
  if (msg.type === 'result') { log(`result subtype=${msg.subtype} text=${msg.result?.slice(0, 80)}`); answered = /proceed/i.test(msg.result ?? ''); }
}
clearTimeout(killer);
const present = initTools?.includes('mcp__conductor__ask_operator') ?? false;
log(`DONE present=${present} invoked=${invoked} answered=${answered}`);
console.log(present && invoked ? 'A4 CONFIRMED — tools[] does not suppress MCP tools' : 'A4 FALSIFIED — use canUseTool-enforced inventory fallback (DESIGN-V2 §2)');
process.exit(present && invoked ? 0 : 1);
