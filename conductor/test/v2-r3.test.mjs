// Fix-round-3 tests: close every residue enumerated in review v2-code-r3.md
// (organized by prompt-impl-v2-fix3.md groups A/B/C). Each test name cites the
// finding it resolves. Like v2-fakesdk.test.mjs these drive the PRODUCTION
// entry points (main/runSession/resumeRun/recoverRun/fingerprint/createTerminalizer)
// through the injectable fake-sdk harness and deterministic barriers — never a
// reimplementation of the logic under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, fork, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { runSession, resumeRun, recoverRun, statePaths, fingerprint, fingerprintsEqual, createTerminalizer, main, admit } from '../src/conductor.mjs';
import { appendEvent, readEvents, runState, countResumes, LIFECYCLE_EVENTS, AUDIT_EVENTS, TERMINAL_EVENTS } from '../src/registry.mjs';
import { writeAnswer, readAnswer, waitForAnswer, createOperatorChannel } from '../src/questions.mjs';
import { pipeNames, acquireLease, probePipe } from '../src/pipes.mjs';
import * as fake from './helpers/fake-sdk.mjs';

const IDENTITY = 'r3-test';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-r3-'));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const QUESTIONS_MODULE = pathToFileURL(path.join(import.meta.dirname, '..', 'src', 'questions.mjs')).href;

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

// Default worktree/repoRoot is a per-file throwaway git repo (SHARED_REPO,
// below) — NOT the real REPO_ROOT. The admission mutex pipe is keyed only by
// hash(canonicalRoot) (identity- and runId-independent), so pointing admit() at
// REPO_ROOT would make every run here contend on the SAME global pipe that the
// other test files' REPO_ROOT runs hold — and under the virtual clock that
// contention loop starves driveToSettled. Isolating onto a unique root gives
// each file its own admission pipe.
function writeCard(dir, overrides = {}) {
  const cardPath = path.join(dir, 'card.json');
  const card = { id: 'f-test', feature: 'f-test', role: 'writer', worktree: SHARED_REPO, repoRoot: SHARED_REPO, model: 'claude-fake', ...overrides };
  fs.writeFileSync(cardPath, JSON.stringify(card));
  return cardPath;
}
// A unique, pristine git worktree shared by every fingerprint/runSession test in
// THIS file. Never mutated (tests that need drift make their own repo), so its
// fingerprint stays stable across a park->resume. Its hash gives this file a
// private admission pipe, eliminating cross-file mutex contention.
const SHARED_REPO = makeTempRepo();
const SHARED_ROOT = SHARED_REPO;   // already realpath'd by makeTempRepo()

// A throwaway real git repo so fingerprint()/resume-drift run against a worktree
// that only this test mutates (never REPO_ROOT, which concurrent test processes
// churn).
function makeTempRepo() {
  const dir = fs.realpathSync.native(tmp());
  const g = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', windowsHide: true });
  g('init', '-q');
  g('config', 'user.email', 't@example.com');
  g('config', 'user.name', 'Tester');
  g('config', 'commit.gpgsign', 'false');
  g('config', 'core.autocrlf', 'false');
  fs.writeFileSync(path.join(dir, 'seed.txt'), 'seed\n');
  g('add', '-A');
  g('commit', '-q', '-m', 'init');
  return dir;
}

// Same shape as the v2-fakesdk `run` helper: build a runSession promise + its
// virtual clock without starting to drive it, so the test controls settling.
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

// A ledger already at 'started' plus the attempt/park/answer dirs, for driving
// createTerminalizer directly (A5/B4).
function startedRun() {
  const stateDir = tmp(); const runId = randomUUID(); const paths = statePaths(stateDir, runId);
  fs.mkdirSync(paths.attempts, { recursive: true }); fs.mkdirSync(paths.parks, { recursive: true }); fs.mkdirSync(paths.answers, { recursive: true });
  const base = { runId, feature: 'f-test', role: 'writer', cwd: process.cwd(), attempt: 1 };
  appendEvent(paths.ledger, { ...base, event: 'started' }, { generation: 1 });
  return { stateDir, runId, paths, base };
}
const okQueryRef = () => ({ current: { close() {}, async return() { return { done: true }; }, async interrupt() { return { subtype: 'interrupt' }; } } });

// G10: cleanup that AWAITS the child's actual exit instead of firing kill()
// and moving on. A bare `child.kill()` in t.after only requests termination —
// the OS may not have freed the process's unique-named-pipe by the time the
// runner proceeds to the next test/forced-teardown, which can orphan a
// still-listening pipe. Reused by every spawned/forked child in this file.
async function killAndWait(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try { child.kill(); } catch {}
  await new Promise((resolve) => child.once('exit', resolve));
}

// Park a real runSession run (question-timeout park) and return its paths so a
// resume can be exercised. Uses SHARED_REPO unless a repo is supplied.
async function parkOne(dir, { worktree } = {}) {
  const stateDir = path.join(dir, 'state'); const rolesPath = fastRoles(dir, { toolTimeoutMs: 100_000, modelWaitTimeoutMs: 100_000 });
  const overrides = { questionTimeoutMs: 20, ...(worktree ? { worktree, repoRoot: worktree } : {}) };
  const cardPath = writeCard(dir, overrides);
  const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
  const runId = randomUUID(); const box = {};
  const vc = fake.virtualClock(); const deps = fake.buildDeps(vc);
  const r = await fake.driveToSettled(runSession({ runId, card, cardPath, stateDir, rolesPath, queryFn: fake.createFakeQuery({ hangNext: true, script: [fake.initMessage(), fake.invokeAskOperator({ question: 'q' }, box)] }), deps }), vc);
  r.lease?.close?.();
  assert.equal(r.state, 'waiting_operator');
  return { stateDir, rolesPath, cardPath, runId, paths: statePaths(stateDir, runId) };
}

// =========================================================================
// A1 (DISCLOSED-T13): main() exit-code mappings through injected queryFn+deps.
// =========================================================================

// P1: main() no longer closes the lease itself (DESIGN-V2.md:67 — a run/resume
// lease is held until process death, never manually released). deps.onLease
// is a test-only hook (no-op in production) that lets these in-process tests
// release the lease explicitly, since they never get the free release a real
// `process.exit` would give a spawned CLI invocation.
test('A1/T13 main() run maps completed->0, failure->1, waiting_operator->2', async () => {
  // completed -> 0
  {
    const dir = tmp(); const stateDir = path.join(dir, 'state'); const cardPath = writeCard(dir);
    const vc = fake.virtualClock();
    const queryFn = fake.createFakeQuery({ script: [fake.initMessage(), fake.resultSuccess({ structuredOutput: { status: 'completed' } })] });
    const code = await fake.driveToSettled(main(['run', '--card', cardPath, '--state', stateDir, '--run', randomUUID()], { queryFn, deps: fake.buildDeps(vc, { onLease: (lease) => lease?.close?.() }) }), vc);
    assert.equal(code, 0);
  }
  // failure (init advertises no ask_operator -> failed(tool-inventory)) -> 1
  {
    const dir = tmp(); const stateDir = path.join(dir, 'state'); const cardPath = writeCard(dir);
    const vc = fake.virtualClock(); const runId = randomUUID();
    const queryFn = fake.createFakeQuery({ script: [fake.initMessage({ tools: [] }), fake.resultSuccess({ structuredOutput: { status: 'completed' } })] });
    const code = await fake.driveToSettled(main(['run', '--card', cardPath, '--state', stateDir, '--run', runId], { queryFn, deps: fake.buildDeps(vc, { onLease: (lease) => lease?.close?.() }) }), vc);
    assert.equal(code, 1);
    // P3: ordinary `failed` receipts (not only `investigate`) must carry a
    // captured fingerprintEnd, never a silent null.
    const receipt = JSON.parse(fs.readFileSync(statePaths(stateDir, runId).receipt, 'utf8'));
    assert.equal(receipt.lifecycle, 'failed');
    assert.ok(receipt.fingerprintEnd && typeof receipt.fingerprintEnd === 'object', 'P3: failed(tool-inventory) receipt captures fingerprintEnd');
  }
  // waiting_operator (question timeout -> park) -> 2
  {
    const dir = tmp(); const stateDir = path.join(dir, 'state'); const cardPath = writeCard(dir, { questionTimeoutMs: 20 });
    const box = {}; const vc = fake.virtualClock();
    const queryFn = fake.createFakeQuery({ hangNext: true, script: [fake.initMessage(), fake.invokeAskOperator({ question: 'q' }, box)] });
    const code = await fake.driveToSettled(main(['run', '--card', cardPath, '--state', stateDir, '--run', randomUUID()], { queryFn, deps: fake.buildDeps(vc, { onLease: (lease) => lease?.close?.() }) }), vc);
    assert.equal(code, 2);
  }
});

