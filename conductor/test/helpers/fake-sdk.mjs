// Injectable double of the @anthropic-ai/claude-agent-sdk `query()` surface
// consumed by runSession/resumeRun. Built so tests drive the production
// entry points (runSession/resumeRun/spawned CLI) instead of poking at
// small internal helpers.
//
// Exports:
//   - virtualClock()        -> { clock, state, tick, tickAll, flushMicrotasks }
//   - createFakeQuery(spec) -> queryFn compatible with runSession's `queryFn` dep
//   - driveToSettled(promise, vc, opts) -> await a runSession/resumeRun call
//     while pumping the virtual clock, with no real timers involved.
//   - fakeSignalSource()    -> EventEmitter usable as deps.signalSource
//   - message builders: initMessage, assistantMessage, userToolResultMessage,
//     toolUseBlock, textBlock, statusMessage, resultSuccess, resultError,
//     RESULT_ERROR_SUBTYPES
//   - pseudo-script entries: invokeCanUseTool, invokePreToolUse — processed
//     by the fake iterator (not yielded to the consumer) so PreToolUse/
//     canUseTool gate paths execute for real, with scripted tool_use_id
//     present or absent.
//   - buildDeps(vc, overrides) -> a ready-made `deps` object for runSession/
//     resumeRun wired to the virtual clock (now/sleep/timerClock) plus a
//     fresh fakeSignalSource() and an ordered `log` interceptor.

import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';

// ---------- deterministic race primitives (barrier + rendezvous) ----------

// A check-to-commit barrier for the production `deps.barrier` / createTerminalizer
// hook (A5) and the admission-mutex probe (A4). Placed points are pause-able:
// pauseAt(point, kind) blocks the FIRST entrant that reaches barrier(point, kind)
// until the returned release() is called, so competing latch entrants can be
// forced to interleave deterministically instead of relying on scheduler luck.
// Every barrier() call is also logged so tests can wait for a point to be hit.
export function makeBarrier() {
  const gates = new Map();   // `${point}:${kind}` -> { promise, release }
  const hits = [];           // ordered [{ point, kind }]
  const barrier = async (point, kind) => {
    hits.push({ point, kind });
    const gate = gates.get(`${point}:${kind}`);
    if (gate) await gate.promise;
  };
  barrier.pauseAt = (point, kind) => {
    let release; const promise = new Promise((r) => { release = r; });
    const key = `${point}:${kind}`;
    gates.set(key, { promise, release });
    return () => { gates.delete(key); release(); };
  };
  barrier.hits = hits;
  barrier.hit = (point, kind) => hits.some((h) => h.point === point && (kind === undefined || h.kind === kind));
  barrier.waitForHit = async (point, kind, { maxYields = 5000 } = {}) => {
    for (let i = 0; i < maxYields; i++) {
      if (barrier.hit(point, kind)) return;
      await new Promise((r) => setImmediate(r));
    }
    throw new Error(`barrier point ${point}:${kind ?? '*'} never hit`);
  };
  return barrier;
}

// N-party rendezvous for deps.admissionRendezvous (A3): every caller awaits the
// same function; none proceeds past it until all `parties` have arrived, so two
// concurrent admit()/resumeRun() callers are provably both inside the race
// window before either enters the admission mutex.
export function makeRendezvous(parties) {
  let arrived = 0; let release; const gate = new Promise((r) => { release = r; });
  return async () => { if (++arrived >= parties) release(); await gate; };
}

// ---------- virtual clock (no real timers) ----------

export function virtualClock(start = 0) {
  const state = { now: start, timers: [], nextId: 1 };
  const clock = {
    setTimeout(fn, ms) {
      const id = state.nextId++;
      state.timers.push({ id, at: state.now + Math.max(0, Number(ms) || 0), fn });
      return id;
    },
    clearTimeout(id) {
      const i = state.timers.findIndex((t) => t.id === id);
      if (i >= 0) state.timers.splice(i, 1);
    }
  };
  async function flushMicrotasks(rounds = 50) {
    for (let i = 0; i < rounds; i++) await Promise.resolve();
  }
  async function tick() {
    if (!state.timers.length) return false;
    state.timers.sort((a, b) => a.at - b.at || a.id - b.id);
    const next = state.timers.shift();
    state.now = Math.max(state.now, next.at);
    next.fn();
    await flushMicrotasks();
    return true;
  }
  async function tickAll({ max = 200 } = {}) {
    let count = 0;
    while (state.timers.length && count++ < max) await tick();
    return count;
  }
  return { clock, state, tick, tickAll, flushMicrotasks, now: () => state.now, pending: () => state.timers.length };
}

