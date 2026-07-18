import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const LIFECYCLE_EVENTS = new Set(['started', 'waiting_operator', 'resumed', 'investigate', 'completed', 'failed', 'cancelled']);
export const AUDIT_EVENTS = new Set(['session_bound', 'question', 'denial', 'answer_applied', 'watchdog_kill', 'malformed_answer', 'terminalize_suppressed']);
export const TERMINAL_EVENTS = new Set(['investigate', 'completed', 'failed', 'cancelled']);
const TRANSITIONS = {
  started: new Set(['waiting_operator', 'investigate', 'completed', 'failed', 'cancelled']),
  waiting_operator: new Set(['resumed', 'investigate', 'cancelled']),
  resumed: new Set(['waiting_operator', 'investigate', 'completed', 'failed', 'cancelled'])
};
const commits = new Set();

export function readEvents(file) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((line) => { try { const e = JSON.parse(line); return e && typeof e.event === 'string' ? [e] : []; } catch { return []; } }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
export const lifecycleEvents = (events) => events.filter((e) => LIFECYCLE_EVENTS.has(e.event));
export const latestLifecycle = (events) => lifecycleEvents(events).at(-1) ?? null;
export const runState = (events) => latestLifecycle(events)?.event ?? null;
export const countResumes = (events) => events.filter((e) => e.event === 'resumed').length;

function validate(evt) {
  if (!evt || typeof evt !== 'object' || typeof evt.runId !== 'string' || typeof evt.event !== 'string') throw new Error('invalid event');
  for (const key of ['ts', 'eventId', 'schemaVersion']) if (Object.hasOwn(evt, key)) throw new Error(`reserved field: ${key}`);
  if (![...LIFECYCLE_EVENTS, ...AUDIT_EVENTS].includes(evt.event)) throw new Error(`unknown event: ${evt.event}`);
  if (['investigate', 'failed', 'cancelled', 'watchdog_kill'].includes(evt.event) && typeof evt.reason !== 'string') throw new Error(`reason required for ${evt.event}`);
  if (evt.event === 'terminalize_suppressed' && (!Number.isInteger(evt.generation) || typeof evt.winnerKind !== 'string' || typeof evt.suppressedKind !== 'string')) throw new Error('invalid terminalize_suppressed');
}

export function appendEvent(file, evt, { generation, clock = Date.now } = {}) {
  if (commits.has(file)) throw new Error('CONCURRENT-COMMIT');
  commits.add(file);
  try {
  validate(evt);
  const expected = generation ?? evt.generation;
  if (!Number.isInteger(expected) || expected < 1) throw new Error('generation required');
  const events = readEvents(file);
  const knownGeneration = events.at(-1)?.generation;
  const advancesGeneration = evt.event === 'resumed' && expected === knownGeneration + 1;
  if (knownGeneration !== undefined && knownGeneration !== expected && !advancesGeneration) throw new Error('STALE-GENERATION');
  if (LIFECYCLE_EVENTS.has(evt.event)) {
    const prior = latestLifecycle(events)?.event ?? null;
    if (!prior && evt.event !== 'started') throw new Error(`run must start before ${evt.event}`);
    if (prior && (!TRANSITIONS[prior] || !TRANSITIONS[prior].has(evt.event))) throw new Error(`invalid transition: ${prior} -> ${evt.event}`);
  } else if (AUDIT_EVENTS.has(evt.event) && !latestLifecycle(events)) {
    // G1: validation previously gated LIFECYCLE_EVENTS only, so an audit event
    // (session_bound/question/denial/answer_applied/watchdog_kill/
    // malformed_answer/terminalize_suppressed) could be appended as the very
    // first ledger record, ahead of `started`. Audit events are only ever
    // meaningful once a run exists.
    throw new Error(`run must start before ${evt.event}`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const record = { ts: new Date(clock()).toISOString(), eventId: randomUUID(), schemaVersion: 2, ...evt, generation: expected };
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
  } finally { commits.delete(file); }
}

export function createAuditor(file, base, options = {}) {
  const seen = new Set(readEvents(file).filter((e) => e.event === 'denial').map((e) => e.toolUseID));
  return function auditDenial(toolUseID, source, tool, reason) {
    const id = toolUseID || `missing:${randomUUID()}`;
    if (seen.has(id)) return false;
    seen.add(id); appendEvent(file, { ...base, event: 'denial', toolUseID: id, source, tool, reason: toolUseID ? reason : `missing-tool-use-id: ${reason}`, failClosed: !toolUseID }, options); return true;
  };
}
