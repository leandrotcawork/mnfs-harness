import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bashDecision, decide } from '../src/permissions.mjs';

const roles = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'roles.json'), 'utf8'));
const writer = roles.writer;
const reviewer = roles.reviewer;
test('write tools stay inside cwd and reviewer has no Write', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'perm-'));
  const cwd = path.join(root, 'wt'); fs.mkdirSync(cwd);
  assert.deepEqual(decide('Write', { file_path: path.join(cwd, 'a.txt') }, writer, { cwd }), { allow: true });
  assert.equal(decide('Write', { file_path: path.join(root, 'wt2', 'a.txt') }, writer, { cwd }).allow, false);
  assert.equal(decide('Write', { file_path: path.join(cwd, 'a:stream') }, writer, { cwd }).allow, false);
  assert.equal(decide('Write', { file_path: path.join(cwd, '..', 'a') }, writer, { cwd }).allow, false);
  assert.equal(decide('Write', { file_path: 'C:\\wt2\\x' }, writer, { cwd: 'C:\\wt' }).allow, false);
  assert.equal(decide('Write', {}, reviewer, { cwd }).capabilityRequest, true);
  assert.equal(decide('Write', { file_path: 'inside.txt' }, writer, { cwd }).allow, true);
  assert.equal(decide('Edit', { file_path: path.join(cwd, 'a.txt') }, writer, { cwd }).allow, true);
  assert.equal(decide('NotebookEdit', { file_path: path.join(cwd, 'a.txt') }, { ...writer, tools: [...writer.tools, 'NotebookEdit'] }, { cwd }).allow, true);
});

test('read secrets outside cwd are hard denied', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'perm-'));
  const cwd = path.join(root, 'wt'); fs.mkdirSync(cwd);
  assert.equal(decide('Read', { file_path: path.join(root, '.ssh', 'id_rsa') }, writer, { cwd, repoRoot: root }).allow, false);
});

test('bash stage one rejects shell syntax and never-list is hard deny', () => {
  for (const command of ['npm test\n', 'npm test"', "npm test'", 'npm test\\$HOME', 'npm test > out', 'npm test < in', 'npm test | cat', 'npm test;cat', 'npm test&cat', 'npm test$X', 'npm test`x`', 'npm test%X', 'npm test!X', 'npm test(x)', 'FOO=bar npm test', 'cmd npm test', 'cmd.exe npm test', 'pwsh npm test', 'sh npm test', 'bash npm test']) {
    assert.equal(bashDecision({ command }, writer).reason, 'BASH-METACHAR');
  }
  assert.equal(bashDecision({ command: 'npm test', extra: 'nope' }, writer).reason, 'BASH-METACHAR');
  for (const command of ['npm\u00a0test', 'npm test\u2003x', 'npm test?', 'npm test\\']) assert.equal(bashDecision({ command }, writer).reason, 'BASH-METACHAR');
  for (const command of ['git push', 'git remote -v', 'npm publish', 'npx foo', 'curl example.com', 'rm file']) assert.equal(bashDecision({ command }, writer).reason, 'BASH-NEVER-LIST');
  for (const command of ['wget example.com', 'del file', 'rmdir folder', 'sc query', 'reg query', 'schtasks /query', 'Remove-Item file', 'GIT --NO-PAGER PUSH', 'git --no-pager PUSH', 'npm --silent Publish']) assert.equal(bashDecision({ command }, writer).reason, 'BASH-NEVER-LIST');
  assert.equal(bashDecision({ command: 'npm run test' }, writer).allow, true);
  assert.equal(bashDecision({ command: 'git status' }, writer).capabilityRequest, true);
});

test('path syntax hard-denies ADS, devices, UNC, and never throws', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'perm-')); const cwd = path.join(root, 'wt'); fs.mkdirSync(cwd);
  const paths = ['sub\\x:ads', '\\\\.\\C:\\x', '\\\\?\\C:\\x', '//./C:/x', '//?/C:/x', '\\\\host\\share\\x', '//host/share/x'];
  for (const file_path of paths) assert.doesNotThrow(() => { assert.equal(decide('Write', { file_path }, writer, { cwd }).allow, false); });
});

test('containment is case-insensitive for Win32 paths and rejects sibling prefixes and parent traversal', () => {
  assert.equal(decide('Write', { file_path: 'C:\\WT\\Sub\\x' }, writer, { cwd: 'C:\\wt' }).allow, true);
  assert.equal(decide('Write', { file_path: 'C:\\WT2\\x' }, writer, { cwd: 'C:\\wt' }).allow, false);
  assert.equal(decide('Write', { file_path: '..\\outside' }, writer, { cwd: 'C:\\wt' }).allow, false);
});

test('read fragments are hard denied everywhere while .env is cwd-scoped', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'perm-')); const cwd = path.join(root, 'wt'); fs.mkdirSync(cwd);
  for (const fragment of ['.ssh', '.aws', '.gnupg', 'credentials', '.claude.json', 'id_rsa']) {
    assert.equal(decide('Read', { file_path: path.join(cwd, fragment) }, writer, { cwd, repoRoot: root }).allow, false);
    assert.equal(decide('Read', { file_path: path.join(root, fragment) }, writer, { cwd, repoRoot: root }).allow, false);
  }
  assert.equal(decide('Read', { file_path: path.join(cwd, '.env') }, writer, { cwd, repoRoot: root }).allow, true);
  assert.equal(decide('Read', { file_path: path.join(root, '.env') }, writer, { cwd, repoRoot: root }).allow, false);
});

test('dangerous matrix suffixes are screened after prefix matching and reviewer cannot write', () => {
  for (const command of ['go build -o C:/outside/x', 'go build --output=C:/outside/x', 'go build -toolexec=tool', 'go test -exec=tool', 'go vet -vettool=tool', 'git --no-pager diff --output=x', 'git --no-pager diff --ext-diff', 'git --no-pager diff --textconv', 'git --no-pager log --config=x', 'git --no-pager show --work-tree=x']) assert.equal(bashDecision({ command }, writer).allow, false);
  assert.equal(bashDecision({ command: 'git --no-pager status' }, reviewer).allow, true);
  assert.equal(bashDecision({ command: 'git --no-pager diff' }, reviewer).allow, true);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'perm-')); assert.equal(decide('Write', { file_path: path.join(root, 'x') }, reviewer, { cwd: root }).capabilityRequest, true);
});

test('matrix commands hard-deny every amended escape flag', () => {
  const policy = { tools: ['Bash'], bashMatrix: [['git', '--no-pager', 'diff']] };
  for (const flag of ['--no-index', '--prefix', '--script-shell', '--shell', '--cd', '-C']) {
    const result = decide('Bash', { command: `git --no-pager diff ${flag} value` }, policy, { cwd: process.cwd() });
    assert.equal(result.allow, false, flag);
    assert.equal(result.capabilityRequest, undefined, flag);
  }
});