test('A1/T13 main() resume maps completed->0 and a spent run->1', async () => {
  const repo = makeTempRepo();
  const dir = tmp(); const stateDir = path.join(dir, 'state'); const cardPath = writeCard(dir, { worktree: repo, repoRoot: repo, questionTimeoutMs: 20 });
  const runId = randomUUID(); const box = {};
  // Park through main('run'). P1: since main() no longer closes the lease
  // itself, this in-process test MUST close it via deps.onLease before the
  // next sequential main() call below — otherwise that call's own admission
  // would see this still-held lease and refuse with RUN-OCCUPIED (a real
  // process would get this for free from process death; this test simulates
  // that boundary explicitly).
  {
    const vc = fake.virtualClock();
    const queryFn = fake.createFakeQuery({ hangNext: true, script: [fake.initMessage(), fake.invokeAskOperator({ question: 'q' }, box)] });
    const code = await fake.driveToSettled(main(['run', '--card', cardPath, '--state', stateDir, '--run', runId], { queryFn, deps: fake.buildDeps(vc, { onLease: (lease) => lease?.close?.() }) }), vc);
    assert.equal(code, 2);
  }
  const paths = statePaths(stateDir, runId);
  const q = readEvents(paths.ledger).find((e) => e.event === 'question');
  writeAnswer(path.join(paths.answers, `${q.questionId}.json`), q.questionId, 'go');
  // Resume to completion -> 0.
  {
    const vc = fake.virtualClock();
    const queryFn = fake.createFakeQuery({ script: [fake.initMessage(), fake.resultSuccess({ structuredOutput: { status: 'completed' } })] });
    const code = await fake.driveToSettled(main(['resume', '--state', stateDir, runId], { queryFn, deps: fake.buildDeps(vc, { onLease: (lease) => lease?.close?.() }) }), vc);
    assert.equal(code, 0);
  }
  // A second resume: state is completed (not waiting_operator) -> refusal -> 1.
  {
    const vc = fake.virtualClock();
    const code = await fake.driveToSettled(main(['resume', '--state', stateDir, runId], { queryFn: fake.createFakeQuery({ script: [] }), deps: fake.buildDeps(vc, { onLease: (lease) => lease?.close?.() }) }), vc);
    assert.equal(code, 1);
  }
});

test('A1/T13 main() recover claims an orphan and returns 1', async () => {
  const root = fs.realpathSync.native(tmp());   // isolated admission-pipe root
  const stateDir = tmp(); const runId = randomUUID(); const p = statePaths(stateDir, runId);
  fs.mkdirSync(p.runDir, { recursive: true });
  fs.writeFileSync(p.manifest, JSON.stringify({ runId, feature: 'f', role: 'writer', canonicalCwd: root, canonicalRoot: root }));
  appendEvent(p.ledger, { runId, feature: 'f', role: 'writer', cwd: root, attempt: 1, event: 'started' }, { generation: 1 });
  const vc = fake.virtualClock();
  const code = await fake.driveToSettled(main(['recover', '--state', stateDir, runId], { deps: fake.buildDeps(vc, { identity: IDENTITY }) }), vc);
  assert.equal(code, 1);
  assert.equal(runState(readEvents(p.ledger)), 'investigate');
});

// =========================================================================
// A2 (DISCLOSED-T11 / #11): fingerprint through production fingerprint().
// =========================================================================

test('A2/T11 fingerprint fails closed when the git runner errors', () => {
  const dir = tmp();
  const cardPath = path.join(dir, 'card.json'); fs.writeFileSync(cardPath, '{}');
  const rolesPath = path.join(dir, 'roles.json'); fs.writeFileSync(rolesPath, '{}');
  assert.throws(() => fingerprint({ cwd: dir, cardPath, rolesPath, gitFn: () => { throw new Error('git exploded'); } }), /git exploded/);
});

test('A2/T11 fingerprint resolves a linked worktree and hashes NUL-delimited untracked content', () => {
  const mainDir = fs.realpathSync.native(tmp());   // the "main" checkout
  const wtDir = fs.realpathSync.native(tmp());      // the linked worktree
  const commonDir = path.join(mainDir, '.git');
  fs.mkdirSync(commonDir, { recursive: true });
  const f1 = 'a.txt', f2 = 'dir sub/é.txt';         // path with a space + non-ASCII byte
  fs.writeFileSync(path.join(wtDir, f1), 'alpha');
  fs.mkdirSync(path.join(wtDir, 'dir sub'), { recursive: true });
  fs.writeFileSync(path.join(wtDir, f2), 'beta');
  const cardPath = path.join(wtDir, 'card.json'); fs.writeFileSync(cardPath, 'CARD');
  const rolesPath = path.join(wtDir, 'roles.json'); fs.writeFileSync(rolesPath, 'ROLES');
  const gitFn = (cwd, args) => {
    const key = args.join(' ');
    if (key === 'rev-parse --show-toplevel') return `${wtDir}\n`;
    if (key === 'rev-parse --git-common-dir') return `${commonDir}\n`;
    if (key === 'rev-parse HEAD') return 'deadbeefcafe\n';
    if (key === 'rev-parse --abbrev-ref HEAD') return 'feature/x\n';
    if (key === 'diff --binary HEAD') return Buffer.from('');
    if (key === 'ls-files -z --others --exclude-standard') return Buffer.from(`${f1}\0${f2}\0`, 'utf8');
    throw new Error(`unexpected git ${key}`);
  };
  const fp = fingerprint({ cwd: wtDir, cardPath, rolesPath, gitFn });
  assert.equal(fp.worktreeRoot, wtDir);
  assert.equal(fp.repoRoot, mainDir, 'repoRoot resolves through --git-common-dir dirname');
  assert.equal(fp.head, 'deadbeefcafe');
  assert.equal(fp.branch, 'feature/x');
  assert.equal(fp.untracked.length, 2);
  assert.deepEqual(fp.untracked.map((u) => u.path), ['a.txt', 'dir sub/é.txt']);
  assert.equal(fp.untracked[0].sha256, sha('alpha'));
  assert.equal(fp.untracked[1].sha256, sha('beta'));
  assert.equal(fp.cardSha256, sha('CARD'));
  assert.equal(fp.rolesSha256, sha('ROLES'));
});

test('A2/#11 park captures the admission fingerprint; a drifted worktree fails resume with resume-drift', async () => {
  const repo = makeTempRepo();
  const dir = tmp();
  const { stateDir, runId, paths } = await parkOne(dir, { worktree: repo });
  // Park file must carry the exact fingerprint captured at admission.
  const manifest = JSON.parse(fs.readFileSync(paths.manifest, 'utf8'));
  const parkFile = JSON.parse(fs.readFileSync(path.join(paths.parks, '1.json'), 'utf8'));
  assert.ok(fingerprintsEqual(parkFile.fingerprint, manifest.fingerprint), 'park captured the admission fingerprint');
  // Answer, then mutate the worktree so its fingerprint drifts.
  const q = readEvents(paths.ledger).find((e) => e.event === 'question');
  writeAnswer(path.join(paths.answers, `${q.questionId}.json`), q.questionId, 'go');
  fs.writeFileSync(path.join(repo, 'drift.txt'), 'newly untracked, changes the fingerprint\n');
  // Resume must recompute, detect the drift, and terminalize investigate(resume-drift).
  const vc = fake.virtualClock();
  await assert.rejects(
    fake.driveToSettled(resumeRun({ stateDir, runId, queryFn: fake.createFakeQuery({ script: [] }), deps: fake.buildDeps(vc) }), vc),
    /resume drift/
  );
  const drift = readEvents(paths.ledger).find((e) => e.event === 'investigate' && e.reason === 'resume-drift');
  assert.ok(drift, 'resume-drift investigate committed to the ledger');
  const receipt = JSON.parse(fs.readFileSync(paths.receipt, 'utf8'));
  assert.ok(receipt.fingerprintStart && receipt.fingerprintEnd, 'drift receipt carries both fingerprint endpoints');
  assert.equal(fingerprintsEqual(receipt.fingerprintStart, receipt.fingerprintEnd), false, 'start and end fingerprints differ');
});

// =========================================================================
// A5 (R3-N4): barrier-driven latch races through the production createTerminalizer.
// =========================================================================

