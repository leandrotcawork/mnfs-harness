// SMOKE-6 (A7): Windows handle-held lock semantics.
// Child process opens lease.lock with an open handle and holds it.
// Parent verifies: (1) rmSync while child alive -> throws EBUSY/EPERM;
// (2) after child killed -> rmSync succeeds.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke6-'));
const lockPath = path.join(dir, 'lease.lock');
const readyPath = path.join(dir, 'ready');

if (process.argv[2] === 'child') {
  const fd = fs.openSync(process.argv[3], 'wx');
  fs.writeSync(fd, String(process.pid));
  fs.writeFileSync(process.argv[3] + '.ready', 'y');
  setInterval(() => {}, 1000); // hold handle forever
} else {
  const self = fileURLToPath(import.meta.url);
  const child = spawn(process.execPath, [self, 'child', lockPath], { stdio: 'ignore' });
  const t0 = Date.now();
  while (!fs.existsSync(lockPath + '.ready')) {
    if (Date.now() - t0 > 10_000) { console.log('FAIL: child never ready'); process.exit(1); }
    await new Promise((r) => setTimeout(r, 50));
  }

  let aliveDeleteBlocked = false;
  let aliveErr = null;
  try { fs.rmSync(lockPath); } catch (e) { aliveDeleteBlocked = true; aliveErr = e.code; }
  const stillExists = fs.existsSync(lockPath);
  console.log(`alive: delete threw=${aliveDeleteBlocked} code=${aliveErr} fileStillExists=${stillExists}`);

  // also test rename while held
  let renameBlocked = false, renameErr = null;
  if (fs.existsSync(lockPath)) {
    try { fs.renameSync(lockPath, lockPath + '.moved'); fs.renameSync(lockPath + '.moved', lockPath); } catch (e) { renameBlocked = true; renameErr = e.code; }
    console.log(`alive: rename blocked=${renameBlocked} code=${renameErr}`);
  } else {
    console.log('alive: rename skipped (file already deleted)');
  }

  child.kill('SIGKILL');
  await new Promise((r) => child.once('exit', r));
  await new Promise((r) => setTimeout(r, 200));

  let deadDeleteOk = false, deadErr = null;
  try { fs.rmSync(lockPath); deadDeleteOk = true; } catch (e) { deadErr = e.code; }
  console.log(`dead: delete ok=${deadDeleteOk} code=${deadErr}`);

  fs.rmSync(dir, { recursive: true, force: true });
  // STUDY.md A7 is FROZEN as FALSIFIED (2026-07-17): libuv opens files with
  // FILE_SHARE_DELETE, so delete SUCCEEDS while a handle is held open.
  // Handle-held file lock is NOT a liveness primitive on Windows+Node — the
  // named-pipe lease (A8/SMOKE-7) was adopted instead. Exit 0 must therefore
  // mean "the falsification reproduced" (delete succeeded despite the live
  // handle), not "delete was blocked".
  const falsificationReproduced = !aliveDeleteBlocked;
  const deadOk = deadDeleteOk || (!aliveDeleteBlocked && deadErr === 'ENOENT');
  const pass = falsificationReproduced && deadOk;
  console.log(pass ? 'A7 FALSIFICATION REPRODUCED — handle-held delete succeeded, matches frozen STUDY.md result' : 'A7 UNEXPECTED — handle-held delete was blocked, contradicts frozen STUDY.md result');
  process.exit(pass ? 0 : 1);
}
