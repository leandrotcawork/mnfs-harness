import net from 'node:net';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = (value) => createHash('sha256').update(value).digest('hex');

export function validateRunId(runId) {
  if (!UUID.test(runId ?? '')) throw new Error('INVALID-RUN-ID');
  return runId;
}

export function userIdentity() {
  if (process.platform !== 'win32') return `${os.userInfo().username}-${process.getuid?.() ?? ''}`;
  try {
    const output = execFileSync('whoami', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true });
    return output.match(/S-1-[\d-]+/i)?.[0] ?? os.userInfo().username;
  } catch { return os.userInfo().username; }
}

export function pipeNames(canonicalRoot, runId, identity = userIdentity()) {
  const rootHash = hash(canonicalRoot);
  const names = { admission: `\\\\.\\pipe\\mnfs-conductor-admission-${rootHash}` };
  if (runId !== undefined) names.lease = `\\\\.\\pipe\\mnfs-conductor-${hash(identity).slice(0, 24)}-${rootHash}-${validateRunId(runId)}`;
  return names;
}

function listen(name, netApi = net) {
  return new Promise((resolve, reject) => {
    const server = netApi.createServer();
    const cleanup = () => { server.removeListener('listening', onListen); server.removeListener('error', onError); };
    const onListen = () => { cleanup(); resolve(server); };
    const onError = (error) => { cleanup(); reject(error); };
    server.once('listening', onListen); server.once('error', onError); server.listen(name);
  });
}

export function closeServer(server) {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

export async function probePipe(name, { netApi = net } = {}) {
  let server;
  try { server = await listen(name, netApi); }
  catch (error) {
    if (error?.code === 'EADDRINUSE') return { occupied: true };
    throw new Error(`PIPE-PROBE-${error?.code ?? 'UNKNOWN'}`, { cause: error });
  }
  await closeServer(server);
  return { occupied: false };
}

export async function acquireLease(name, { netApi = net } = {}) {
  try { return await listen(name, netApi); }
  catch (error) {
    if (error?.code === 'EADDRINUSE') throw new Error('RUN-OCCUPIED', { cause: error });
    throw new Error(`PIPE-LEASE-${error?.code ?? 'UNKNOWN'}`, { cause: error });
  }
}

export async function withAdmissionMutex(name, operation, { netApi = net, clock = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), timeoutMs = 15_000 } = {}) {
  const deadline = clock() + timeoutMs;
  let server;
  while (!server) {
    try { server = await listen(name, netApi); }
    catch (error) {
      if (error?.code !== 'EADDRINUSE') throw new Error(`ADMISSION-PIPE-${error?.code ?? 'UNKNOWN'}`, { cause: error });
      if (clock() >= deadline) throw new Error('ADMISSION-LOCKED');
      await sleep(Math.min(100, Math.max(1, deadline - clock())));
    }
  }
  try { return await operation(); } finally { await closeServer(server); }
}