test('A5/T9 result wins the latch; watchdog and signal entrants are suppressed (one receipt, two suppressed)', async () => {
  const { paths, base } = startedRun();
  const barrier = fake.makeBarrier(); const vc = fake.virtualClock();
  const term = createTerminalizer({ paths, base, generation: 1, queryRef: okQueryRef(), barrier, clock: vc.clock });
  const release = barrier.pauseAt('post-cas', 'terminal:completed');
  // Winner claims the latch (synchronous CAS) then pauses before teardown.
  const winnerP = term.terminal('completed', undefined, { output: { status: 'completed' }, subtype: 'success' }, 'terminal:completed');
  await barrier.waitForHit('post-cas', 'terminal:completed');
  // Competing entrants now provably observe the latch already owned.
  const wd = await term.terminal('investigate', 'watchdog', { synthesized: true }, 'watchdog');
  const sig = await term.terminal('cancelled', 'SIGINT', { synthesized: true }, 'signal');
  assert.deepEqual({ won: wd.won, winnerKind: wd.winnerKind, suppressedKind: wd.suppressedKind }, { won: false, winnerKind: 'terminal:completed', suppressedKind: 'watchdog' });
  assert.deepEqual({ won: sig.won, winnerKind: sig.winnerKind, suppressedKind: sig.suppressedKind }, { won: false, winnerKind: 'terminal:completed', suppressedKind: 'signal' });
  release();
  const winner = await winnerP;
  assert.equal(winner.won, true); assert.equal(winner.state, 'completed');
  const events = readEvents(paths.ledger);
  assert.equal(events.filter((e) => TERMINAL_EVENTS.has(e.event)).length, 1, 'exactly one terminal lifecycle event');
  assert.equal(events.filter((e) => e.event === 'completed').length, 1);
  const supp = events.filter((e) => e.event === 'terminalize_suppressed');
  assert.equal(supp.length, 2);
  assert.deepEqual(supp.map((s) => s.suppressedKind).sort(), ['signal', 'watchdog']);
  assert.ok(supp.every((s) => s.winnerKind === 'terminal:completed'));
  assert.equal(fs.existsSync(paths.receipt), true, 'single receipt written by the winner');
});

test('A5/T9 park wins the latch; a competing terminal entrant is suppressed (single winner owns the sequence)', async () => {
  const { paths, base } = startedRun();
  const barrier = fake.makeBarrier(); const vc = fake.virtualClock();
  const term = createTerminalizer({ paths, base, generation: 1, queryRef: okQueryRef(), barrier, clock: vc.clock });
  const release = barrier.pauseAt('post-cas', 'park');
  const parkP = term.park({ park: { questionId: 'q1', sessionId: 's1', fingerprint: {}, payload: {} } });
  await barrier.waitForHit('post-cas', 'park');
  const loser = await term.terminal('investigate', 'watchdog', { synthesized: true }, 'watchdog');
  assert.deepEqual({ won: loser.won, winnerKind: loser.winnerKind, suppressedKind: loser.suppressedKind }, { won: false, winnerKind: 'park', suppressedKind: 'watchdog' });
  release();
  const parkOutcome = await parkP;
  assert.equal(parkOutcome.won, true); assert.equal(parkOutcome.state, 'waiting_operator');
  const events = readEvents(paths.ledger);
  assert.equal(events.filter((e) => LIFECYCLE_EVENTS.has(e.event) && e.event !== 'started').length, 1, 'only the park lifecycle transition committed');
  assert.equal(events.at(-1).event, 'waiting_operator');
  assert.equal(events.filter((e) => e.event === 'terminalize_suppressed').length, 1);
  assert.equal(fs.existsSync(path.join(paths.parks, '1.json')), true);
});

test('G8 production signal race: a REAL SIGINT via the installed signal handler is suppressed while another production terminalizer owns the latch mid-commit', async () => {
  const signalSource = fake.fakeSignalSource();
  const barrier = fake.makeBarrier();
  const release = barrier.pauseAt('post-cas', 'terminal:completed');
  const { promise, vc, paths } = await run({
    deps: { signalSource, barrier },
    script: [fake.initMessage(), fake.resultSuccess({ structuredOutput: { status: 'completed' } })]
  });
  await barrier.waitForHit('post-cas', 'terminal:completed');
  // The production result path has already synchronously CASed the
  // terminalization latch and is paused post-CAS, pre-commit. The signal
  // listener (signalSource.once('SIGINT', onSigint), installed at the top of
  // runSession and only detached in its top-level finally, which has not run
  // yet) is still live — invoking it here exercises the REAL production
  // signal handler, not a manual terminal('cancelled',...) call, racing a
  // genuinely-in-progress commit rather than an idle terminalizer.
  signalSource.emit('SIGINT');
  release();
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'completed');
  const events = readEvents(paths.ledger);
  assert.equal(events.filter((e) => TERMINAL_EVENTS.has(e.event)).length, 1, 'exactly one terminal lifecycle event committed');
  const supp = events.filter((e) => e.event === 'terminalize_suppressed');
  assert.equal(supp.length, 1);
  assert.equal(supp[0].suppressedKind, 'signal');
  assert.equal(supp[0].winnerKind, 'terminal:completed');
});

// =========================================================================
// B4 (#20 residue): cumulative usage + normal-path fingerprint endpoints.
// =========================================================================

