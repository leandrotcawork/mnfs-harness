// Fix-round-2 tests: drive the production entry points (runSession/
// resumeRun) through the injectable fake-sdk harness (test/helpers/fake-sdk.mjs)
// instead of poking at internal helpers. Each test name below cites the
// v2-code-r2.md finding(s) it resolves.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { runSession, resumeRun, recoverRun, statePaths, loadRoles, main } from '../src/conductor.mjs';
import { appendEvent, readEvents, runState } from '../src/registry.mjs';
import { writeAnswer } from '../src/questions.mjs';
import { pipeNames, acquireLease, probePipe } from '../src/pipes.mjs';
import { transcriptSnapshot, startViewer } from '../src/viewer.mjs';
import * as fake from './helpers/fake-sdk.mjs';

const REPO_ROOT = execFileSync('git', ['-C', process.cwd(), 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-fake-'));

function fastRoles(dir, overrides = {}) {
  const rolesPath = path.join(dir, 'roles.json');
  fs.writeFileSync(rolesPath, JSON.stringify({
    writer: {
      tools: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'], allowedTools: [],
      disallowed: ['Task', 'TodoWrite', 'WebFetch', 'WebSearch', 'AskUserQuestion'],
      bashMatrix: [['git', '--no-pager', 'status']], maxTurns: 200,
      toolTimeoutMs: 50, modelWaitTimeoutMs: 50, ...overrides
    }
  }));
  return rolesPath;
}

function writeCard(dir, overrides = {}) {
  const cardPath = path.join(dir, 'card.json');
  const card = { id: 'f-test', feature: 'f-test', role: 'writer', worktree: REPO_ROOT, repoRoot: REPO_ROOT, model: 'claude-fake', ...overrides };
  fs.writeFileSync(cardPath, JSON.stringify(card));
  return cardPath;
}

async function run({ script, deps: depsOverrides = {}, cardOverrides = {}, rolesOverrides = {}, log = [], hangNext, hangInterrupt, hangReturn }) {
  const dir = tmp(); const stateDir = path.join(dir, 'state');
  const rolesPath = fastRoles(dir, rolesOverrides);
  const cardPath = writeCard(dir, cardOverrides);
  const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
  const vc = fake.virtualClock();
  if (typeof script === 'function') script = script(vc);
  const queryFn = fake.createFakeQuery({ script, log, hangNext, hangInterrupt, hangReturn });
  const deps = fake.buildDeps(vc, depsOverrides);
  const runId = randomUUID();
  const paths = statePaths(stateDir, runId);
  const promise = runSession({ runId, card, cardPath, stateDir, rolesPath, queryFn, deps });
  return { promise, vc, log, stateDir, rolesPath, cardPath, card, deps, paths, runId };
}

test('T1/BLOCKER init-gate: no tool authorized and no denial/session_bound events exist before system/init is observed', async () => {
  const { promise, vc, log, paths } = await run({
    script: [
      fake.invokeCanUseTool('Write', { file_path: 'x.txt' }, 'tu-1'),
      fake.invokePreToolUse('Read', { file_path: 'x.txt' }, 'tu-2'),
      fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }),
      fake.resultSuccess({ structuredOutput: { status: 'completed' } })
    ]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  const gateCalls = log.filter((e) => e.event === 'canUseTool' || e.event === 'PreToolUse');
  assert.equal(gateCalls.length, 2);
  assert.equal(gateCalls[0].data.result.behavior, 'deny');
  assert.equal(gateCalls[0].data.result.message, 'NOT-INITIALIZED');
  assert.equal(gateCalls[1].data.result.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(gateCalls[1].data.result.hookSpecificOutput.permissionDecisionReason, 'NOT-INITIALIZED');
  const events = readEvents(paths.ledger);
  // #1 residue: 'started' is the true first ledger event — nothing (denials,
  // session_bound, questions) may precede it.
  assert.equal(events[0].event, 'started');
  assert.equal(events.findIndex((e) => e.event === 'denial') > 0, true);
  assert.ok(events.findIndex((e) => e.event === 'denial') < events.findIndex((e) => e.event === 'session_bound'), 'pre-init denials are audited before the session is bound');
  const denials = events.filter((e) => e.event === 'denial');
  assert.equal(denials.length, 2);
  assert.ok(denials.every((e) => e.reason === 'NOT-INITIALIZED'));
  assert.equal(result.state, 'completed');
});

test('#22 missing tool_use_id on an otherwise-allowed tool is denied fail-closed and audited', async () => {
  const { promise, vc, log, paths } = await run({
    script: [
      fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }),
      fake.invokeCanUseTool('Read', { file_path: path.join(REPO_ROOT, 'roles.json') }, undefined),
      fake.resultSuccess({ structuredOutput: { status: 'completed' } })
    ]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  const call = log.find((e) => e.event === 'canUseTool');
  assert.equal(call.data.result.behavior, 'deny');
  assert.equal(call.data.result.message, 'MISSING-TOOL-USE-ID');
  const denial = readEvents(paths.ledger).find((e) => e.event === 'denial' && /MISSING-TOOL-USE-ID/.test(e.reason));
  assert.ok(denial);
  assert.equal(denial.failClosed, true);
});

test('gate allows SDK-internal StructuredOutput tool', async () => {
  const { promise, vc, log, paths } = await run({
    script: [
      fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }),
      fake.invokeCanUseTool('StructuredOutput', { status: 'completed' }, 'tu-so-1'),
      fake.invokePreToolUse('StructuredOutput', { status: 'completed' }, 'tu-so-2'),
      fake.invokeCanUseTool('StructuredOutput', { status: 'completed' }, undefined),
      fake.resultSuccess({ structuredOutput: { status: 'completed' } })
    ]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  const gateCalls = log.filter((e) => e.event === 'canUseTool' || e.event === 'PreToolUse');
  assert.equal(gateCalls.length, 3);
  assert.equal(gateCalls[0].data.result.behavior, 'allow');
  assert.deepEqual(gateCalls[1].data.result, {});
  assert.equal(gateCalls[2].data.result.behavior, 'deny');
  assert.equal(gateCalls[2].data.result.message, 'MISSING-TOOL-USE-ID');
  const denials = readEvents(paths.ledger).filter((e) => e.event === 'denial');
  assert.equal(denials.length, 1);
  assert.ok(/MISSING-TOOL-USE-ID/.test(denials[0].reason));
  assert.equal(result.state, 'completed');
});

test('T6a init-without-ask_operator: zero tool executions and failed(tool-inventory)', async () => {
  const { promise, vc, log, paths } = await run({
    script: [
      fake.initMessage({ tools: [] }),
      fake.invokeCanUseTool('Write', { file_path: 'x' }, 'tu-1'), // unreachable: loop returns before another next()
      fake.resultSuccess({})
    ]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'failed');
  assert.equal(result.receipt.reason, 'tool-inventory');
  assert.equal(log.filter((e) => e.event === 'canUseTool' || e.event === 'PreToolUse').length, 0);
  assert.equal(readEvents(paths.ledger).filter((e) => e.event === 'denial').length, 0);
});

test('T6b no-init-before-result: zero tool executions and failed(tool-inventory)', async () => {
  const { promise, vc, log, paths } = await run({
    script: [fake.resultSuccess({ structuredOutput: { status: 'completed' } })]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'failed');
  assert.equal(result.receipt.reason, 'tool-inventory');
  assert.equal(log.filter((e) => e.event === 'canUseTool' || e.event === 'PreToolUse').length, 0);
  assert.equal(readEvents(paths.ledger).some((e) => e.event === 'session_bound'), false);
});

test('T3 full ask_operator protocol: MCP result delivered, question/answer audits, no park on fast path, watchdog suspended through operator_wait', async () => {
  const box = {};
  // C12/HARNESS-4: the operator answer is written from the production onQuestion
  // sequencing hook (fired the instant the question event commits) — a
  // deterministic injected point, not a setImmediate poll racing the clock.
  const { promise, vc, log, paths } = await run({
    rolesOverrides: { modelWaitTimeoutMs: 25, toolTimeoutMs: 25 },
    deps: { onQuestion: ({ questionId, paths }) => writeAnswer(path.join(paths.answers, `${questionId}.json`), questionId, 'the answer') },
    script: [
      fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }),
      fake.assistantMessage({ content: [fake.textBlock('thinking')] }),
      fake.invokeAskOperator({ question: 'need input' }, box),
      fake.awaitAskOperator(box),
      fake.assistantMessage({ content: [fake.textBlock('thanks')] }),
      fake.resultSuccess({ structuredOutput: { status: 'completed', summary: 'done' } })
    ]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'completed');
  const events = readEvents(paths.ledger);
  assert.ok(events.some((e) => e.event === 'question'), 'question event recorded');
  assert.ok(events.some((e) => e.event === 'answer_applied'), 'answer_applied audit recorded');
  assert.equal(events.some((e) => e.event === 'waiting_operator'), false, 'fast-path answer must never park');
  assert.equal(events.some((e) => e.event === 'watchdog_kill'), false, 'watchdog must stay suspended during operator_wait');
  const askCall = log.find((e) => e.event === 'askOperator:resolved');
  assert.equal(askCall.data.value.content[0].text, 'the answer');
});

test('T3b park path: SDK never settles after ask_operator hangs -> waiting_operator, not investigate', async () => {
  const box = {};
  const { promise, vc, paths } = await run({
    cardOverrides: { questionTimeoutMs: 20 },
    rolesOverrides: { modelWaitTimeoutMs: 5000, toolTimeoutMs: 5000 },
    hangNext: true, // SDK is "busy inside the tool call": next() stays pending
    script: [
      fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }),
      fake.invokeAskOperator({ question: 'need input' }, box)
      // no further entries: waitForAnswer will time out (20ms virtual) and park.
    ]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'waiting_operator');
  assert.equal(readEvents(paths.ledger).some((e) => e.event === 'watchdog_kill'), false);
});

test('T7 watchdog through runSession: virtual phase deadline, non-settling next/interrupt/return, worst-case termination <15s virtual, generic messages do not reset deadline', async () => {
  const { promise, vc, paths } = await run({
    rolesOverrides: { modelWaitTimeoutMs: 1000, toolTimeoutMs: 1000 },
    hangNext: true,      // after the script, next() never settles (SDK stall)
    hangInterrupt: true, // interrupt() never resolves -> bounded() must time out
    hangReturn: true,    // return() never resolves -> exit-wait must time out too
    script: (vc) => [
      fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }),
      // #14: generic/system chatter with virtual time in between must NOT
      // reset the model_wait deadline. If status messages reset it, the kill
      // would land at 1900 virtual, not 1000.
      fake.advanceVirtual(vc, 900),
      fake.statusMessage(),
      fake.advanceVirtual(vc, 900)
    ]
  });
  const t0 = vc.now();
  const result = await fake.driveToSettled(promise, vc, { maxTicks: 2000 });
  result.lease?.close?.();
  const elapsed = vc.now() - t0;
  assert.equal(result.state, 'investigate');
  assert.equal(result.receipt.reason, 'watchdog');
  const events = readEvents(paths.ledger);
  const kill = events.find((e) => e.event === 'watchdog_kill');
  assert.ok(kill, 'watchdog_kill event recorded');
  assert.equal(kill.data.interruptOutcome, 'timeout');
  // Worst case after the deadline fires: WATCHDOG_INTERRUPT_MS(4500) +
  // EXIT_WAIT_MS(10000) = 14500ms < 15000ms.
  const killAt = elapsed - 14_500;
  assert.ok(killAt <= 1_100, `watchdog must fire at the original 1000ms deadline (status must not reset it); fired at ~${killAt}ms`);
  assert.ok(elapsed - killAt < 15_000, `virtual termination time after kill must be <15000ms, got ${elapsed - killAt}ms`);
  assert.ok(elapsed >= 14_500, `expected termination to consume both bounded windows, got ${elapsed}ms total`);
});

test('T7b watchdog fires on a hung next() (SDK stalls mid-turn) — non-settling next()', async () => {
  const { promise, vc, paths } = await run({
    rolesOverrides: { modelWaitTimeoutMs: 200, toolTimeoutMs: 200 },
    hangNext: true,
    hangInterrupt: false,
    script: [fake.initMessage({ tools: ['mcp__conductor__ask_operator'] })]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'investigate');
  assert.equal(result.receipt.reason, 'watchdog');
  assert.ok(readEvents(paths.ledger).some((e) => e.event === 'watchdog_kill' && e.data.interruptOutcome === 'ok'));
});

test('#21 signal listeners never leak across runSession calls', async () => {
  const signalSource = fake.fakeSignalSource();
  const { promise, vc } = await run({
    deps: { signalSource },
    script: [fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }), fake.resultSuccess({ structuredOutput: { status: 'completed' } })]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(signalSource.listenerCount('SIGINT'), 0);
  assert.equal(signalSource.listenerCount('SIGTERM'), 0);
});

test('#21 SIGINT force-closes the transport immediately instead of only resolving a promise', async () => {
  const signalSource = fake.fakeSignalSource();
  // C12/HARNESS-4: the SIGINT is emitted from the onSessionBound hook — fired
  // right after session_bound commits, which is strictly after runSession has
  // attached its signal listener and set queryRef.current. Deterministic
  // ordering (signal lands mid-run, listener present) without a listenerCount
  // poll spin.
  const { promise, vc, log, paths } = await run({
    deps: { signalSource, onSessionBound: () => { assert.ok(signalSource.listenerCount('SIGINT') > 0, 'SIGINT listener attached before signal'); signalSource.emit('SIGINT'); } },
    rolesOverrides: { modelWaitTimeoutMs: 10_000, toolTimeoutMs: 10_000 },
    hangNext: true,
    script: [fake.initMessage({ tools: ['mcp__conductor__ask_operator'] })] // then hangs on next()
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'cancelled');
  assert.equal(result.receipt.reason, 'SIGINT');
  assert.ok(log.some((e) => e.event === 'close'), 'signal handler must call close() on the transport');
  assert.equal(readEvents(paths.ledger).at(-1).event, 'cancelled');
});

test('#19 occupied pipe with a malformed manifest still counts toward the admission cap (fail-closed)', async () => {
  const dir = tmp(); const stateDir = path.join(dir, 'state');
  const rolesPath = fastRoles(dir);
  const root = fs.realpathSync.native(REPO_ROOT);
  const ghostId = randomUUID();
  const ghostPaths = statePaths(stateDir, ghostId);
  fs.mkdirSync(path.dirname(ghostPaths.manifest), { recursive: true });
  fs.writeFileSync(ghostPaths.manifest, 'not valid json{{{');
  const ghostLease = await acquireLease(pipeNames(root, ghostId, 'fake-sdk-test').lease, { identity: 'fake-sdk-test' });
  const secondId = randomUUID();
  const secondPaths = statePaths(stateDir, secondId);
  fs.mkdirSync(path.dirname(secondPaths.manifest), { recursive: true });
  fs.writeFileSync(secondPaths.manifest, JSON.stringify({ runId: secondId, canonicalCwd: root }));
  const secondLease = await acquireLease(pipeNames(root, secondId, 'fake-sdk-test').lease, { identity: 'fake-sdk-test' });
  try {
    const cardPath = writeCard(dir);
    const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
    const vc = fake.virtualClock();
    const queryFn = fake.createFakeQuery({ script: [fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }), fake.resultSuccess({ structuredOutput: { status: 'completed' } })] });
    const deps = fake.buildDeps(vc, { identity: 'fake-sdk-test' });
    const runId = randomUUID();
    const promise = runSession({ runId, card, cardPath, stateDir, rolesPath, queryFn, deps });
    await assert.rejects(fake.driveToSettled(promise, vc), /ADMISSION-FULL/);
  } finally { ghostLease.close(); secondLease.close(); }
});

test('#23 wildcard mcp__* in role.disallowed is recognized as disallowing the conductor tool', () => {
  const dir = tmp();
  const rolesPath = path.join(dir, 'roles.json');
  fs.writeFileSync(rolesPath, JSON.stringify({ x: { tools: [], disallowed: ['mcp__*'] } }));
  assert.throws(() => loadRoles(rolesPath), /conductor MCP tool disallowed/);
});

test('#23 GATED_TOOLS includes NotebookEdit', () => {
  const dir = tmp();
  const rolesPath = path.join(dir, 'roles.json');
  fs.writeFileSync(rolesPath, JSON.stringify({ x: { tools: [], allowedTools: ['NotebookEdit'] } }));
  assert.throws(() => loadRoles(rolesPath), /gated tool/);
});

test('T5 resumeRun: rejects when run state is not waiting_operator (R-state violation)', async () => {
  const dir = tmp(); const stateDir = path.join(dir, 'state');
  const rolesPath = fastRoles(dir);
  const cardPath = writeCard(dir);
  const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
  const vc = fake.virtualClock();
  const queryFn = fake.createFakeQuery({ script: [fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }), fake.resultSuccess({ structuredOutput: { status: 'completed' } })] });
  const deps = fake.buildDeps(vc);
  const runId = randomUUID();
  const first = await fake.driveToSettled(runSession({ runId, card, cardPath, stateDir, rolesPath, queryFn, deps }), vc);
  first.lease?.close?.();
  assert.equal(first.state, 'completed');
  const vc2 = fake.virtualClock();
  const deps2 = fake.buildDeps(vc2);
  await assert.rejects(fake.driveToSettled(resumeRun({ stateDir, runId, queryFn: fake.createFakeQuery({ script: [] }), deps: deps2 }), vc2), /not waiting_operator/);
});

