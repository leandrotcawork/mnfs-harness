// SMOKE-7 (A8): Windows named-pipe as liveness lease.
// (1) child listens on pipe name; parent listen -> EADDRINUSE while child alive;
// (2) child SIGKILL'd -> parent listen succeeds (no stale state).
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PIPE = '\\\\.\\pipe\\mnfs-conductor-smoke7-' + (process.env.SMOKE7_SUFFIX ?? 'x');

function tryListen(name) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', (e) => resolve({ ok: false, code: e.code, srv: null }));
    srv.listen(name, () => resolve({ ok: true, code: null, srv }));
  });
}

if (process.argv[2] === 'child') {
  const r = await tryListen(PIPE);
  if (!r.ok) process.exit(3);
  console.log('child-listening');
  setInterval(() => {}, 1000);
} else {
  process.env.SMOKE7_SUFFIX = String(process.pid);
  const self = fileURLToPath(import.meta.url);
  const child = spawn(process.execPath, [self, 'child'], {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, SMOKE7_SUFFIX: String(process.pid) }
  });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => { if (d.toString().includes('child-listening')) resolve(); });
    child.once('exit', () => reject(new Error('child died early')));
    setTimeout(() => reject(new Error('child start timeout')), 10_000);
  }).catch((e) => { console.log('FAIL:', e.message); process.exit(1); });

  const pipeName = '\\\\.\\pipe\\mnfs-conductor-smoke7-' + process.pid;
  const whileAlive = await tryListen(pipeName);
  whileAlive.srv?.close();
  console.log(`alive: listen ok=${whileAlive.ok} code=${whileAlive.code}`);

  child.kill('SIGKILL');
  await new Promise((r) => child.once('exit', r));
  await new Promise((r) => setTimeout(r, 300));

  const afterDead = await tryListen(pipeName);
  console.log(`dead: listen ok=${afterDead.ok} code=${afterDead.code}`);
  afterDead.srv?.close();

  const pass = !whileAlive.ok && whileAlive.code === 'EADDRINUSE' && afterDead.ok;
  console.log(pass ? 'A8 CONFIRMED — named-pipe lease works' : 'A8 FALSIFIED');
  process.exit(pass ? 0 : 1);
}