test('B4/#20 completed receipt carries both fingerprint endpoints and cumulative usage aliases', async () => {
  const { promise, vc } = await run({
    script: [fake.initMessage(), fake.resultSuccess({ structuredOutput: { status: 'completed' }, usage: { input_tokens: 5, output_tokens: 7 }, modelUsage: { 'claude-fake': { input_tokens: 5, output_tokens: 7 } } })]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'completed');
  const r = result.receipt;
  assert.ok(r.fingerprintStart && typeof r.fingerprintStart === 'object', 'fingerprintStart present on normal path');
  assert.ok(r.fingerprintEnd && typeof r.fingerprintEnd === 'object', 'fingerprintEnd computed at completion');
  assert.deepEqual(r.usage, { input_tokens: 5, output_tokens: 7 });
  assert.deepEqual(r.cumulativeUsage, r.usage, 'canonical usage == cumulative sum');
  assert.deepEqual(r.cumulativeModelUsage, r.modelUsage);
});

test('P2/B4/#20 receipt aggregation SUMS usage across every NATURALLY produced attempt (park -> resume -> terminal), not just the latest', async () => {
  // P2: a clean park previously wrote no attempts/<n>.json, so a real
  // park -> resume -> terminal run's final receipt only ever aggregated the
  // LATEST (resumed) attempt, silently losing attempt 1's session id/usage/
  // provenance. This test reaches a genuine two-attempt receipt entirely
  // through production entry points (parkOne -> resumeRun) instead of
  // seeding a fake prior-generation attempt file.
  const dir = tmp();
  const { stateDir, runId, paths } = await parkOne(dir);
  // Attempt 1's record must now exist on disk the moment the clean park commits.
  assert.equal(fs.existsSync(path.join(paths.attempts, '1.json')), true, 'clean park persists an attempt record for generation 1');
  const attempt1 = JSON.parse(fs.readFileSync(path.join(paths.attempts, '1.json'), 'utf8'));
  assert.equal(attempt1.attempt, 1);
  assert.equal(attempt1.lifecycle, 'waiting_operator');
  assert.equal(attempt1.sessionId, 'sess-1', 'attempt 1 carries the session id bound during the parked run');
  // P2 r5: the parked attempt record persists the "options used" provenance
  // (DESIGN.md:36) — the exact optionsSnapshot the parked attempt ran under.
  assert.ok(attempt1.optionsSnapshot && typeof attempt1.optionsSnapshot === 'object', 'parked attempt carries optionsSnapshot');
  assert.equal(attempt1.optionsSnapshot.model, 'claude-fake');
  assert.equal(attempt1.optionsSnapshot.permissionMode, 'default');
  assert.equal(attempt1.optionsSnapshot.cwd, SHARED_REPO, 'snapshot cwd is the worktree the parked attempt ran in');
  assert.equal(attempt1.optionsSnapshot.resume, null, 'attempt 1 was a fresh start, not a resume');
  assert.equal(attempt1.model, 'claude-fake');
  assert.equal(attempt1.sdkVersion, '9.9.9', 'parked attempt records the SDK version bound at init');
  const q = readEvents(paths.ledger).find((e) => e.event === 'question');
  writeAnswer(path.join(paths.answers, `${q.questionId}.json`), q.questionId, 'go');
  const vc = fake.virtualClock();
  const result = await fake.driveToSettled(resumeRun({
    stateDir, runId,
    queryFn: fake.createFakeQuery({ script: [
      fake.initMessage({ sessionId: 'sess-2' }),
      fake.resultSuccess({ sessionId: 'sess-2', structuredOutput: { status: 'completed' }, usage: { input_tokens: 4, output_tokens: 6 }, modelUsage: { m: { input_tokens: 4, output_tokens: 6 } }, numTurns: 2, durationMs: 20, totalCostUsd: 0.75 })
    ] }),
    deps: fake.buildDeps(vc)
  }), vc);
  result.lease?.close?.();
  assert.equal(result.state, 'completed');
  const r = result.receipt;
  assert.equal(r.attempts.length, 2, 'both the parked attempt and the resumed/completed attempt are aggregated');
  assert.equal(r.attempts[0].attempt, 1); assert.equal(r.attempts[0].lifecycle, 'waiting_operator');
  assert.equal(r.attempts[1].attempt, 2); assert.equal(r.attempts[1].lifecycle, 'completed');
  assert.deepEqual(r.sessionIds.sort(), ['sess-1', 'sess-2'], 'both attempts\' distinct session ids are present in the aggregate');
  // Attempt 1 (a clean park) contributed no usage of its own, so the sums
  // equal attempt 2's usage exactly — the point is that attempt 1 is now
  // genuinely counted in the aggregation loop, not silently dropped.
  assert.deepEqual(r.usage, { input_tokens: 4, output_tokens: 6 });
  assert.deepEqual(r.cumulativeUsage, r.usage);
  assert.deepEqual(r.cumulativeModelUsage.m, { input_tokens: 4, output_tokens: 6 });
});

// =========================================================================
// C1 (#1): forbidden first-events.
// =========================================================================

test('C1/#1 every non-started lifecycle event is rejected as the first ledger append', () => {
  const base = { runId: randomUUID(), feature: 'f', role: 'writer', cwd: process.cwd(), attempt: 1 };
  for (const event of ['waiting_operator', 'resumed', 'investigate', 'completed', 'failed', 'cancelled']) {
    const file = path.join(tmp(), 'ledger.jsonl');
    const evt = { ...base, event, ...(['investigate', 'failed', 'cancelled'].includes(event) ? { reason: 'x' } : {}) };
    assert.throws(() => appendEvent(file, evt, { generation: 1 }), /run must start before/, `first append '${event}' must be rejected`);
  }
  // G1: validation previously gated only LIFECYCLE_EVENTS, so an audit event
  // (session_bound/question/denial/answer_applied/watchdog_kill/
  // malformed_answer/terminalize_suppressed) could be appended as the very
  // first ledger record, ahead of `started`.
  for (const event of AUDIT_EVENTS) {
    const file = path.join(tmp(), 'ledger.jsonl');
    const evt = {
      ...base, event,
      ...(event === 'watchdog_kill' ? { reason: 'x' } : {}),
      ...(event === 'terminalize_suppressed' ? { generation: 1, winnerKind: 'x', suppressedKind: 'y' } : {})
    };
    assert.throws(() => appendEvent(file, evt, { generation: 1 }), /run must start before/, `first audit append '${event}' must be rejected`);
  }
  const ok = path.join(tmp(), 'ledger.jsonl');
  assert.doesNotThrow(() => appendEvent(ok, { ...base, event: 'started' }, { generation: 1 }));
});

// =========================================================================
// C2 (#2): admission cap, worktree exclusion, recovery matrix, crash/foreign/stale.
// =========================================================================

test('C2/#2 admission cap: two live leases refuse a third run (ADMISSION-FULL)', async () => {
  const dir = tmp(); const stateDir = path.join(dir, 'state'); const rolesPath = fastRoles(dir);
  const root = SHARED_ROOT; const held = [];
  for (let i = 0; i < 2; i++) {
    const id = randomUUID(); const p = statePaths(stateDir, id);
    fs.mkdirSync(p.runDir, { recursive: true });
    fs.writeFileSync(p.manifest, JSON.stringify({ runId: id, canonicalCwd: path.join(root, `sub${i}`) }));
    held.push(await acquireLease(pipeNames(root, id, IDENTITY).lease));
  }
  try {
    const cardPath = writeCard(dir); const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
    const vc = fake.virtualClock();
    await assert.rejects(fake.driveToSettled(runSession({ runId: randomUUID(), card, cardPath, stateDir, rolesPath, queryFn: fake.createFakeQuery({ script: [fake.initMessage(), fake.resultSuccess({ structuredOutput: { status: 'completed' } })] }), deps: fake.buildDeps(vc, { identity: IDENTITY }) }), vc), /ADMISSION-FULL/);
  } finally { for (const h of held) h.close(); }
});

test('C2/#2 worktree exclusion: a live lease on the same canonicalCwd refuses (WORKTREE-BUSY)', async () => {
  const dir = tmp(); const stateDir = path.join(dir, 'state'); const rolesPath = fastRoles(dir);
  const root = SHARED_ROOT;
  const id = randomUUID(); const p = statePaths(stateDir, id);
  fs.mkdirSync(p.runDir, { recursive: true });
  fs.writeFileSync(p.manifest, JSON.stringify({ runId: id, canonicalCwd: root }));   // same cwd as the new run
  const held = await acquireLease(pipeNames(root, id, IDENTITY).lease);
  try {
    const cardPath = writeCard(dir); const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
    const vc = fake.virtualClock();
    await assert.rejects(fake.driveToSettled(runSession({ runId: randomUUID(), card, cardPath, stateDir, rolesPath, queryFn: fake.createFakeQuery({ script: [fake.initMessage(), fake.resultSuccess({ structuredOutput: { status: 'completed' } })] }), deps: fake.buildDeps(vc, { identity: IDENTITY }) }), vc), /WORKTREE-BUSY/);
  } finally { held.close(); }
});

test('C2/#2 foreign holder on the run lease refuses admission (RUN-OCCUPIED, never false-dead)', async () => {
  const dir = tmp(); const stateDir = path.join(dir, 'state'); const rolesPath = fastRoles(dir);
  const root = SHARED_ROOT; const runId = randomUUID();
  const foreign = await acquireLease(pipeNames(root, runId, IDENTITY).lease);
  try {
    const cardPath = writeCard(dir); const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
    const vc = fake.virtualClock();
    await assert.rejects(fake.driveToSettled(runSession({ runId, card, cardPath, stateDir, rolesPath, queryFn: fake.createFakeQuery({ script: [fake.initMessage(), fake.resultSuccess({ structuredOutput: { status: 'completed' } })] }), deps: fake.buildDeps(vc, { identity: IDENTITY }) }), vc), /RUN-OCCUPIED/);
  } finally { foreign.close(); }
});

test('C2/#2 recovery matrix: each precondition violation yields its specific refusal', async () => {
  // P3 r5: the matrix root is a REAL git repo and the default fixture manifest
  // carries cardPath/rolesPath — like every legitimate production manifest —
  // so the orphan synth receipt exercises the CAPTURED fingerprintEnd path.
  // A `legacy` fixture (manifest without cardPath) covers the explicit
  // 'unavailable' marker path.
  const root = makeTempRepo();
  const cardPath = path.join(root, 'card.json'); fs.writeFileSync(cardPath, JSON.stringify({ id: 'f', feature: 'f', role: 'writer', worktree: root, repoRoot: root }));
  const rolesPath = fastRoles(root);
  const mk = (events, { legacy = false } = {}) => {
    const stateDir = tmp(); const runId = randomUUID(); const p = statePaths(stateDir, runId);
    fs.mkdirSync(p.runDir, { recursive: true });
    fs.writeFileSync(p.manifest, JSON.stringify({ runId, feature: 'f', role: 'writer', canonicalCwd: root, canonicalRoot: root, ...(legacy ? {} : { cardPath, rolesPath }) }));
    const b = { runId, feature: 'f', role: 'writer', cwd: root, attempt: 1 };
    for (const e of events) appendEvent(p.ledger, { ...b, ...e }, { generation: e.generation ?? 1 });
    return { stateDir, runId, p };
  };
  const deps = () => fake.buildDeps(fake.virtualClock(), { identity: IDENTITY });
  // waiting_operator -> "use resume"
  {
    const { stateDir, runId } = mk([{ event: 'started' }, { event: 'waiting_operator' }]);
    await assert.rejects(recoverRun({ stateDir, runId, deps: deps() }), /use resume/);
  }
  // terminal -> "already terminal"
  {
    const { stateDir, runId } = mk([{ event: 'started' }, { event: 'completed' }]);
    await assert.rejects(recoverRun({ stateDir, runId, deps: deps() }), /already terminal/);
  }
  // ledger cwd != manifest canonicalCwd -> "identity mismatch"
  {
    const { stateDir, runId } = mk([{ event: 'started', cwd: path.join(root, 'elsewhere') }]);
    await assert.rejects(recoverRun({ stateDir, runId, deps: deps() }), /identity mismatch/);
  }
  // live lease on the run pipe -> "live owner"
  {
    const { stateDir, runId } = mk([{ event: 'started' }]);
    const held = await acquireLease(pipeNames(root, runId, IDENTITY).lease);
    try { await assert.rejects(recoverRun({ stateDir, runId, deps: deps() }), /live owner/); }
    finally { held.close(); }
  }
  // orphaned started (no live lease) -> recover succeeds -> investigate(orphaned)
  // with a CAPTURED terminal fingerprint (manifest has cardPath/rolesPath).
  {
    const { stateDir, runId, p } = mk([{ event: 'started' }]);
    const receipt = await recoverRun({ stateDir, runId, deps: deps() });
    assert.equal(receipt.lifecycle, 'investigate');
    assert.equal(receipt.reason, 'orphaned');
    assert.equal(runState(readEvents(p.ledger)), 'investigate');
    assert.ok(receipt.fingerprintEnd && typeof receipt.fingerprintEnd === 'object', 'P3 r5: orphan synth receipt captures fingerprintEnd from the manifest');
    assert.equal(typeof receipt.fingerprintEnd.head, 'string', 'captured fingerprint is a real git fingerprint');
  }
  // orphaned started with a LEGACY manifest (no cardPath): capture is genuinely
  // impossible -> explicit 'unavailable' marker, never a silent null.
  {
    const { stateDir, runId, p } = mk([{ event: 'started' }], { legacy: true });
    const receipt = await recoverRun({ stateDir, runId, deps: deps() });
    assert.equal(receipt.reason, 'orphaned');
    assert.equal(receipt.fingerprintEnd, 'unavailable', 'P3 r5: legacy manifest yields the explicit unavailable marker');
    assert.equal(runState(readEvents(p.ledger)), 'investigate');
  }
});

test('C2/#2 crash recovery: a killed lease holder frees the pipe so recover then succeeds (child process)', async (t) => {
  const root = fs.realpathSync.native(tmp());   // isolated admission-pipe root
  const stateDir = tmp(); const runId = randomUUID(); const p = statePaths(stateDir, runId);
  fs.mkdirSync(p.runDir, { recursive: true });
  fs.writeFileSync(p.manifest, JSON.stringify({ runId, feature: 'f', role: 'writer', canonicalCwd: root, canonicalRoot: root }));
  appendEvent(p.ledger, { runId, feature: 'f', role: 'writer', cwd: root, attempt: 1, event: 'started' }, { generation: 1 });
  const leaseName = pipeNames(root, runId, IDENTITY).lease;
  const child = spawn(process.execPath, [path.join(import.meta.dirname, 'helpers', 'pipe-child.mjs'), leaseName], { stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(() => killAndWait(child));   // G10: await the child's actual exit, not just kill()
  await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); });
  // While the owner is alive: pipe occupied, recover refuses.
  assert.equal((await probePipe(leaseName)).occupied, true);
  await assert.rejects(recoverRun({ stateDir, runId, deps: fake.buildDeps(fake.virtualClock(), { identity: IDENTITY }) }), /live owner/);
  // Kill the owner: OS tears down the pipe. Recover must now succeed.
  child.kill();
  await new Promise((r) => child.once('exit', r));
  for (let i = 0; i < 500 && (await probePipe(leaseName)).occupied; i++) await new Promise((r) => setImmediate(r));
  assert.equal((await probePipe(leaseName)).occupied, false);
  const receipt = await recoverRun({ stateDir, runId, deps: fake.buildDeps(fake.virtualClock(), { identity: IDENTITY }) });
  assert.equal(receipt.reason, 'orphaned');
  assert.equal(runState(readEvents(p.ledger)), 'investigate');
});