test('T5b resumeRun: resume cap terminalizes to investigate(resume-cap) after two prior resumes', async () => {
  const dir = tmp(); const stateDir = path.join(dir, 'state');
  const rolesPath = fastRoles(dir);
  const cardPath = writeCard(dir, { questionTimeoutMs: 20 });
  const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
  let runId = randomUUID();
  const box = {};
  // Cycle 1: park.
  {
    const vc = fake.virtualClock();
    const deps = fake.buildDeps(vc);
    const queryFn = fake.createFakeQuery({ hangNext: true, script: [fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }), fake.invokeAskOperator({ question: 'q1' }, box)] });
    const r = await fake.driveToSettled(runSession({ runId, card, cardPath, stateDir, rolesPath, queryFn, deps }), vc);
    r.lease?.close?.();
    assert.equal(r.state, 'waiting_operator');
  }
  const paths = statePaths(stateDir, runId);
  // Answer + resume cycles 2 and 3, parking again each time (own questions),
  // to legitimately advance countResumes(events) to 2 before the cap check.
  for (let cycle = 0; cycle < 2; cycle++) {
    const q = readEvents(paths.ledger).filter((e) => e.event === 'question').at(-1);
    writeAnswer(path.join(paths.answers, `${q.questionId}.json`), q.questionId, `a${cycle}`);
    const vc = fake.virtualClock();
    const deps = fake.buildDeps(vc);
    const nextBox = {};
    const queryFn = fake.createFakeQuery({ hangNext: true, script: [fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }), fake.invokeAskOperator({ question: `q${cycle + 2}` }, nextBox)] });
    const r = await fake.driveToSettled(resumeRun({ stateDir, runId, queryFn, deps }), vc);
    r.lease?.close?.();
    assert.equal(r.state, 'waiting_operator');
  }
  assert.equal(readEvents(paths.ledger).filter((e) => e.event === 'resumed').length, 2);
  // Third resume attempt must hit the cap. A4/R3-N3: prove the lease was LIVE
  // at the instant investigate(resume-cap) commits. Pause the resume-cap
  // terminalization at its pre-commit barrier and probe the run's lease pipe
  // from outside — it must read OCCUPIED because the admission lease this
  // attempt just acquired is still held while the terminal event is written.
  const q = readEvents(paths.ledger).filter((e) => e.event === 'question').at(-1);
  writeAnswer(path.join(paths.answers, `${q.questionId}.json`), q.questionId, 'final');
  const vc = fake.virtualClock();
  const barrier = fake.makeBarrier();
  const release = barrier.pauseAt('pre-commit', 'terminal:investigate');
  const deps = fake.buildDeps(vc, { barrier });
  const root = fs.realpathSync.native(REPO_ROOT);
  let leaseOccupiedAtCommit = null;
  const orchestrate = (async () => {
    await barrier.waitForHit('pre-commit', 'terminal:investigate');
    leaseOccupiedAtCommit = (await probePipe(pipeNames(root, runId, deps.identity).lease)).occupied;
    release();
  })();
  const queryFn = fake.createFakeQuery({ script: [] });
  const [capResult] = await Promise.allSettled([fake.driveToSettled(resumeRun({ stateDir, runId, queryFn, deps }), vc), orchestrate]);
  assert.equal(capResult.status, 'rejected');
  assert.match(String(capResult.reason?.message ?? capResult.reason), /resume cap/);
  assert.equal(leaseOccupiedAtCommit, true, 'lease pipe must be live at the moment investigate(resume-cap) is committed');
  const events = readEvents(paths.ledger);
  assert.ok(events.some((e) => e.event === 'investigate' && e.reason === 'resume-cap'));
  const capIndex = events.findIndex((e) => e.event === 'investigate' && e.reason === 'resume-cap');
  assert.ok(capIndex > events.findIndex((e) => e.event === 'resumed'));
  // P3 r5: the resume-cap SYNTHESIZED receipt captures fingerprintEnd from the
  // run's manifest (which, like every production manifest, carries
  // cardPath/rolesPath) — never a silent null.
  const capReceipt = JSON.parse(fs.readFileSync(paths.receipt, 'utf8'));
  assert.equal(capReceipt.reason, 'resume-cap');
  assert.ok(capReceipt.fingerprintEnd && typeof capReceipt.fingerprintEnd === 'object', 'resume-cap synth receipt captures fingerprintEnd');
  assert.equal(typeof capReceipt.fingerprintEnd.head, 'string');
});

