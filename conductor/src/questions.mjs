import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

const bytes = (max) => z.string().refine((v) => Buffer.byteLength(v, 'utf8') <= max, `must be <= ${max} bytes`);
export const AskOperatorSchema = z.object({ question: bytes(4096), options: z.array(bytes(200)).max(16).optional(), context: bytes(8192).optional() }).strict();

export function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temp, 'wx');
  try { fs.writeFileSync(fd, `${JSON.stringify(value)}\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, filePath);
}

export function writeAnswer(filePath, questionId, text) {
  if (typeof questionId !== 'string' || typeof text !== 'string') throw new Error('invalid answer');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  // P4: fsync the temp file's content to disk BEFORE the no-replace publication
  // (DESIGN.md:42 "temp write + flush (fsync), then no-replace publication").
  // The prior writeFileSync({flag:'wx'}) never flushed, so a crash between the
  // temp write and the COPYFILE_EXCL rename could publish a truncated file.
  const fd = fs.openSync(temp, 'wx');
  try { fs.writeFileSync(fd, `${JSON.stringify({ questionId, text })}\n`); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  try { fs.copyFileSync(temp, filePath, fs.constants.COPYFILE_EXCL); }
  catch (error) { if (error.code === 'EEXIST') throw Object.assign(new Error('duplicate answer'), { code: 'EEXIST' }); throw error; }
  finally { try { fs.unlinkSync(temp); } catch {} }
}

export function readAnswer(filePath, questionId, onMalformed = () => {}) {
  try { const value = JSON.parse(fs.readFileSync(filePath, 'utf8')); return value?.questionId === questionId && typeof value.text === 'string' ? value : (onMalformed(), null); }
  catch (error) { if (error.code !== 'ENOENT') onMalformed(error); return null; }
}

export async function waitForAnswer({ filePath, questionId, timeoutMs = 180_000, intervalMs = 2_000, clock = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onMalformed }) {
  const deadline = clock() + timeoutMs;
  while (clock() < deadline) {
    const answer = readAnswer(filePath, questionId, onMalformed); if (answer) return answer;
    await sleep(Math.min(intervalMs, Math.max(0, deadline - clock())));
  }
  return readAnswer(filePath, questionId, onMalformed);
}

export function createOperatorChannel({ onQuestion }) {
  const definition = tool('ask_operator', 'Ask the human operator for a clarification or decision.', AskOperatorSchema.shape, async (payload) => {
    const parsed = AskOperatorSchema.safeParse(payload);
    if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
    const text = await onQuestion(parsed.data);
    return { content: [{ type: 'text', text }] };
  });
  return createSdkMcpServer({ name: 'conductor', version: '2.0.0', tools: [definition] });
}