// Await `promise` while repeatedly firing the earliest pending virtual timer,
// so watchdog/interrupt/exit-wait bounds resolve deterministically without
// any real setTimeout standing in for test *logic* (deadlines, waits). The
// only real-timer use here is a zero-delay `setImmediate` yield so genuine
// pending Node I/O — the admission-mutex/lease named pipes in src/pipes.mjs,
// which are not clock-injectable — gets a turn to complete; it never gates
// test timing/assertions, only lets already-ready OS callbacks run.
export async function driveToSettled(promise, vc, { maxTicks = 500, maxIoYields = 200 } = {}) {
  let settled = false, outcome;
  promise.then((value) => { settled = true; outcome = { ok: true, value }; }, (error) => { settled = true; outcome = { ok: false, error }; });
  await vc.flushMicrotasks();
  let ticks = 0, ioYields = 0;
  while (!settled && ticks < maxTicks && ioYields < maxIoYields) {
    // Always yield one real event-loop turn per iteration so concurrent
    // test-side watchers (ledger pollers, answer writers) interleave 1:1
    // with virtual-time advancement instead of being starved by a pure
    // microtask/tick spin. The yield never gates timing assertions — the
    // clock only advances via vc.tick() below.
    await new Promise((resolve) => setImmediate(resolve));
    await vc.flushMicrotasks();
    if (settled) break;
    const advanced = await vc.tick();
    if (advanced) ticks++; else ioYields++;
  }
  if (!settled) throw new Error(`driveToSettled: promise did not settle (ticks=${ticks}, ioYields=${ioYields}, pending timers=${vc.pending()})`);
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

// ---------- fake signal source ----------

export function fakeSignalSource() { return new EventEmitter(); }

// ---------- SDK message builders ----------

export const toolUseBlock = (id, name, input = {}) => ({ type: 'tool_use', id, name, input });
export const textBlock = (text) => ({ type: 'text', text });
export const toolResultBlock = (toolUseId, content = 'ok') => ({ type: 'tool_result', tool_use_id: toolUseId, content });

export const initMessage = ({ sessionId = 'sess-1', tools = ['mcp__conductor__ask_operator'], model = 'claude-fake', claudeCodeVersion = '9.9.9', ...rest } = {}) => ({
  type: 'system', subtype: 'init', session_id: sessionId, uuid: `u-${sessionId}`, tools, model,
  claude_code_version: claudeCodeVersion, apiKeySource: 'user', cwd: process.cwd(), mcp_servers: [],
  permissionMode: 'default', slash_commands: [], output_style: 'default', skills: [], plugins: [], ...rest
});

export const assistantMessage = ({ sessionId = 'sess-1', content = [], ...rest } = {}) => ({
  type: 'assistant', session_id: sessionId, uuid: `u-${Math.random()}`, message: { role: 'assistant', content }, ...rest
});

export const userToolResultMessage = ({ sessionId = 'sess-1', toolUseId, content = 'ok', ...rest } = {}) => ({
  type: 'user', session_id: sessionId, uuid: `u-${Math.random()}`, message: { role: 'user', content: [toolResultBlock(toolUseId, content)] }, ...rest
});

export const statusMessage = ({ sessionId = 'sess-1', status = null, ...rest } = {}) => ({
  type: 'system', subtype: 'status', status, session_id: sessionId, uuid: `u-${Math.random()}`, ...rest
});

export const sessionStateChangedMessage = ({ sessionId = 'sess-1', state = 'idle', ...rest } = {}) => ({
  type: 'system', subtype: 'session_state_changed', state, session_id: sessionId, uuid: `u-${Math.random()}`, ...rest
});

export const RESULT_ERROR_SUBTYPES = ['error_during_execution', 'error_max_turns', 'error_max_budget_usd', 'error_max_structured_output_retries'];

export const resultSuccess = ({ sessionId = 'sess-1', structuredOutput, numTurns = 1, durationMs = 1, totalCostUsd = 0, usage = { input_tokens: 1, output_tokens: 1 }, modelUsage = {}, stopReason = null, ...rest } = {}) => ({
  type: 'result', subtype: 'success', duration_ms: durationMs, duration_api_ms: durationMs, is_error: false,
  num_turns: numTurns, result: 'ok', stop_reason: stopReason, total_cost_usd: totalCostUsd, usage, modelUsage,
  permission_denials: [], structured_output: structuredOutput, session_id: sessionId, uuid: `u-${Math.random()}`, ...rest
});

export const resultError = (subtype, { sessionId = 'sess-1', errors = ['boom'], numTurns = 0, durationMs = 0, totalCostUsd = 0, usage = { input_tokens: 0, output_tokens: 0 }, modelUsage = {}, stopReason = null, ...rest } = {}) => ({
  type: 'result', subtype, duration_ms: durationMs, duration_api_ms: durationMs, is_error: true, num_turns: numTurns,
  stop_reason: stopReason, total_cost_usd: totalCostUsd, usage, modelUsage, permission_denials: [], errors,
  session_id: sessionId, uuid: `u-${Math.random()}`, ...rest
});

// ---------- pseudo-script entries (gate plumbing) ----------
// These are consumed by the fake iterator itself: it calls the *production*
// options.canUseTool / options.hooks.PreToolUse hook that runSession wired
// up, records the outcome in the interceptor log, and does NOT yield the
// entry to the runSession message loop.

// C11/HARNESS-2: the Claude Agent SDK type `McpSdkServerConfigWithInstance`
// (sdk.d.ts) exposes `.instance` (an `McpServer`) but NO public accessor for
// invoking a registered tool by name — there is no `callTool` and no handler
// getter on the config or the instance. Reaching the production-created
// `ask_operator` handler therefore requires SDK-private state
// (`instance._registeredTools`). We isolate that single private access here and
// assert the exact shape we depend on, so an SDK upgrade that renames/moves it
// fails loudly instead of silently skipping the real handler path.
export function askOperatorHandler(options) {
  const server = options?.mcpServers?.conductor;
  assert.ok(server && typeof server === 'object', 'C11: conductor MCP server config must be present on options.mcpServers');
  assert.ok(server.instance && typeof server.instance === 'object', 'C11: McpSdkServerConfigWithInstance.instance must be present (per sdk.d.ts)');
  const registered = server.instance._registeredTools;
  assert.ok(registered && typeof registered === 'object', 'C11: SDK-private instance._registeredTools missing — shape drift vs the version this harness pins');
  const registration = registered.ask_operator;
  assert.ok(registration && typeof registration.handler === 'function', 'C11: ask_operator must be registered with a callable handler');
  return registration.handler;
}

// A script entry that makes the fake iterator's next() THROW when reached,
// modelling an SDK query that rejects mid-stream (C7 query-throw).
export const throwNext = (message = 'stream-boom') => ({ kind: 'throw', message });

export const invokeCanUseTool = (toolName, input, toolUseID) => ({ kind: 'invokeCanUseTool', toolName, input, toolUseID });
export const invokePreToolUse = (toolName, input, toolUseID) => ({ kind: 'invokePreToolUse', toolName, input, toolUseID });
// Drives the real ask_operator MCP tool handler wired into
// options.mcpServers.conductor (an in-process SDK server built by
// createOperatorChannel), so the "MCP tool result delivered" path executes
// for real end to end, not just waitForAnswer in isolation. `resultBox`, if
// given, receives {resolved, value} once the handler settles (it may hang,
// e.g. while the run is parked awaiting the operator's answer).
export const invokeAskOperator = (payload, resultBox) => ({ kind: 'invokeAskOperator', payload, resultBox });
// Serialization point: the fake iterator's next() call blocks here (without
// any real timer) until the ask_operator handler settles, so the script
// only yields subsequent messages once the operator has actually answered
// (or the handler has parked). Lets tests assert the watchdog stays
// suspended for the whole operator_wait window and that no message is
// produced out of order.
export const awaitAskOperator = (resultBox) => ({ kind: 'awaitAskOperator', resultBox });
// Advances the shared virtual clock by `ms` before the next scripted message
// is yielded — lets tests interleave virtual time between messages so
// deadline-reset behavior (which message types refresh the watchdog phase
// deadline) is actually distinguishable.
export const advanceVirtual = (vc, ms) => ({ kind: 'advanceVirtual', vc, ms });

// ---------- fake query() ----------

// script: array of SDK messages and/or pseudo-entries (processed in order).
// hangNext/hangInterrupt/hangReturn: make that primitive never resolve.
// log: shared array; every close/interrupt/return/next-yield/gate-call is
// pushed in call order so sequence assertions (file->close->exit->ledger)
// are real, not assumed.
export function createFakeQuery({ script = [], hangNext = false, hangInterrupt = false, hangReturn = false, log = [], onCreate } = {}) {
  const created = [];
  function fakeQueryFn({ prompt, options }) {
    let index = 0;
    const record = (event, data) => log.push({ event, data });
    async function processPseudo(entry) {
      if (entry.kind === 'invokeCanUseTool') {
        const result = await options.canUseTool?.(entry.toolName, entry.input, { toolUseID: entry.toolUseID });
        record('canUseTool', { toolName: entry.toolName, toolUseID: entry.toolUseID, result });
        return result;
      }
      if (entry.kind === 'invokePreToolUse') {
        const hook = options.hooks?.PreToolUse?.[0]?.hooks?.[0];
        const result = await hook?.({ tool_name: entry.toolName, tool_input: entry.input, tool_use_id: entry.toolUseID });
        record('PreToolUse', { toolName: entry.toolName, toolUseID: entry.toolUseID, result });
        return result;
      }
      if (entry.kind === 'invokeAskOperator') {
        const handler = askOperatorHandler(options);
        record('askOperator:call', { payload: entry.payload });
        const promise = handler(entry.payload, {});
        promise.then((value) => { record('askOperator:resolved', { value }); if (entry.resultBox) { entry.resultBox.resolved = true; entry.resultBox.value = value; } },
          (error) => { record('askOperator:rejected', { error: String(error?.message ?? error) }); if (entry.resultBox) { entry.resultBox.resolved = true; entry.resultBox.error = error; } });
        if (entry.resultBox) entry.resultBox.promise = promise;
        // Do not await: the handler may hang (park) until an answer file
        // appears. The script must move on to yield the next message so the
        // runSession main loop keeps racing next()/parkSignal/watchdog.
        return undefined;
      }
      if (entry.kind === 'advanceVirtual') {
        await new Promise((resolve) => entry.vc.clock.setTimeout(resolve, entry.ms));
        record('advanced', { ms: entry.ms, now: entry.vc.now() });
        return undefined;
      }
      if (entry.kind === 'awaitAskOperator') {
        await entry.resultBox.promise;
        record('askOperator:awaited', { value: entry.resultBox.value });
        return entry.resultBox.value;
      }
      return undefined;
    }
    const iterator = {
      async next() {
        // hangNext: once the script is exhausted, next() never settles —
        // models an SDK stall mid-turn so only the watchdog can terminate.
        while (index < script.length) {
          const entry = script[index++];
          if (entry?.kind === 'throw') { record('throw', { message: entry.message }); throw new Error(entry.message); }
          if (['invokeCanUseTool', 'invokePreToolUse', 'invokeAskOperator', 'awaitAskOperator', 'advanceVirtual'].includes(entry?.kind)) { await processPseudo(entry); continue; }
          record('yield', entry);
          return { value: entry, done: false };
        }
        if (hangNext) return new Promise(() => {});
        return { value: undefined, done: true };
      },
      async return(value) {
        record('return', value);
        if (hangReturn) return new Promise(() => {});
        return { value, done: true };
      },
      async interrupt() {
        record('interrupt', null);
        if (hangInterrupt) return new Promise(() => {});
        return { subtype: 'interrupt' };
      },
      close() { record('close', null); },
      setPermissionMode: async () => {},
      [Symbol.asyncIterator]() { return iterator; }
    };
    created.push({ prompt, options, iterator });
    onCreate?.({ prompt, options, iterator });
    return iterator;
  }
  fakeQueryFn.created = created;
  fakeQueryFn.log = log;
  return fakeQueryFn;
}

// ---------- deps builder ----------

export function buildDeps(vc, overrides = {}) {
  const signalSource = overrides.signalSource ?? fakeSignalSource();
  return {
    now: () => vc.state.now,
    sleep: (ms) => new Promise((resolve) => vc.clock.setTimeout(resolve, ms)),
    timerClock: vc.clock,
    signalSource,
    identity: 'fake-sdk-test',
    ...overrides
  };
}