test('T5c/A3 simultaneous resume: barrier-raced admission, exactly one winner, loser deterministically RUN-OCCUPIED', async () => {
  const dir = tmp(); const stateDir = path.join(dir, 'state');
  const rolesPath = fastRoles(dir);
  const cardPath = writeCard(dir, { questionTimeoutMs: 20 });
  const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
  const runId = randomUUID();
  const box = {};
  // Park the run so it is waiting_operator (no answer -> questionTimeout park).
  const vc0 = fake.virtualClock();
  const deps0 = fake.buildDeps(vc0);
  const first = await fake.driveToSettled(runSession({ runId, card, cardPath, stateDir, rolesPath, queryFn: fake.createFakeQuery({ hangNext: true, script: [fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }), fake.invokeAskOperator({ question: 'q' }, box)] }), deps: deps0 }), vc0);
  first.lease?.close?.();
  const paths = statePaths(stateDir, runId);
  const q = readEvents(paths.ledger).find((e) => e.event === 'question');
  writeAnswer(path.join(paths.answers, `${q.questionId}.json`), q.questionId, 'yes');
  // R3-N2: both resume attempts block on a shared 2-party rendezvous inside
  // admit() BEFORE either enters the admission mutex, so they are provably in
  // the race window simultaneously (not scheduler-lucky ordering). The winner's
  // session completes but the test holds its lease open, so the loser is
  // deterministically refused at lease acquisition with RUN-OCCUPIED — a single
  // definite loser mode, not the two the previous test tolerated.
  const rendezvous = fake.makeRendezvous(2);
  const vcA = fake.virtualClock(), vcB = fake.virtualClock();
  const depsA = fake.buildDeps(vcA, { admissionRendezvous: rendezvous });
  const depsB = fake.buildDeps(vcB, { admissionRendezvous: rendezvous });
  const winScript = () => fake.createFakeQuery({ script: [fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }), fake.resultSuccess({ structuredOutput: { status: 'completed' } })] });
  const attemptA = fake.driveToSettled(resumeRun({ stateDir, runId, queryFn: winScript(), deps: depsA }), vcA);
  const attemptB = fake.driveToSettled(resumeRun({ stateDir, runId, queryFn: winScript(), deps: depsB }), vcB);
  const settled = await Promise.allSettled([attemptA, attemptB]);
  const fulfilled = settled.filter((s) => s.status === 'fulfilled');
  const rejected = settled.filter((s) => s.status === 'rejected');
  assert.equal(fulfilled.length, 1, 'exactly one concurrent resume attempt wins');
  assert.equal(rejected.length, 1);
  assert.equal(fulfilled[0].value.state, 'completed');
  fulfilled[0].value.lease?.close?.();
  assert.match(String(rejected[0].reason?.message ?? rejected[0].reason), /RUN-OCCUPIED/);
  assert.equal(readEvents(paths.ledger).filter((e) => e.event === 'resumed').length, 1);
});