test('C2/#2 stale-writer barrier: an append at a superseded generation is rejected (STALE-GENERATION)', () => {
  const file = path.join(tmp(), 'ledger.jsonl');
  const b = { runId: randomUUID(), feature: 'f', role: 'writer', cwd: process.cwd(), attempt: 1 };
  appendEvent(file, { ...b, event: 'started' }, { generation: 1 });
  appendEvent(file, { ...b, event: 'waiting_operator' }, { generation: 1 });
  appendEvent(file, { ...b, event: 'resumed', attempt: 2 }, { generation: 2 });   // advances to gen 2
  // A writer still on the superseded generation 1 cannot append.
  assert.throws(() => appendEvent(file, { ...b, event: 'investigate', reason: 'x' }, { generation: 1 }), /STALE-GENERATION/);
});

test('G2 stale-writer cross-PROCESS proof: a genuinely separate OS process holding a superseded generation is rejected on append (STALE-GENERATION)', async () => {
  // The in-process test above proves the check exists; this proves it holds
  // across a real process boundary too (not merely an in-memory guard that a
  // second process could bypass by racing the same file).
  const dir = tmp(); const file = path.join(dir, 'ledger.jsonl');
  const b = { runId: randomUUID(), feature: 'f', role: 'writer', cwd: process.cwd(), attempt: 1 };
  appendEvent(file, { ...b, event: 'started' }, { generation: 1 });
  appendEvent(file, { ...b, event: 'waiting_operator' }, { generation: 1 });
  appendEvent(file, { ...b, event: 'resumed', attempt: 2 }, { generation: 2 });   // advances to generation 2
  const before = fs.readFileSync(file, 'utf8');
  const registryModule = pathToFileURL(path.join(import.meta.dirname, '..', 'src', 'registry.mjs')).href;
  const script = path.join(dir, 'stale-writer.mjs');
  fs.writeFileSync(script,
    `import { appendEvent } from ${JSON.stringify(registryModule)};\n` +
    `const [, , file, runId] = process.argv;\n` +
    `try {\n` +
    `  appendEvent(file, { runId, feature: 'f', role: 'writer', cwd: process.cwd(), attempt: 1, event: 'investigate', reason: 'stale-child' }, { generation: 1 });\n` +
    `  process.exit(0);\n` +
    `} catch (e) { process.exit(/STALE-GENERATION/.test(e.message) ? 77 : 1); }\n`);
  const code = await new Promise((resolve) => {
    const c = spawn(process.execPath, [script, file, b.runId], { stdio: 'ignore' });
    c.once('exit', resolve);
  });
  assert.equal(code, 77, 'a separate OS process on the superseded generation is rejected (STALE-GENERATION)');
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'the rejected append never touched the ledger file');
});

test('T2f/G2 crash mid-admission-section: while the crashed-holder child lives, PRODUCTION admit() cannot proceed; after its death the same admit() succeeds', async (t) => {
  const root = fs.realpathSync.native(tmp());   // isolated admission-pipe root
  const stateDir = tmp(); const runId = randomUUID();
  const admissionName = pipeNames(root, undefined, IDENTITY).admission;
  // pipe-child.mjs is a generic named-pipe holder (already used against lease
  // pipes above) — reused against the ADMISSION mutex pipe to model a process
  // that crashed while inside its admission section (withAdmissionMutex holds
  // this pipe for the whole section, released only by close-or-death).
  const child = spawn(process.execPath, [path.join(import.meta.dirname, 'helpers', 'pipe-child.mjs'), admissionName], { stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(() => killAndWait(child));
  await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); });
  assert.equal((await probePipe(admissionName)).occupied, true, 'the child genuinely holds the admission mutex');
  // The next admission goes through the REAL production admit() (the same
  // function runSession/resumeRun call), not a bare withAdmissionMutex.
  const vc = fake.virtualClock();
  const deps = fake.buildDeps(vc, { identity: IDENTITY });
  const manifest = { runId, feature: 'f', role: 'writer', canonicalCwd: root, canonicalRoot: root };
  let settled = false; let outcome = null;
  const admitP = admit({ stateDir, runId, manifest, kind: 'started', deps });
  admitP.then((v) => { settled = true; outcome = { ok: true, value: v }; }, (e) => { settled = true; outcome = { ok: false, error: e }; });
  // Pump generously: the admitter's retry loop spins on virtual-clock sleeps.
  for (let i = 0; i < 60 && !settled; i++) { await new Promise((r) => setImmediate(r)); await vc.flushMicrotasks(); await vc.tick(); }
  assert.equal(child.exitCode, null, 'the crashed-to-be holder is still alive');
  assert.equal(settled, false, 'production admit() cannot proceed while the admission-section holder process lives');
  await killAndWait(child);   // crash: the OS tears down the pipe, freeing the mutex
  const admission = await fake.driveToSettled(admitP, vc);
  assert.ok(outcome.ok, 'the SAME pending admit() call proceeds once the crashed holder is dead');
  assert.equal(admission.generation, 1);
  assert.equal(runState(readEvents(admission.paths.ledger)), 'started', 'admission committed the started event');
  admission.lease.close();   // test-side process-death simulation (P1: production never closes it)
});

