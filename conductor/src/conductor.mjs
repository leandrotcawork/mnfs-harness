import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk';
import { decide } from './permissions.mjs';
import { acquireLease, closeServer, pipeNames, probePipe, validateRunId, withAdmissionMutex } from './pipes.mjs';
import { appendEvent, countResumes, createAuditor, readEvents, runState, TERMINAL_EVENTS } from './registry.mjs';
import { atomicWriteJson, createOperatorChannel, readAnswer, waitForAnswer, writeAnswer } from './questions.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROLES = path.join(HERE, '..', 'roles.json');
export const RECEIPT_SCHEMA = { type: 'object', properties: { status: { type: 'string', enum: ['completed'] }, summary: { type: 'string' } }, required: ['status'], additionalProperties: true };
export const GATED_TOOLS = Object.freeze(['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash', 'NotebookEdit']);
const CONDUCTOR_TOOL = 'mcp__conductor__ask_operator';
// Bound so a watchdog kill's worst case (interrupt-wait + teardown-wait) stays
// strictly under the T7 15s total-termination ceiling: 4.5s + 10s = 14.5s.
const WATCHDOG_INTERRUPT_MS = 4_500;
const EXIT_WAIT_MS = 10_000;
const Receipt = z.object({ status: z.literal('completed'), summary: z.string().optional() }).passthrough();
const bounded = async (promise, ms, clock = globalThis) => { let timer; try { return await Promise.race([Promise.resolve(promise), new Promise((_, reject) => { timer=clock.setTimeout(() => reject(new Error('TIMEOUT')), ms); })]); } finally { if(timer) clock.clearTimeout?.(timer); } };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
function wildcardMatches(pattern, value) {
  if (typeof pattern !== 'string') return false;
  if (!pattern.includes('*')) return pattern.toLowerCase() === value.toLowerCase();
  const escaped = pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${escaped}$`, 'i').test(value);
}
function matchesConductorTool(pattern) {
  if (/mcp__conductor__/i.test(String(pattern ?? ''))) return true;
  return wildcardMatches(pattern, CONDUCTOR_TOOL);
}
function sumField(attempts, key) { return attempts.reduce((n, a) => n + (Number(a?.[key]) || 0), 0); }
function sumUsage(attempts) {
  const total = {};
  for (const a of attempts) for (const [k, v] of Object.entries(a?.usage ?? {})) if (typeof v === 'number') total[k] = (total[k] ?? 0) + v;
  return total;
}
function sumModelUsage(attempts) {
  const total = {};
  for (const a of attempts) for (const [model, usage] of Object.entries(a?.modelUsage ?? {})) {
    total[model] = total[model] ?? {};
    for (const [k, v] of Object.entries(usage ?? {})) if (typeof v === 'number') total[model][k] = (total[model][k] ?? 0) + v;
  }
  return total;
}

export function statePaths(stateDir, runId) {
  const runDir = path.join(stateDir, 'runs', runId);
  return { stateDir, runDir, manifest: path.join(runDir, 'manifest.json'), lease: path.join(runDir, 'lease.json'), ledger: path.join(runDir, 'ledger.jsonl'), attempts: path.join(runDir, 'attempts'), parks: path.join(runDir, 'parks'), receipt: path.join(runDir, 'receipt.json'), answers: path.join(stateDir, 'answers') };
}
function ensure(paths) { fs.mkdirSync(paths.attempts, { recursive: true }); fs.mkdirSync(paths.parks, { recursive: true }); fs.mkdirSync(paths.answers, { recursive: true }); }
function git(cwd, args, encoding = 'utf8') { return execFileSync('git', ['-C', cwd, ...args], { encoding, windowsHide: true }); }
export function fingerprint({ cwd, cardPath, rolesPath = DEFAULT_ROLES, gitFn = git }) {
  const worktreeRoot = fs.realpathSync.native(gitFn(cwd, ['rev-parse', '--show-toplevel']).trim());
  const commonDirRaw = gitFn(cwd, ['rev-parse', '--git-common-dir']).trim();
  const commonDir = fs.realpathSync.native(path.resolve(worktreeRoot, commonDirRaw));
  const repoRoot = fs.realpathSync.native(path.dirname(commonDir));
  const raw = gitFn(cwd, ['ls-files', '-z', '--others', '--exclude-standard'], 'buffer');
  const untracked = raw.toString('utf8').split('\0').filter(Boolean).filter((p) => !p.startsWith('.git/') && !p.startsWith('output/conductor/')).sort().map((p) => ({ path: p, sha256: sha256(fs.readFileSync(path.join(worktreeRoot, p))) }));
  return { repoRoot, worktreeRoot, head: gitFn(cwd, ['rev-parse', 'HEAD']).trim(), branch: gitFn(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(), diffSha256: sha256(gitFn(cwd, ['diff', '--binary', 'HEAD'], 'buffer')), untracked, cardSha256: sha256(fs.readFileSync(cardPath)), rolesSha256: sha256(fs.readFileSync(rolesPath)) };
}
export const fingerprintsEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function loadRoles(rolesPath = DEFAULT_ROLES) {
  const roles = JSON.parse(fs.readFileSync(rolesPath, 'utf8'));
  for (const [name, role] of Object.entries(roles)) {
    if ((role.allowedTools ?? []).some((x) => GATED_TOOLS.includes(x))) throw new Error(`role ${name}: gated tool in allowedTools`);
    if ((role.disallowed ?? role.disallowedTools ?? []).some(matchesConductorTool)) throw new Error(`role ${name}: conductor MCP tool disallowed`);
    for (const agent of Object.values(role.agents ?? {})) if (agent.permissionMode && agent.permissionMode !== 'default') throw new Error(`role ${name}: subagent permissionMode must be default`);
  }
  return roles;
}

async function liveRuns(stateDir, root, exclude, deps = {}) {
  const result = [];
  let names = []; try { names = fs.readdirSync(path.join(stateDir, 'runs')); } catch {}
  for (const id of names) {
    if (id === exclude || !/^[0-9a-f-]{36}$/i.test(id)) continue;
    // Probe before parse: an occupied pipe counts toward the admission cap
    // even when its manifest is missing or malformed (fail-closed). Only a
    // parseable manifest contributes a canonicalCwd for worktree-exclusion.
    const probe = await probePipe(pipeNames(root, id, deps.identity).lease, deps);
    if (!probe.occupied) continue;
    let manifest; try { manifest = JSON.parse(fs.readFileSync(statePaths(stateDir, id).manifest)); } catch { manifest = { runId: id, canonicalCwd: null, manifestUnreadable: true }; }
    result.push(manifest);
  }
  return result;
}

export async function admit({ stateDir, runId, manifest, kind = 'started', deps = {}, validateInside }) {
  validateRunId(runId); const root = fs.realpathSync.native(manifest.canonicalRoot ?? path.dirname(stateDir)); const names = pipeNames(root, runId, deps.identity); const paths = statePaths(stateDir, runId); ensure(paths);
  // A3/R3-N2: a test-injected rendezvous lets two concurrent admit() callers
  // provably arrive at the admission boundary before either enters the mutex,
  // so simultaneous-resume serialization is barrier-synchronized rather than
  // scheduler-lucky. No-op in production.
  await deps.admissionRendezvous?.();
  let lease;
  await withAdmissionMutex(names.admission, async () => {
    const live = await liveRuns(stateDir, root, runId, deps);
    if (live.length >= 2) throw new Error('ADMISSION-FULL');
    if (live.some((m) => m.canonicalCwd && samePath(m.canonicalCwd, manifest.canonicalCwd))) throw new Error('WORKTREE-BUSY');
    // Lease must be acquired before any terminalization occurs inside
    // validateInside (e.g. resume-cap / resume-drift synth receipts) so that
    // writer ownership is established before those events are committed.
    lease = await acquireLease(names.lease, deps);
    try { await validateInside?.({paths,manifest}); }
    catch (error) { await closeServer(lease); throw error; }
    const prior = readEvents(paths.ledger); const generation = (prior.at(-1)?.generation ?? 0) + 1;
    manifest.generation = generation; if (!fs.existsSync(paths.manifest)) atomicWriteJson(paths.manifest, manifest);
    atomicWriteJson(paths.lease, { pid: process.pid, startedAt: new Date().toISOString(), generation });
    appendEvent(paths.ledger, { runId, feature: manifest.feature, role: manifest.role, cwd: manifest.canonicalCwd, attempt: generation, event: kind }, { generation });
  }, deps);
  return { lease, generation: manifest.generation, paths, root };
}

export function createTerminalizer({ paths, base, generation, queryRef, transportObserver = {}, clock = globalThis, manifest = {}, context = {}, barrier = async () => {}, onParked = () => {} }) {
  let winner = null;
  const auditSuppressed = (kind) => appendEvent(paths.ledger, { ...base, event: 'terminalize_suppressed', generation, winnerKind: winner, suppressedKind: kind }, { generation });
  async function teardown() {
    try { queryRef.current?.close?.(); } catch {}
    try { await bounded(transportObserver.waitForExit?.() ?? queryRef.current?.return?.(), EXIT_WAIT_MS, clock); return true; } catch { return false; }
  }
  // Shared by terminal() and the unclean-park branch of park() so that every
  // written receipt — including the "unclean park" investigate receipt —
  // goes through the same attempt-persistence and cumulative-aggregate
  // builder instead of a bespoke skeletal object.
  function persistAndBuildReceipt(state, reason, receipt, { exited } = {}) {
    // #20: the bound session id must reach the attempt/receipt on the normal
    // path too, not only on park — fall back to the context's live binding.
    const attempt = { ...receipt, attempt: generation, sessionId: receipt.sessionId ?? context.sessionId ?? null, lifecycle: state, reason, finishedAt: new Date().toISOString() };
    atomicWriteJson(path.join(paths.attempts, `${generation}.json`), attempt);
    const attemptFiles = fs.readdirSync(paths.attempts).filter(x=>x.endsWith('.json')).sort((a,b)=>Number.parseInt(a)-Number.parseInt(b));
    const attempts = attemptFiles.map(x=>JSON.parse(fs.readFileSync(path.join(paths.attempts,x),'utf8'))); const events=readEvents(paths.ledger);
    const sum=(key)=>sumField(attempts,key);
    const value = { ...receipt, runId: base.runId, feature: base.feature, role: base.role, generation, lifecycle: state, reason, sessionIds: attempts.map(a=>a.sessionId).filter(Boolean), attempts, resultSubtype: receipt.subtype, stopReason: receipt.stopReason, errors: attempts.flatMap(a=>a.errors??[]), numTurns: sum('numTurns'), durationMs: sum('durationMs'), usage: sumUsage(attempts), modelUsage: sumModelUsage(attempts), totalCostUsd: sum('totalCostUsd'), denials: events.filter(e=>e.event==='denial').map(e=>({toolName:e.tool,reason:e.reason})), questionEventIds: events.filter(e=>e.event==='question').map(e=>e.eventId), watchdogEvents: events.filter(e=>e.event==='watchdog_kill'), fingerprintStart: receipt.fingerprintStart ?? manifest.fingerprint ?? null, fingerprintEnd: receipt.fingerprintEnd ?? context.fingerprintEnd ?? null, aggregates:{attemptCount:attempts.length,totalCostUsd:sum('totalCostUsd'),numTurns:sum('numTurns'),durationMs:sum('durationMs')},
      cumulativeUsage: sumUsage(attempts), cumulativeModelUsage: sumModelUsage(attempts),
      model: context.model, sdkVersion: context.sdkVersion, optionsSnapshot: context.optionsSnapshot,
      // retained cumulativeUsage/cumulativeModelUsage as explicit aliases; the
      // canonical usage/modelUsage below are overwritten to the same sums.
      manifestFingerprint: manifest.fingerprint, cardSha256: manifest.fingerprint?.cardSha256, rolesSha256: manifest.fingerprint?.rolesSha256,
      ...(exited === false ? { exitUnobserved: true } : {}) };
    atomicWriteJson(paths.receipt, value); appendEvent(paths.ledger, { ...base, event: state, ...(reason ? { reason } : {}) }, { generation });
    return value;
  }
  // The latch CAS (`if (winner) …; winner = kind;`) is synchronous — no await
  // between the read and the write — so the single-winner guarantee holds
  // regardless of scheduler. The barrier() hooks sit only AFTER the CAS (the
  // winner has already claimed the latch) and just before the receipt/event
  // commit, letting tests pin the winner mid-sequence and force competing
  // entrants to observe the latch + audit suppression deterministically (A5).
  // barrier() is a no-op in production.
  async function terminal(state, reason, receipt, kind = `terminal:${state}`) {
    if (winner) { const winnerKind = winner; auditSuppressed(kind); return { won: false, winnerKind, suppressedKind: kind }; }
    winner = kind;
    await barrier('post-cas', kind);
    const exited = await teardown();
    await barrier('pre-commit', kind);
    const value = persistAndBuildReceipt(state, reason, receipt, { exited });
    return { won: true, state, receipt: value };
  }
  async function park({ park: parkData, queryClose = () => queryRef.current?.close?.() }) {
    if (winner) { const winnerKind = winner; auditSuppressed('park'); return { won: false, winnerKind, suppressedKind: 'park' }; }
    winner = 'park';
    await barrier('post-cas', 'park');
    atomicWriteJson(path.join(paths.parks, `${generation}.json`), parkData);
    await barrier('parkfile', 'park');
    queryClose();
    let exited = false; try { await bounded(transportObserver.waitForExit?.() ?? queryRef.current?.return?.(), EXIT_WAIT_MS, clock); exited = true; } catch {}
    await barrier('pre-commit', 'park');
    if (exited) {
      // P2: a clean park previously wrote NO attempt record, so a park ->
      // resume -> terminal run's final receipt only ever aggregated the LAST
      // (resumed) attempt — losing attempt 1's session id/usage/provenance.
      // Persist this attempt's record here too (same attempts/<n>.json shape
      // persistAndBuildReceipt writes on every other path) so a later
      // terminalization's aggregation sees every real attempt, not just the
      // latest one.
      // P2 r5: the parked attempt record carries the SAME per-attempt
      // provenance contract as terminal attempts (DESIGN.md:36 "options
      // used") — context.optionsSnapshot/model/sdkVersion are live at the
      // park site, so a park->resume->terminal aggregate loses nothing.
      atomicWriteJson(path.join(paths.attempts, `${generation}.json`), { attempt: generation, sessionId: context.sessionId ?? null, lifecycle: 'waiting_operator', finishedAt: new Date().toISOString(), optionsSnapshot: context.optionsSnapshot ?? null, model: context.model ?? null, sdkVersion: context.sdkVersion ?? null });
      appendEvent(paths.ledger, { ...base, event: 'waiting_operator' }, { generation });
      // G4: fired strictly after the waiting_operator ledger append commits —
      // no-op in production, lets tests pin return-before-waiting_operator.
      onParked();
      return { won: true, state: 'waiting_operator' };
    }
    const value = persistAndBuildReceipt('investigate', 'unclean-park', { synthesized: true }, { exited: false });
    return { won: true, state: 'investigate', receipt: value };
  }
  return { terminal, park, winner: () => winner };
}

function resultReceipt(message, paths) { const events = readEvents(paths.ledger); return { subtype: message?.subtype ?? 'query_throw', stopReason: message?.stop_reason, numTurns: message?.num_turns ?? 0, durationMs: message?.duration_ms ?? 0, usage: message?.usage ?? {}, modelUsage: message?.modelUsage ?? {}, totalCostUsd: message?.total_cost_usd ?? 0, errors: message?.errors ?? [], denials: events.filter((e) => e.event === 'denial').map(({ tool, reason }) => ({ toolName:tool, reason })) }; }
function progress(message) { return message?.type === 'result' || message?.type === 'assistant' || message?.type === 'user'; }

export async function runSession({ runId = randomUUID(), card, cardPath, stateDir, rolesPath = DEFAULT_ROLES, queryFn = sdkQuery, clock = Date, deps = {}, resume = null, existingManifest = null, preAdmission = null }) {
  validateRunId(runId); const cardValue = card ?? JSON.parse(fs.readFileSync(cardPath, 'utf8')); const roles = loadRoles(rolesPath); const role = roles[cardValue.role ?? 'writer']; if (!role) throw new Error('unknown role');
  const cwd = fs.realpathSync.native(cardValue.worktree); const root = fs.realpathSync.native(cardValue.repoRoot ?? path.dirname(stateDir));
  const manifest = existingManifest ?? { runId, feature: cardValue.feature ?? cardValue.id, role: cardValue.role ?? 'writer', canonicalCwd: cwd, canonicalRoot: root, cardPath: path.resolve(cardPath), rolesPath: path.resolve(rolesPath), fingerprint: fingerprint({ cwd, cardPath, rolesPath }) };
  const admission = preAdmission ?? await admit({ stateDir, runId, manifest, kind: resume ? 'resumed' : 'started', deps }); const { paths, generation } = admission; const base = { runId, feature: manifest.feature, role: manifest.role, cwd, attempt: generation };
  // P3: captures the terminal-time fingerprint for ordinary failed/investigate
  // receipts (inherited DESIGN.md:316 receipt shape carries fingerprintEnd on
  // every terminal receipt, not only completed). Unlike the deliberate
  // fail-soft null on the completed path (git failure at an otherwise-successful
  // completion), a capture failure HERE is left to throw — fail-closed per
  // fingerprint()'s own contract (A2/T11) rather than silently recording null.
  const captureFingerprintEnd = () => fingerprint({ cwd, cardPath, rolesPath });
  const queryRef = { current: null }; const receiptContext = { model: cardValue.model, sessionId: resume?.sessionId ?? null };
  const terminalizer = createTerminalizer({ paths, base, generation, queryRef, transportObserver: deps.transportObserver, clock: deps.timerClock ?? globalThis, manifest, context: receiptContext, barrier: deps.barrier, onParked: () => deps.onParked?.({ paths }) });
  const auditDenial = createAuditor(paths.ledger, base, { generation });
  // Signal handlers force-close the transport immediately (entering the
  // terminalizer's teardown latch directly) rather than only resolving a
  // promise the main loop might no longer be racing against (e.g. while
  // already awaiting another terminalization). Listeners are removed in the
  // top-level finally below so repeated runSession calls never stack them.
  const signalSource=deps.signalSource??process; let signalResolve; const signalPromise=new Promise(r=>{signalResolve=r});
  // B2/R3-N5: the signal handler is a genuine terminalization-latch entrant.
  // It force-closes the transport, then CASes the shared terminalizer directly
  // (cancelled/<sig>). If another path (result/watchdog) already owns the
  // latch, this competing CAS no-ops and appends terminalize_suppressed with
  // that winnerKind — instead of merely resolving a promise the main loop may
  // no longer be racing against.
  const onSignal=(sig)=>{ try{queryRef.current?.close?.();}catch{}; signalResolve(terminalizer.terminal('cancelled',sig,resultReceipt(null,paths),'signal').then((outcome)=>({sig,outcome}))); };
  const onSigint=()=>onSignal('SIGINT'), onSigterm=()=>onSignal('SIGTERM');
  signalSource.once?.('SIGINT',onSigint); signalSource.once?.('SIGTERM',onSigterm);
  const detachSignals=()=>{ signalSource.removeListener?.('SIGINT',onSigint); signalSource.removeListener?.('SIGTERM',onSigterm); };
  let parkResolve; const parkSignal = new Promise((resolve) => { parkResolve = resolve; });
  const now=deps.now??Date.now, outstanding=new Set(); let phase = 'model_wait', phaseDeadline=now()+role.modelWaitTimeoutMs, phaseWaiters=[];
  const setPhase=(next,{reset=true}={})=>{const changed=next!==phase;phase=next;if(next==='operator_wait')phaseDeadline=null;else if(changed||reset)phaseDeadline=now()+(next==='tool_running'?role.toolTimeoutMs:role.modelWaitTimeoutMs);if(changed||reset)for(const r of phaseWaiters.splice(0))r();};
  // #14: only assistant/user messages carry content blocks relevant to the
  // watchdog deadline. Generic/system chatter (status, session_state_changed,
  // hook progress, etc.) must never reset the phase deadline.
  const observeProgress=(message)=>{if(!progress(message))return;const content=message?.message?.content??message?.content??[];let relevant=false;for(const block of Array.isArray(content)?content:[]){if(block?.type==='tool_use'){outstanding.add(block.id);relevant=true}else if(block?.type==='tool_result'){outstanding.delete(block.tool_use_id);relevant=true}else if(block?.type==='text'){relevant=true}}if(relevant)setPhase(outstanding.size?'tool_running':'model_wait');};
  let initialized = false; let sessionId = resume?.sessionId ?? null; let pending = null;
  const watchdogWait=async(stop)=>{const timers=deps.timerClock??globalThis;while(true){const observed=phase;let changed;const change=new Promise(r=>{changed=r;phaseWaiters.push(r)});if(observed==='operator_wait'){const value=await Promise.race([change.then(()=>({change:true})),stop.then(()=>({stop:true}))]);phaseWaiters=phaseWaiters.filter(r=>r!==changed);if(value.stop)return null;continue}let timer;const timeout=new Promise(r=>{timer=timers.setTimeout(()=>r({watchdog:observed}),Math.max(0,phaseDeadline-now()))});const value=await Promise.race([change.then(()=>({change:true})),timeout,stop.then(()=>({stop:true}))]);if(timer)timers.clearTimeout?.(timer);phaseWaiters=phaseWaiters.filter(r=>r!==changed);if(value.stop)return null;if(value.watchdog)return value;}};
  const channel = createOperatorChannel({ onQuestion: async (payload) => {
    setPhase('operator_wait'); const questionId = randomUUID(); const questionEvent = appendEvent(paths.ledger, { ...base, event: 'question', questionId, data: payload }, { generation });
    // C12/HARNESS-4: deterministic sequencing hook (no-op in production) fired
    // immediately after the question event is committed, so tests can write the
    // answer file at a known point instead of racing a setImmediate poll watcher.
    deps.onQuestion?.({ questionId, payload, paths });
    const filePath = path.join(paths.answers, `${questionId}.json`); const answer = await waitForAnswer({ filePath, questionId, timeoutMs: cardValue.questionTimeoutMs ?? 180_000, clock: deps.now ?? Date.now, sleep: deps.sleep, onMalformed: () => { appendEvent(paths.ledger, { ...base, event: 'malformed_answer', questionId }, { generation }); deps.onMalformedAnswer?.({ questionId, paths }); } });
    if (answer) { appendEvent(paths.ledger, { ...base, event: 'answer_applied', questionId }, { generation }); setPhase('model_wait'); return answer.text; }
    pending = { questionId, payload, sessionId, fingerprint: fingerprint({ cwd, cardPath, rolesPath }), eventId: questionEvent.eventId }; parkResolve(pending); return new Promise(() => {});
  }});
  // NEW BLOCKER fix: no tool may be authorized before the tools inventory
  // from system/init has been observed. NEW #22 fix: an otherwise-allowed
  // tool call missing tool_use_id is denied fail-closed and audited (never
  // silently allowed).
  const gate = (toolName, input, toolUseID, source) => {
    if (!initialized) { auditDenial(toolUseID, source, toolName, 'NOT-INITIALIZED'); return { allow: false, reason: 'NOT-INITIALIZED' }; }
    // R3-N6/B3: a missing tool_use_id fails closed for EVERY tool, including the
    // conductor MCP tool — the fail-closed check precedes the ask_operator
    // allow so there is no allowed-before-check special case.
    if (!toolUseID) { auditDenial(toolUseID, source, toolName, 'MISSING-TOOL-USE-ID'); return { allow: false, reason: 'MISSING-TOOL-USE-ID' }; }
    if (toolName === CONDUCTOR_TOOL) return { allow: true };
    // The SDK delivers `outputFormat: json_schema` by having the model call the
    // Claude Code internal `StructuredOutput` tool. It is the receipt channel,
    // not a workspace tool — denying it makes every run terminalize as
    // invalid-structured-output instead of completed.
    if (toolName === 'StructuredOutput') return { allow: true };
    const d = decide(toolName, input, role, { cwd, repoRoot: root });
    if (!d.allow) auditDenial(toolUseID, source, toolName, d.reason);
    return d;
  };
  const options = { model: cardValue.model, maxTurns: role.maxTurns, maxBudgetUsd: cardValue.maxBudgetUsd, settingSources: [], permissionMode: 'default', tools: role.tools.filter((x) => x !== 'AskUserQuestion'), allowedTools: [], disallowedTools: role.disallowed ?? [], systemPrompt: { type: 'preset', preset: 'claude_code', append: role.append ?? '' }, mcpServers: { conductor: channel }, outputFormat: { type: 'json_schema', schema: RECEIPT_SCHEMA }, cwd, ...(resume ? { resume: resume.sessionId } : {}), hooks: { PreToolUse: [{ hooks: [async (input) => { const d = gate(input.tool_name, input.tool_input, input.tool_use_id, 'PreToolUse'); return d.allow ? {} : { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: d.reason } }; }] }] }, canUseTool: async (toolName, input, ctx = {}) => { const d = gate(toolName, input, ctx.toolUseID, 'canUseTool'); if (!d.allow) return { behavior: 'deny', message: d.reason }; return { behavior: 'allow', updatedInput: input }; } };
  receiptContext.optionsSnapshot = { model: options.model, maxTurns: options.maxTurns, maxBudgetUsd: options.maxBudgetUsd, tools: options.tools, disallowedTools: options.disallowedTools, permissionMode: options.permissionMode, outputFormat: options.outputFormat, cwd: options.cwd, resume: options.resume ?? null };
  let prompt = resume?.prompt ?? fs.readFileSync(cardPath, 'utf8'); let result;
  // #21: signals must never leak listeners on deps.signalSource/process
  // across runSession calls, whichever path returns.
  try {
  try {
    queryRef.current = queryFn({ prompt, options }); const iterator = queryRef.current[Symbol.asyncIterator]?.() ?? queryRef.current;
    while (true) {
      const next = iterator.next(); let cancelWatchdog; const stopWatchdog=new Promise(r=>{cancelWatchdog=r}); const raced = await Promise.race([next.then((x) => ({ next: x })), parkSignal.then((x) => ({ park: x })), signalPromise.then(signal=>({signal})), watchdogWait(stopWatchdog)]); cancelWatchdog();
      if(raced.signal){ const outcome=raced.signal.outcome; if(outcome.won)return { won:outcome.won, state:outcome.state, receipt:outcome.receipt, lease:admission.lease }; let receipt=null; try{receipt=JSON.parse(fs.readFileSync(paths.receipt,'utf8'));}catch{} return { won:false, state:runState(readEvents(paths.ledger)), receipt, lease:admission.lease }; }
      if (raced.park) return { ...(await terminalizer.park({ park: pending })), lease: admission.lease };
      if (raced.watchdog) { let interruptOutcome='ok'; try { await bounded(queryRef.current?.interrupt?.(),WATCHDOG_INTERRUPT_MS,deps.timerClock??globalThis); } catch { interruptOutcome='timeout'; } try { queryRef.current?.close?.(); } catch {} appendEvent(paths.ledger,{...base,event:'watchdog_kill',reason:'watchdog',data:{phase:raced.watchdog,interruptOutcome}},{generation}); return { ...(await terminalizer.terminal('investigate','watchdog',{...resultReceipt(null,paths),watchdogPhase:raced.watchdog,fingerprintEnd:captureFingerprintEnd()})), lease:admission.lease }; }
      const { value: message, done } = raced.next; if (done) break;
      if (message?.type === 'system' && message?.subtype === 'init') { initialized = true; sessionId = message.session_id; receiptContext.sessionId = sessionId; receiptContext.sdkVersion = message.claude_code_version ?? null; appendEvent(paths.ledger, { ...base, event: 'session_bound', sessionId }, { generation }); deps.onSessionBound?.(sessionId, { paths }); if (!message.tools?.includes('mcp__conductor__ask_operator')) return { ...(await terminalizer.terminal('failed', 'tool-inventory', { ...resultReceipt(message, paths), fingerprintEnd: captureFingerprintEnd() })), lease: admission.lease }; }
      if (message?.type === 'result') { result = message; break; }
      if (phase !== 'operator_wait') observeProgress(message);
    }
  } catch (error) { return { ...(await terminalizer.terminal('investigate', 'query-throw', { ...resultReceipt(null, paths), errors: [String(error?.message ?? error)], fingerprintEnd: captureFingerprintEnd() })), lease: admission.lease }; }
  if (!initialized) return { ...(await terminalizer.terminal('failed', 'tool-inventory', { ...resultReceipt(result, paths), fingerprintEnd: captureFingerprintEnd() })), lease: admission.lease };
  if (result?.subtype !== 'success') return { ...(await terminalizer.terminal('investigate', result?.subtype ?? 'no-result', { ...resultReceipt(result, paths), fingerprintEnd: captureFingerprintEnd() })), lease: admission.lease };
  // G6/§8: "status conflicting with lifecycle" — a success result must never
  // be finalized as `completed` if the ledger has already left the running
  // band (started/resumed) by the time the result arrives (e.g. an
  // out-of-band/racing park or terminalization already committed under this
  // generation). Without this guard, persistAndBuildReceipt's own ledger
  // append would throw an uncaught invalid-transition error instead of
  // degrading to a synthesized investigate receipt as §8 requires.
  const lifecycleNow = runState(readEvents(paths.ledger));
  if (lifecycleNow !== 'started' && lifecycleNow !== 'resumed') return { ...(await terminalizer.terminal('investigate', 'conflicting-lifecycle-output', { ...resultReceipt(result, paths), fingerprintEnd: captureFingerprintEnd() })), lease: admission.lease };
  const parsed = Receipt.safeParse(result.structured_output); if (!parsed.success) return { ...(await terminalizer.terminal('investigate', 'invalid-structured-output', { ...resultReceipt(result, paths), fingerprintEnd: captureFingerprintEnd() })), lease: admission.lease };
  // B4/#20: normal-path receipts carry both endpoints of the fingerprint — the
  // captured start (manifest) and a fresh end computed at terminalization.
  // Fail-soft: a git failure at completion records a null end rather than
  // aborting an otherwise-successful run.
  let fingerprintEnd = null; try { fingerprintEnd = fingerprint({ cwd, cardPath, rolesPath }); } catch {}
  return { ...(await terminalizer.terminal('completed', undefined, { ...resultReceipt(result, paths), output: parsed.data, fingerprintStart: manifest.fingerprint, fingerprintEnd })), lease: admission.lease };
  } finally { detachSignals(); }
}

// P3 r5: synthesized receipts (resume-cap, orphan recovery) capture the
// terminal-time fingerprint from the run's own manifest — every legitimate
// production manifest carries cardPath/rolesPath, so capture is normally
// possible even on these paths. Only when capture is genuinely impossible
// (legacy/hand-built manifest without cardPath, or the capture itself fails —
// these synth paths are already failure terminalizations, so aborting the
// receipt write over a broken git would lose the terminal record entirely)
// does the receipt carry the explicit marker 'unavailable' — never a silent
// null.
function synthFingerprintEnd(manifest) {
  if (!manifest?.cardPath) return 'unavailable';
  try { return fingerprint({ cwd: manifest.canonicalCwd, cardPath: manifest.cardPath, rolesPath: manifest.rolesPath ?? DEFAULT_ROLES }); }
  catch { return 'unavailable'; }
}

export async function resumeRun({ stateDir, runId, queryFn = sdkQuery, deps = {} }) {
  validateRunId(runId); const paths = statePaths(stateDir, runId); const manifest = JSON.parse(fs.readFileSync(paths.manifest)); let resumeData;
  const terminalRef={current:null};
  const admission=await admit({stateDir,runId,manifest,kind:'resumed',deps,validateInside:async()=>{const events=readEvents(paths.ledger), state=runState(events), generation=events.at(-1)?.generation;
    if(state!=='waiting_operator')throw new Error('run is not waiting_operator');
    const terminalizer=createTerminalizer({paths,base:{runId,feature:manifest.feature,role:manifest.role,cwd:manifest.canonicalCwd,attempt:generation},generation,queryRef:terminalRef,transportObserver:deps.transportObserver,clock:deps.timerClock??globalThis,manifest,barrier:deps.barrier});
    if(countResumes(events)>=2){await terminalizer.terminal('investigate','resume-cap',{synthesized:true,fingerprintEnd:synthFingerprintEnd(manifest)});throw new Error('resume cap');}
    const parks=fs.readdirSync(paths.parks).filter(x=>x.endsWith('.json')).sort((a,b)=>Number(a.slice(0,-5))-Number(b.slice(0,-5))), park=JSON.parse(fs.readFileSync(path.join(paths.parks,parks.at(-1))));
    const questions=events.filter(e=>e.event==='question'&&!events.some(a=>a.event==='answer_applied'&&a.questionId===e.questionId));if(questions.length!==1||questions[0].questionId!==park.questionId)throw new Error('pending question invariant');
    const bound=events.filter(e=>e.event==='session_bound').at(-1)?.sessionId;if(!park.sessionId||park.sessionId!==bound)throw new Error('session binding invariant');
    const answer=readAnswer(path.join(paths.answers,`${park.questionId}.json`),park.questionId);if(!answer)throw new Error('answer required');
    const current=fingerprint({cwd:manifest.canonicalCwd,cardPath:manifest.cardPath,rolesPath:manifest.rolesPath??DEFAULT_ROLES});if(!fingerprintsEqual(park.fingerprint,current)){await terminalizer.terminal('investigate','resume-drift',{synthesized:true,fingerprintStart:manifest.fingerprint,fingerprintEnd:current});throw new Error('resume drift');}
    resumeData={bound,park,answer};
  }});
  // The consumed answer resolves the parked question: audit answer_applied so
  // the pending-question invariant (exactly one unanswered question) holds
  // when this resumed session parks and is resumed again (two-cycle path).
  appendEvent(paths.ledger,{runId,feature:manifest.feature,role:manifest.role,cwd:manifest.canonicalCwd,attempt:admission.generation,event:'answer_applied',questionId:resumeData.park.questionId},{generation:admission.generation});
  // The resumed session must run under the manifest's roles file — omitting
  // rolesPath here silently fell back to DEFAULT_ROLES, changing the active
  // role config mid-run and making every second-cycle park fingerprint
  // (which hashes rolesPath) spuriously drift.
  const card=JSON.parse(fs.readFileSync(manifest.cardPath));return runSession({runId,card,cardPath:manifest.cardPath,stateDir,rolesPath:manifest.rolesPath??DEFAULT_ROLES,queryFn,deps,existingManifest:manifest,preAdmission:admission,resume:{sessionId:resumeData.bound,prompt:`Operator answered question ${resumeData.park.questionId}: ${resumeData.answer.text}\nContinue.`}});
}

export async function recoverRun({ stateDir, runId, deps = {} }) {
  validateRunId(runId); const paths = statePaths(stateDir, runId); const manifest = JSON.parse(fs.readFileSync(paths.manifest)); if (manifest.runId !== runId || fs.realpathSync.native(manifest.canonicalCwd) !== manifest.canonicalCwd) throw new Error('identity mismatch');
  const names = pipeNames(manifest.canonicalRoot, runId, deps.identity); return withAdmissionMutex(names.admission, async () => { if ((await probePipe(names.lease, deps)).occupied) throw new Error('live owner'); const events = readEvents(paths.ledger); if(!events.length||events.some(e=>e.runId!==runId||!samePath(e.cwd,manifest.canonicalCwd)))throw new Error('identity mismatch'); const state = runState(events); if (state === 'waiting_operator') throw new Error('use resume'); if (TERMINAL_EVENTS.has(state)) throw new Error('already terminal'); if (!['started','resumed'].includes(state)) throw new Error('unknown run'); const generation = events.at(-1).generation; const terminalizer=createTerminalizer({paths,base:{runId,feature:manifest.feature,role:manifest.role,cwd:manifest.canonicalCwd,attempt:generation},generation,queryRef:{current:null},transportObserver:deps.transportObserver,clock:deps.timerClock??globalThis,manifest,barrier:deps.barrier});const result=await terminalizer.terminal('investigate','orphaned',{synthesized:true,fingerprintEnd:synthFingerprintEnd(manifest)});return result.receipt; }, deps);
}

export function status(stateDir) { let ids=[]; try { ids=fs.readdirSync(path.join(stateDir,'runs')); } catch {} return ids.flatMap((runId)=>{ try { const p=statePaths(stateDir,runId); const m=JSON.parse(fs.readFileSync(p.manifest)); return [{runId,feature:m.feature,role:m.role,cwd:m.canonicalCwd,state:runState(readEvents(p.ledger))}]; } catch{return [];} }); }
function args(argv){ const x={_:[]}; for(let i=0;i<argv.length;i++) argv[i].startsWith('--')?x[argv[i].slice(2)]=argv[++i]:x._.push(argv[i]); return x; }
// A1/DISCLOSED-T13: the optional second argument injects a queryFn and deps so
// the run/resume/recover success paths and their §12 exit-code mappings can be
// asserted in-process (spawned-CLI tests still cover the arg-error paths).
// Both default to undefined, so production `main()` uses the real SDK query and
// real (process) signals/timers.
// P1: the lease is NEVER manually closed here — DESIGN-V2.md:67 requires the
// per-run occupancy lease to be held for process lifetime and released solely
// by process death (`process.exit`), because manual release can recreate an
// old-owner overlap window. Production relies entirely on the
// `process.exit(await main())` call below. `deps.onLease` is a test-only,
// no-op-in-production hook so in-process tests (which invoke `main()`
// repeatedly in the SAME process across sequential runIds, and therefore never
// get the free release a real process exit would give them) can simulate
// process death by explicitly closing the lease themselves between calls.
const codeFor = (state) => state === 'completed' ? 0 : state === 'waiting_operator' ? 2 : 1;
export async function main(argv=process.argv.slice(2), { queryFn, deps } = {}){ const a=args(argv), cmd=a._[0]; const inject={ ...(queryFn?{queryFn}:{}), ...(deps?{deps}:{}) }; try { if(cmd==='answer'){ writeAnswer(path.join(a.state,'answers',`${a._[1]}.json`),a._[1],a._[2]); return 0; } if(cmd==='run'){ const card=JSON.parse(fs.readFileSync(a.card)); const stateDir=a.state??path.join(card.repoRoot??card.worktree,'output','conductor'); const r=await runSession({runId:a.run??randomUUID(),card,cardPath:a.card,stateDir,...inject}); deps?.onLease?.(r.lease); return codeFor(r.state); } if(cmd==='resume'){ const r=await resumeRun({stateDir:a.state,runId:a._[1]??a.run,...inject}); deps?.onLease?.(r.lease); return codeFor(r.state); } if(cmd==='recover'){ await recoverRun({stateDir:a.state,runId:a._[1]??a.run,...(deps?{deps}:{})}); return 1; } if(cmd==='status'){ console.log(JSON.stringify(status(a.state),null,2)); return 0; } if(cmd==='viewer'){ const {startViewer}=await import('./viewer.mjs'); const server=await startViewer({stateDir:a.state,port:Number(a.port??4317)}); console.log(`conductor viewer listening on ${server.address().port}`); await new Promise(()=>{}); } throw new Error('usage: run|answer|resume|recover|status|viewer'); } catch(e){ console.error(e.message); return 1; } }
if(import.meta.url===`file://${process.argv[1]?.replaceAll('\\','/')}`) process.exit(await main());