test('T8 every SDKResultError subtype terminalizes investigate(<subtype>) through runSession', async () => {
  for (const subtype of fake.RESULT_ERROR_SUBTYPES) {
    const { promise, vc, paths } = await run({
      script: [fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }), fake.resultError(subtype, { errors: [`err-${subtype}`] })]
    });
    const result = await fake.driveToSettled(promise, vc);
    result.lease?.close?.();
    assert.equal(result.state, 'investigate', subtype);
    assert.equal(result.receipt.reason, subtype);
    assert.equal(result.receipt.resultSubtype, subtype);
    assert.deepEqual(result.receipt.errors, [`err-${subtype}`]);
    assert.equal(readEvents(paths.ledger).at(-1).event, 'investigate');
  }
});

test('T8b success result with schema-invalid structured output -> investigate(invalid-structured-output)', async () => {
  const { promise, vc } = await run({
    script: [fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }), fake.resultSuccess({ structuredOutput: { status: 'nope' } })]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'investigate');
  assert.equal(result.receipt.reason, 'invalid-structured-output');
});

test('T8c stream ends with no result message -> investigate(no-result)', async () => {
  const { promise, vc } = await run({
    script: [fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }), fake.assistantMessage({ content: [fake.textBlock('hi')] })]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'investigate');
  assert.equal(result.receipt.reason, 'no-result');
});