test('T2j/G2 stale-writer barrier: while the old run-owner PROCESS is alive its lease refuses a new admission (RUN-OCCUPIED); only after it dies does resume succeed', async (t) => {
  const dir = tmp();
  const { stateDir, runId, paths } = await parkOne(dir);   // old owner parked; parkOne closed its in-process lease (simulated process death)
  const q = readEvents(paths.ledger).find((e) => e.event === 'question');
  writeAnswer(path.join(paths.answers, `${q.questionId}.json`), q.questionId, 'go');
  // Now model the OLD OWNER STILL ALIVE as a real OS process: a child re-holds
  // this run's lease pipe (pipe-held-to-death). The lease name must match what
  // production admission probes: same root, runId, and deps identity.
  const leaseName = pipeNames(SHARED_ROOT, runId, 'fake-sdk-test').lease;
  const child = spawn(process.execPath, [path.join(import.meta.dirname, 'helpers', 'pipe-child.mjs'), leaseName], { stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(() => killAndWait(child));
  await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); });
  // Side 1: with the old owner process ALIVE, production resume admission is refused.
  {
    // R6: snapshot the COMPLETE ledger (every event, lifecycle AND audit)
    // before the refused resume, and deep-compare after — so ANY write during
    // the refusal (not merely a lifecycle-state change) fails the test.
    const ledgerBefore = readEvents(paths.ledger);
    const vc = fake.virtualClock();
    await assert.rejects(
      fake.driveToSettled(resumeRun({ stateDir, runId, queryFn: fake.createFakeQuery({ script: [] }), deps: fake.buildDeps(vc) }), vc),
      /RUN-OCCUPIED/,
      'a live old-owner process makes new admission for the runId impossible'
    );
    assert.equal(child.exitCode, null, 'the refusal happened while the old owner was verifiably alive');
    assert.deepEqual(readEvents(paths.ledger), ledgerBefore, 'the refused admission left the ledger byte-for-byte untouched (no lifecycle or audit writes)');
  }
  // Side 2: kill the old owner (pipe dies WITH the process) -> the same resume succeeds.
  await killAndWait(child);
  {
    const vc = fake.virtualClock();
    const result = await fake.driveToSettled(resumeRun({
      stateDir, runId,
      queryFn: fake.createFakeQuery({ script: [fake.initMessage({ sessionId: 'sess-2' }), fake.resultSuccess({ sessionId: 'sess-2', structuredOutput: { status: 'completed' } })] }),
      deps: fake.buildDeps(vc)
    }), vc);
    result.lease?.close?.();
    assert.equal(result.state, 'completed', 'admission (and the full resume) succeeds only after the old owner process is dead');
  }
});

// =========================================================================
// C3 (#3): t+5s fast-path timing + deadline-final-read race.
// =========================================================================

test('G3 end-to-end fast path: an answer landing exactly at the t+5s deadline is caught by waitForAnswer\'s FINAL read (not an in-loop poll), driven through runSession', async () => {
  const box = {}; const dir = tmp(); const stateDir = path.join(dir, 'state');
  const rolesPath = fastRoles(dir, { toolTimeoutMs: 100_000, modelWaitTimeoutMs: 100_000 });
  const cardPath = writeCard(dir, { questionTimeoutMs: 5_000 });
  const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
  const vc = fake.virtualClock();
  // waitForAnswer's poll loop (default intervalMs=2000, deadline=5000) visits
  // t=0, 2000, 4000, then sleeps to exactly t=5000 where the loop condition
  // (clock() < deadline) goes false and it falls through to the POST-LOOP
  // final read. The write-timer is registered here — synchronously inside
  // onQuestion, BEFORE waitForAnswer schedules any of its own poll timers —
  // so it always gets a lower timer id and, at the t=5000 tie (sorted by
  // `at` then `id`), always fires first: the write is guaranteed to land on
  // the exact tick the final read (not any earlier in-loop poll) observes.
  const deps = fake.buildDeps(vc, { onQuestion: ({ questionId, paths }) => { vc.clock.setTimeout(() => writeAnswer(path.join(paths.answers, `${questionId}.json`), questionId, 'exactly-at-deadline'), 5_000); } });
  const runId = randomUUID();
  const result = await fake.driveToSettled(runSession({ runId, card, cardPath, stateDir, rolesPath, queryFn: fake.createFakeQuery({ script: [fake.initMessage(), fake.invokeAskOperator({ question: 'q' }, box), fake.awaitAskOperator(box), fake.resultSuccess({ structuredOutput: { status: 'completed' } })] }), deps }), vc);
  result.lease?.close?.();
  assert.equal(result.state, 'completed');
  assert.equal(vc.now(), 5_000, 'the answer landed exactly at the t+5s deadline, not earlier');
  assert.equal(box.value?.content?.[0]?.text, 'exactly-at-deadline', 'the deadline-final-read answer text reached the ask_operator tool result');
  const events = readEvents(statePaths(stateDir, runId).ledger);
  assert.equal(events.some((e) => e.event === 'waiting_operator'), false, 'no park: the deadline-final-read caught the answer before park would fire');
  assert.ok(events.some((e) => e.event === 'answer_applied'));
});

test('C3/#3 waitForAnswer deadline-final-read: an answer landing exactly at expiry is caught by the final read', async () => {
  const f = path.join(tmp(), 'q.json'); const q = 'qid'; let now = 0;
  const answer = await waitForAnswer({
    filePath: f, questionId: q, timeoutMs: 10, intervalMs: 10, clock: () => now,
    // On the tick that reaches the deadline, write the answer — so only the
    // post-loop final readAnswer (not an in-loop poll) can observe it.
    sleep: async (ms) => { now += ms; if (now >= 10) writeAnswer(f, q, 'edge'); }
  });
  assert.deepEqual(answer, { questionId: q, text: 'edge' });
});

// =========================================================================
// C4 (#4): clean park path sequence via barrier — parks-file -> close -> exit -> ledger.
// =========================================================================

test('C4/#4 clean park sequence through runSession: parks-file precedes close, then exit, then waiting_operator', async () => {
  const box = {}; const dir = tmp(); const stateDir = path.join(dir, 'state');
  const rolesPath = fastRoles(dir, { toolTimeoutMs: 100_000, modelWaitTimeoutMs: 100_000 });
  const cardPath = writeCard(dir, { questionTimeoutMs: 20 });
  const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
  const vc = fake.virtualClock(); const log = [];
  const barrier = fake.makeBarrier(); const release = barrier.pauseAt('parkfile', 'park');
  // G4: onParked (production hook, no-op by default) fires strictly AFTER
  // the waiting_operator ledger append commits (see the park() branch in
  // conductor.mjs). Snapshotting the log at that exact moment — before
  // touching the ledger ourselves — proves `return` (exit observation) was
  // already logged BEFORE the ledger commit, not merely before `close()`.
  // A regression that moved the ledger append earlier (ahead of the exit
  // observation) would make returnSeenAtOnParked false here.
  let returnSeenAtOnParked = null; let onParkedFired = false;
  const deps = fake.buildDeps(vc, { barrier, onParked: () => { onParkedFired = true; returnSeenAtOnParked = log.some((e) => e.event === 'return'); } });
  const runId = randomUUID(); const paths = statePaths(stateDir, runId);
  let parksBeforeClose = null;
  const orchestrate = (async () => {
    await barrier.waitForHit('parkfile', 'park');   // paused right after the parks-file write, before close()
    parksBeforeClose = fs.existsSync(path.join(paths.parks, '1.json')) && !log.some((e) => e.event === 'close');
    release();
  })();
  const [result] = await Promise.all([
    fake.driveToSettled(runSession({ runId, card, cardPath, stateDir, rolesPath, queryFn: fake.createFakeQuery({ hangNext: true, log, script: [fake.initMessage(), fake.invokeAskOperator({ question: 'q' }, box)] }), deps }), vc, { maxTicks: 2_000, maxIoYields: 20_000 }),
    orchestrate
  ]);
  result.lease?.close?.();
  assert.equal(result.state, 'waiting_operator');
  assert.equal(parksBeforeClose, true, 'parks file exists before the transport is closed');
  const seq = log.map((e) => e.event);
  assert.ok(seq.includes('close') && seq.indexOf('close') < seq.indexOf('return'), 'close() precedes exit observation');
  // T4 (DESIGN-V2.md:120): close called exactly once across the whole clean
  // park sequence — the interceptor log records every transport close.
  assert.equal(log.filter((e) => e.event === 'close').length, 1, 'T4: close called exactly once (clean park)');
  const events = readEvents(paths.ledger);
  assert.equal(events.at(-1).event, 'waiting_operator', 'waiting_operator is the final ledger event');
  assert.equal(onParkedFired, true, 'the onParked interceptor fired');
  assert.equal(returnSeenAtOnParked, true, 'return (exit observation) is logged before the ledger commits waiting_operator');
});

