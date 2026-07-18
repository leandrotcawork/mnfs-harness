// SMOKE-5 (A6): outputFormat json_schema + in-process MCP tool in the same session.
// Verifies: tool call works AND structured_output arrives validated.
import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

const server = createSdkMcpServer({
  name: 'conductor',
  version: '1.0.0',
  tools: [
    tool('ask_operator', 'Ask operator.', { question: z.string() }, async () => ({
      content: [{ type: 'text', text: 'OPERATOR-ANSWER: blue' }]
    }))
  ]
});

const schema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['completed', 'failed'] },
    summary: { type: 'string' },
    operatorAnswer: { type: 'string' }
  },
  required: ['status', 'summary', 'operatorAnswer'],
  additionalProperties: false
};

const q = query({
  prompt: 'Ask the operator (ask_operator tool) what color to use. Then finish, reporting status completed, a one-line summary, and the operator answer you received.',
  options: {
    model: 'claude-haiku-4-5-20251001',
    maxTurns: 4,
    maxBudgetUsd: 0.2,
    settingSources: [],
    permissionMode: 'default',
    mcpServers: { conductor: server },
    canUseTool: async (n, i) => ({ behavior: 'allow', updatedInput: i }),
    outputFormat: { type: 'json_schema', schema }
  }
});

let toolUsed = false, structured = null, subtype = null;
const killer = setTimeout(() => { log('TIMEOUT'); q.close(); }, 150_000);
for await (const msg of q) {
  if (msg.type === 'assistant') {
    for (const b of msg.message.content) if (b.type === 'tool_use') { toolUsed = true; log(`tool_use ${b.name}`); }
  }
  if (msg.type === 'result') {
    subtype = msg.subtype;
    structured = msg.structured_output ?? null;
    log(`result subtype=${subtype} structured=${JSON.stringify(structured)?.slice(0, 200)}`);
  }
}
clearTimeout(killer);
const pass = toolUsed && subtype === 'success' && structured && structured.status === 'completed' && /blue/i.test(structured.operatorAnswer ?? '');
console.log(pass ? 'A6 CONFIRMED' : `A6 FALSIFIED/PARTIAL (toolUsed=${toolUsed} subtype=${subtype})`);
process.exit(pass ? 0 : 1);