test('T4/#20 clean path: transport closed then exited before terminal ledger event; receipt carries full provenance', async () => {
  const { promise, vc, log, paths } = await run({
    script: [
      fake.initMessage({ tools: ['mcp__conductor__ask_operator'], sessionId: 'sess-t4' }),
      fake.assistantMessage({ content: [fake.textBlock('work')] }),
      fake.resultSuccess({ structuredOutput: { status: 'completed', summary: 's' }, usage: { input_tokens: 7, output_tokens: 3 }, modelUsage: { 'claude-fake': { input_tokens: 7, output_tokens: 3 } }, totalCostUsd: 0.5, numTurns: 4 })
    ]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'completed');
  // Ordering: last yielded message -> close() -> return() (exit observed) and
  // only then the terminal ledger event/receipt.
  const seq = log.map((e) => e.event);
  const lastYield = seq.lastIndexOf('yield');
  assert.ok(lastYield < seq.indexOf('close'), 'close after final message');
  assert.ok(seq.indexOf('close') < seq.indexOf('return'), 'exit-wait (return) after close');
  const events = readEvents(paths.ledger);
  assert.equal(events.at(-1).event, 'completed');
  const receipt = JSON.parse(fs.readFileSync(paths.receipt, 'utf8'));
  assert.equal(receipt.lifecycle, 'completed');
  // #20 completeness on the normal (non-park) path:
  assert.deepEqual(receipt.sessionIds, ['sess-t4']);
  assert.equal(receipt.model, 'claude-fake');
  assert.equal(receipt.sdkVersion, '9.9.9');
  assert.equal(receipt.optionsSnapshot.model, 'claude-fake');
  assert.equal(receipt.optionsSnapshot.permissionMode, 'default');
  assert.ok(receipt.manifestFingerprint?.head, 'manifest fingerprint captured');
  assert.equal(typeof receipt.cardSha256, 'string');
  assert.equal(typeof receipt.rolesSha256, 'string');
  assert.equal(receipt.cumulativeUsage.input_tokens, 7);
  assert.equal(receipt.cumulativeUsage.output_tokens, 3);
  assert.equal(receipt.cumulativeModelUsage['claude-fake'].input_tokens, 7);
  assert.equal(receipt.totalCostUsd, 0.5);
  assert.equal(receipt.numTurns, 4);
  assert.equal(receipt.aggregates.attemptCount, 1);
});

test('T9 recoverRun refuses a terminal run; SIGTERM path terminalizes cancelled first', async () => {
  const dir = tmp(); const stateDir = path.join(dir, 'state');
  const rolesPath = fastRoles(dir);
  const cardPath = writeCard(dir);
  const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
  const runId = randomUUID();
  const vc = fake.virtualClock();
  const signalSource = fake.fakeSignalSource();
  // C12/HARNESS-4: SIGTERM emitted from onSessionBound (deterministic point
  // after the listener is attached), not a session_bound ledger poll.
  const deps = fake.buildDeps(vc, { signalSource, onSessionBound: () => signalSource.emit('SIGTERM') });
  const promise = runSession({ runId, card, cardPath, stateDir, rolesPath, queryFn: fake.createFakeQuery({ hangNext: true, script: [fake.initMessage({ tools: ['mcp__conductor__ask_operator'] })] }), deps });
  const dead = await fake.driveToSettled(promise, vc);
  dead.lease?.close?.();
  assert.equal(dead.state, 'cancelled');
  await assert.rejects(recoverRun({ stateDir, runId, deps: fake.buildDeps(fake.virtualClock()) }), /already terminal/);
});

test('T13 malformed operator answer is audited on the ledger and the wait continues to a good answer', async () => {
  const box = {};
  // C12/HARNESS-4: the two-phase malformed->good sequence is driven by two
  // deterministic injected hooks — onQuestion writes the malformed file, and
  // onMalformedAnswer (fired the instant the malformed_answer audit commits)
  // replaces it with a valid answer. No setImmediate poll waits for the audit.
  let replaced = false;
  const { promise, vc, paths } = await run({
    cardOverrides: { questionTimeoutMs: 5_000 },
    hangNext: true,
    deps: {
      onQuestion: ({ questionId, paths }) => { fs.mkdirSync(paths.answers, { recursive: true }); fs.writeFileSync(path.join(paths.answers, `${questionId}.json`), '{malformed'); },
      onMalformedAnswer: ({ questionId, paths }) => { if (replaced) return; replaced = true; const ap = path.join(paths.answers, `${questionId}.json`); fs.rmSync(ap); writeAnswer(ap, questionId, 'good answer'); }
    },
    script: [
      fake.initMessage({ tools: ['mcp__conductor__ask_operator'] }),
      fake.invokeAskOperator({ question: 'q' }, box),
      fake.awaitAskOperator(box),
      fake.resultSuccess({ structuredOutput: { status: 'completed' } })
    ]
  });
  const result = await fake.driveToSettled(promise, vc, { maxTicks: 5000, maxIoYields: 5000 });
  result.lease?.close?.();
  assert.equal(result.state, 'completed');
  const events = readEvents(paths.ledger);
  assert.ok(events.some((e) => e.event === 'malformed_answer'), 'malformed answer audited');
  assert.ok(events.some((e) => e.event === 'answer_applied'));
});

test('T13b CLI main(): answer/status/usage exit codes', async () => {
  const dir = tmp(); const stateDir = path.join(dir, 'state');
  fs.mkdirSync(path.join(stateDir, 'answers'), { recursive: true });
  assert.equal(await main(['answer', '--state', stateDir, 'q-1', 'hello']), 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(stateDir, 'answers', 'q-1.json'), 'utf8')).text, 'hello');
  assert.equal(await main(['answer', '--state', stateDir, 'q-1', 'again']), 1, 'duplicate answer write fails closed');
  assert.equal(await main(['status', '--state', stateDir]), 0);
  assert.equal(await main(['bogus-cmd']), 1);
  assert.equal(await main(['resume', '--state', stateDir, 'not-a-run-id']), 1);
});