test('T4/C4 unclean park through runSession: exit unobserved -> investigate(unclean-park), close called exactly once', async () => {
  const box = {}; const dir = tmp(); const stateDir = path.join(dir, 'state');
  const rolesPath = fastRoles(dir, { toolTimeoutMs: 100_000, modelWaitTimeoutMs: 100_000 });
  const cardPath = writeCard(dir, { questionTimeoutMs: 20 });
  const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
  const vc = fake.virtualClock(); const log = [];
  const runId = randomUUID(); const paths = statePaths(stateDir, runId);
  // hangReturn: the transport's return() never settles, so the bounded exit
  // observation times out (EXIT_WAIT_MS virtual) -> the park owner escalates
  // to investigate('unclean-park') while still owning the latch.
  const result = await fake.driveToSettled(runSession({ runId, card, cardPath, stateDir, rolesPath, queryFn: fake.createFakeQuery({ hangNext: true, hangReturn: true, log, script: [fake.initMessage(), fake.invokeAskOperator({ question: 'q' }, box)] }), deps: fake.buildDeps(vc) }), vc, { maxTicks: 2_000, maxIoYields: 20_000 });
  result.lease?.close?.();
  assert.equal(result.state, 'investigate');
  assert.equal(result.receipt.reason, 'unclean-park');
  assert.equal(result.receipt.exitUnobserved, true, 'the receipt discloses that transport exit was never observed');
  // T4 (DESIGN-V2.md:120): close called exactly once across the whole unclean
  // park sequence too — the escalation path must not re-close the transport.
  assert.equal(log.filter((e) => e.event === 'close').length, 1, 'T4: close called exactly once (unclean park)');
  const events = readEvents(paths.ledger);
  assert.equal(events.at(-1).event, 'investigate', 'the park owner itself committed investigate(unclean-park)');
  assert.equal(events.filter((e) => TERMINAL_EVENTS.has(e.event)).length, 1, 'one latch winner throughout');
});

// =========================================================================
// C5 (#5): resume invariants — each a resumeRun call asserting the refusal.
// =========================================================================

test('C5/#5 resume R1: two unanswered questions on the ledger refuse (pending question invariant)', async () => {
  const { stateDir, runId, paths } = await parkOne(tmp());
  appendEvent(paths.ledger, { runId, feature: 'f-test', role: 'writer', cwd: SHARED_ROOT, attempt: 1, event: 'question', questionId: 'q-extra', data: {} }, { generation: 1 });
  const q = readEvents(paths.ledger).find((e) => e.event === 'question');
  writeAnswer(path.join(paths.answers, `${q.questionId}.json`), q.questionId, 'a');
  const vc = fake.virtualClock();
  await assert.rejects(fake.driveToSettled(resumeRun({ stateDir, runId, queryFn: fake.createFakeQuery({ script: [] }), deps: fake.buildDeps(vc) }), vc), /pending question invariant/);
});

test('C5/#5 resume R2: a park sessionId not matching the last session_bound refuses (session binding invariant)', async () => {
  const { stateDir, runId, paths } = await parkOne(tmp());
  const q = readEvents(paths.ledger).find((e) => e.event === 'question');
  writeAnswer(path.join(paths.answers, `${q.questionId}.json`), q.questionId, 'a');
  const parkFile = JSON.parse(fs.readFileSync(path.join(paths.parks, '1.json'), 'utf8'));
  parkFile.sessionId = 'not-the-bound-session';
  fs.writeFileSync(path.join(paths.parks, '1.json'), JSON.stringify(parkFile));
  const vc = fake.virtualClock();
  await assert.rejects(fake.driveToSettled(resumeRun({ stateDir, runId, queryFn: fake.createFakeQuery({ script: [] }), deps: fake.buildDeps(vc) }), vc), /session binding invariant/);
});

test('C5/#5 resume R3: a parked run with no authoritative answer refuses (answer required); a written answer is immutable', async () => {
  const { stateDir, runId, paths } = await parkOne(tmp());
  const vc = fake.virtualClock();
  await assert.rejects(fake.driveToSettled(resumeRun({ stateDir, runId, queryFn: fake.createFakeQuery({ script: [] }), deps: fake.buildDeps(vc) }), vc), /answer required/);
  const q = readEvents(paths.ledger).find((e) => e.event === 'question');
  const ap = path.join(paths.answers, `${q.questionId}.json`);
  writeAnswer(ap, q.questionId, 'first');
  assert.throws(() => writeAnswer(ap, q.questionId, 'second'), /duplicate answer/);
  assert.deepEqual(readAnswer(ap, q.questionId), { questionId: q.questionId, text: 'first' });
});

test('C5/#5 resume R5: resume rechecks admission and refuses when the cap is full (ADMISSION-FULL)', async () => {
  const dir = tmp();
  const { stateDir, runId, paths } = await parkOne(dir);
  const q = readEvents(paths.ledger).find((e) => e.event === 'question');
  writeAnswer(path.join(paths.answers, `${q.questionId}.json`), q.questionId, 'a');
  const root = SHARED_ROOT; const held = [];
  for (let i = 0; i < 2; i++) {
    const id = randomUUID(); const p = statePaths(stateDir, id);
    fs.mkdirSync(p.runDir, { recursive: true });
    fs.writeFileSync(p.manifest, JSON.stringify({ runId: id, canonicalCwd: path.join(root, `busy${i}`) }));
    held.push(await acquireLease(pipeNames(root, id, IDENTITY).lease));
  }
  try {
    const vc = fake.virtualClock();
    await assert.rejects(fake.driveToSettled(resumeRun({ stateDir, runId, queryFn: fake.createFakeQuery({ script: [] }), deps: fake.buildDeps(vc, { identity: IDENTITY }) }), vc), /ADMISSION-FULL/);
  } finally { for (const h of held) h.close(); }
  // R6 (fingerprint drift on resume) is asserted end-to-end in A2/#11 above.
});

test('G5/C5#5 resume R5 (worktree exclusion): a live lease on the same canonicalCwd refuses resume too (WORKTREE-BUSY)', async () => {
  const dir = tmp();
  const { stateDir, runId, paths } = await parkOne(dir);
  const q = readEvents(paths.ledger).find((e) => e.event === 'question');
  writeAnswer(path.join(paths.answers, `${q.questionId}.json`), q.questionId, 'a');
  const root = SHARED_ROOT;
  const otherId = randomUUID(); const p = statePaths(stateDir, otherId);
  fs.mkdirSync(p.runDir, { recursive: true });
  fs.writeFileSync(p.manifest, JSON.stringify({ runId: otherId, canonicalCwd: root }));   // same worktree as the run being resumed
  const held = await acquireLease(pipeNames(root, otherId, IDENTITY).lease);
  try {
    const vc = fake.virtualClock();
    await assert.rejects(fake.driveToSettled(resumeRun({ stateDir, runId, queryFn: fake.createFakeQuery({ script: [] }), deps: fake.buildDeps(vc, { identity: IDENTITY }) }), vc), /WORKTREE-BUSY/);
  } finally { held.close(); }
});

// =========================================================================
// C6 (#7): tool_running deadline distinct from model_wait.
// =========================================================================

test('C6/#7 an outstanding tool_use makes the tool deadline govern (tool_running), not model_wait', async () => {
  const { promise, vc, paths } = await run({
    rolesOverrides: { toolTimeoutMs: 300, modelWaitTimeoutMs: 5_000 },
    hangNext: true,
    script: [fake.initMessage(), fake.assistantMessage({ content: [fake.toolUseBlock('tu-1', 'Read', { file_path: 'x' })] })]
  });
  const result = await fake.driveToSettled(promise, vc, { maxTicks: 2_000 });
  result.lease?.close?.();
  assert.equal(result.state, 'investigate');
  assert.equal(result.receipt.reason, 'watchdog');
  const kill = readEvents(paths.ledger).find((e) => e.event === 'watchdog_kill');
  assert.equal(kill.data.phase, 'tool_running', 'watchdog attributes the kill to the tool_running phase');
  // The kill landed at the 300ms tool deadline, far below the 5000ms model-wait one.
  assert.ok(vc.now() >= 300 && vc.now() < 1_000, `watchdog fired at the tool deadline (~300ms), clock=${vc.now()}`);
  // P3: ordinary investigate receipts capture fingerprintEnd, not a silent null.
  assert.ok(result.receipt.fingerprintEnd && typeof result.receipt.fingerprintEnd === 'object', 'P3: watchdog investigate receipt captures fingerprintEnd');
});

// =========================================================================
// C7 (#8): query-throw, conflicting/missing structured output, denial dedupe.
// =========================================================================

test('C7/#8 a query throwing mid-stream terminalizes investigate(query-throw)', async () => {
  const { promise, vc, paths } = await run({ script: [fake.initMessage(), fake.throwNext('stream exploded')] });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'investigate');
  assert.equal(result.receipt.reason, 'query-throw');
  assert.ok(result.receipt.errors.some((e) => /stream exploded/.test(e)));
  assert.equal(readEvents(paths.ledger).at(-1).event, 'investigate');
  // P3: ordinary investigate receipts capture fingerprintEnd, not a silent null.
  assert.ok(result.receipt.fingerprintEnd && typeof result.receipt.fingerprintEnd === 'object', 'P3: query-throw investigate receipt captures fingerprintEnd');
});

test('C7/#8 a success result with missing structured output terminalizes investigate(invalid-structured-output)', async () => {
  const { promise, vc } = await run({ script: [fake.initMessage(), fake.resultSuccess({ structuredOutput: undefined })] });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'investigate');
  assert.equal(result.receipt.reason, 'invalid-structured-output');
  assert.ok(result.receipt.fingerprintEnd && typeof result.receipt.fingerprintEnd === 'object', 'P3: invalid-structured-output investigate receipt captures fingerprintEnd');
});

test('G6/#8 a success result arriving while the ledger has already left the running band terminalizes investigate(conflicting-lifecycle-output)', async () => {
  const { promise, vc, paths } = await run({
    deps: {
      // Simulates an external/out-of-band actor moving the SAME ledger to
      // waiting_operator between session_bound and the result arriving —
      // the in-memory terminalization latch can't see this (it's a
      // different vantage point than the persisted ledger), so runSession
      // must re-check the ledger's own lifecycle state before finalizing a
      // success as `completed`.
      onSessionBound: (sessionId, { paths }) => {
        const started = readEvents(paths.ledger).find((e) => e.event === 'started');
        appendEvent(paths.ledger, { runId: started.runId, feature: started.feature, role: started.role, cwd: started.cwd, attempt: started.attempt, event: 'waiting_operator' }, { generation: started.generation });
      }
    },
    script: [fake.initMessage(), fake.resultSuccess({ structuredOutput: { status: 'completed' } })]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'investigate');
  assert.equal(result.receipt.reason, 'conflicting-lifecycle-output');
  assert.equal(readEvents(paths.ledger).at(-1).event, 'investigate');
  assert.ok(result.receipt.fingerprintEnd && typeof result.receipt.fingerprintEnd === 'object');
});

test('G9 missing tool_use_id on the conductor ask_operator MCP tool itself is denied fail-closed and audited (not silently allowed by the conductor-tool special case)', async () => {
  const { promise, vc, log, paths } = await run({
    script: [
      fake.initMessage(),
      fake.invokeCanUseTool('mcp__conductor__ask_operator', { question: 'q' }, undefined),
      fake.resultSuccess({ structuredOutput: { status: 'completed' } })
    ]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  const call = log.find((e) => e.event === 'canUseTool');
  assert.equal(call.data.result.behavior, 'deny');
  assert.equal(call.data.result.message, 'MISSING-TOOL-USE-ID');
  const denial = readEvents(paths.ledger).find((e) => e.event === 'denial' && /MISSING-TOOL-USE-ID/.test(e.reason));
  assert.ok(denial, 'the conductor tool is audited on the fail-closed path too, not skipped by the allow special-case');
  assert.equal(denial.failClosed, true);
  assert.equal(denial.tool, 'mcp__conductor__ask_operator');
  assert.equal(result.state, 'completed');
});

test('C7/#8 denial dedupe at the production boundary: duplicate PreToolUse+canUseTool for one tool_use_id audits once', async () => {
  const outside = path.join(os.tmpdir(), 'r3-denied-nope.txt');   // outside the worktree -> PATH-DENIED
  const { promise, vc, log, paths } = await run({
    script: [
      fake.initMessage(),
      fake.invokePreToolUse('Read', { file_path: outside }, 'tu-dup'),
      fake.invokeCanUseTool('Read', { file_path: outside }, 'tu-dup'),
      fake.resultSuccess({ structuredOutput: { status: 'completed' } })
    ]
  });
  const result = await fake.driveToSettled(promise, vc);
  result.lease?.close?.();
  assert.equal(result.state, 'completed');
  const gateCalls = log.filter((e) => e.event === 'PreToolUse' || e.event === 'canUseTool');
  assert.equal(gateCalls.length, 2, 'both gate surfaces were exercised');
  assert.ok(gateCalls.every((c) => (c.data.result?.behavior === 'deny') || (c.data.result?.hookSpecificOutput?.permissionDecision === 'deny')), 'both denied');
  const denials = readEvents(paths.ledger).filter((e) => e.event === 'denial' && e.toolUseID === 'tu-dup');
  assert.equal(denials.length, 1, 'the shared tool_use_id is audited exactly once');
  assert.equal(denials[0].reason, 'PATH-DENIED');
});

// =========================================================================
// C9 (#13): process-level answer-writer race across two OS processes.
// =========================================================================

test('G7/C9#13 two OS processes racing the same answer through a REAL start barrier: exactly one wins the wx/EXCL create', async (t) => {
  const dir = tmp(); const answerFile = path.join(dir, 'answers', 'q.json');
  const script = path.join(dir, 'writer.mjs');
  // Each forked child announces 'ready' over its IPC channel and then BLOCKS
  // on a 'go' message before attempting the write — a real inter-process
  // start barrier (both children provably alive and waiting) rather than two
  // spawns racing on scheduler luck.
  fs.writeFileSync(script,
    `import { writeAnswer } from ${JSON.stringify(QUESTIONS_MODULE)};\n` +
    `process.once('message', (msg) => {\n` +
    `  if (msg !== 'go') return;\n` +
    `  try { writeAnswer(process.argv[2], process.argv[3], process.argv[4]); process.send({ code: 0 }); }\n` +
    `  catch (e) { process.send({ code: e.code === 'EEXIST' ? 42 : 1 }); }\n` +
    `});\n` +
    `process.send('ready');\n`);
  const c1 = fork(script, [answerFile, 'q', 'one'], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const c2 = fork(script, [answerFile, 'q', 'two'], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  t.after(() => Promise.all([killAndWait(c1), killAndWait(c2)]));   // G10
  const [ready1, ready2] = await Promise.all([
    new Promise((resolve) => c1.once('message', resolve)),
    new Promise((resolve) => c2.once('message', resolve))
  ]);
  assert.equal(ready1, 'ready'); assert.equal(ready2, 'ready');
  // Both children are now provably inside the race window (alive, blocked on
  // 'go') before either has attempted the write.
  const outcome1 = new Promise((resolve) => c1.once('message', resolve));
  const outcome2 = new Promise((resolve) => c2.once('message', resolve));
  c1.send('go'); c2.send('go');
  const [r1, r2] = await Promise.all([outcome1, outcome2]);
  const codes = [r1.code, r2.code].sort((a, b) => a - b);
  assert.deepEqual(codes, [0, 42], 'one writer wins (0), the other loses on EEXIST (42)');
  const stored = readAnswer(answerFile, 'q');
  assert.equal(stored.questionId, 'q');
  assert.ok(['one', 'two'].includes(stored.text));
});

// =========================================================================
// C11 (HARNESS-2): isolate the SDK-private ask_operator access; assert its shape.
// =========================================================================

test('C11/HARNESS-2 askOperatorHandler reaches the registered handler and fails loudly on shape drift', async () => {
  let asked = null;
  const channel = createOperatorChannel({ onQuestion: async (payload) => { asked = payload; return 'answer-text'; } });
  const options = { mcpServers: { conductor: channel } };
  const handler = fake.askOperatorHandler(options);   // asserts the McpSdkServerConfigWithInstance shape internally
  assert.equal(typeof handler, 'function');
  const result = await handler({ question: 'hi' }, {});
  assert.equal(asked.question, 'hi');
  assert.equal(result.content[0].text, 'answer-text');
  // Drift guard: a config missing the private surface must throw, not silently skip.
  assert.throws(() => fake.askOperatorHandler({ mcpServers: { conductor: { instance: {} } } }), /_registeredTools/);
  assert.throws(() => fake.askOperatorHandler({ mcpServers: {} }), /conductor MCP server/);
});