test('#24 transcriptSnapshot presents main and subagent transcripts per bound session', async () => {
  const dir = tmp(); const stateDir = path.join(dir, 'state');
  const runId = randomUUID();
  const runDir = path.join(stateDir, 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify({ runId, feature: 'f', role: 'writer', canonicalCwd: REPO_ROOT }));
  appendEvent(path.join(runDir, 'ledger.jsonl'), { runId, feature: 'f', role: 'writer', cwd: REPO_ROOT, attempt: 1, event: 'started' }, { generation: 1 });
  appendEvent(path.join(runDir, 'ledger.jsonl'), { runId, feature: 'f', role: 'writer', cwd: REPO_ROOT, attempt: 1, event: 'session_bound', sessionId: 'sess-v' }, { generation: 1 });
  const calls = [];
  const snapshot = await transcriptSnapshot(stateDir, {
    sessionReader: async (sessionId, opts) => { calls.push(['session', sessionId, opts.dir]); return [{ role: 'assistant', text: 'main' }]; },
    subagentLister: async (sessionId) => { calls.push(['list', sessionId]); return ['agent-1', 'agent-2']; },
    subagentReader: async (sessionId, agentId) => { calls.push(['sub', sessionId, agentId]); if (agentId === 'agent-2') throw new Error('gone'); return [{ role: 'assistant', text: `sub-${agentId}` }]; }
  });
  const run0 = snapshot.runs.find((r) => r.runId === runId);
  assert.equal(run0.transcripts.length, 1);
  const t = run0.transcripts[0];
  assert.equal(t.sessionId, 'sess-v');
  assert.deepEqual(t.messages, [{ role: 'assistant', text: 'main' }]);
  assert.equal(t.subagents.length, 2, 'every discovered subagent transcript is presented');
  assert.deepEqual(t.subagents[0], { agentId: 'agent-1', messages: [{ role: 'assistant', text: 'sub-agent-1' }] });
  assert.equal(t.subagents[1].agentId, 'agent-2');
  assert.match(t.subagents[1].error, /gone/);
  assert.ok(calls.some((c) => c[0] === 'list' && c[1] === 'sess-v'), 'listSubagents-style discovery invoked per session');
});

test('T10 startViewer binds to loopback only', async () => {
  const dir = tmp(); const stateDir = path.join(dir, 'state');
  fs.mkdirSync(path.join(stateDir, 'runs'), { recursive: true });
  const server = await startViewer({ port: 0, stateDir });
  try {
    const addr = server.address();
    assert.equal(addr.address, '127.0.0.1');
  } finally { server.close(); }
});
