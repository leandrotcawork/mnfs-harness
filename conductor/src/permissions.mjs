import fs from 'node:fs';
import path from 'node:path';

const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);
const READ_TOOLS = new Set(['Read', 'Glob', 'Grep']);
const HARD_READ_FRAGMENTS = new Set(['.ssh', '.aws', '.gnupg', 'credentials', '.claude.json', 'id_rsa']);
const NEVER_EXECUTABLES = new Set(['npx', 'curl', 'wget', 'rm', 'del', 'rmdir', 'sc', 'reg', 'schtasks', 'remove-item']);
const NEVER_OPERATIONS = {
  git: new Set(['push', 'remote', 'fetch', 'pull', 'clean', 'reset', 'checkout', 'restore']),
  npm: new Set(['publish', 'install', 'i', 'ci', 'exec', 'x'])
};
const SAFE_TOKEN = /^[A-Za-z0-9_./:@,+=-]+$/;
const ESCAPE_FLAGS = [
  '-o', '--output', '-exec', '-toolexec', '-vettool', '-c', '--config', '--ext-diff',
  '--textconv', '--work-tree', '--git-dir', '--upload-pack', '--exec-path', '--no-index',
  '--prefix', '--script-shell', '--shell', '--cd', '-C'
];

function isWinPath(value) {
  return process.platform === 'win32' || /^[A-Za-z]:[\\/]/.test(value) || /^[/\\]{2}/.test(value);
}

function pathApi(value) { return isWinPath(value) ? path.win32 : path; }

function resolveAgainstCwd(value, cwd) {
  const api = pathApi(value);
  return api.isAbsolute(value) ? value : api.resolve(cwd, value);
}

function existingAncestor(filePath, api) {
  let candidate = api.resolve(filePath);
  while (true) {
    try { return { original: candidate, canonical: fs.realpathSync.native(candidate) }; }
    catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      const parent = api.dirname(candidate);
      if (parent === candidate) return { original: candidate, canonical: candidate };
      candidate = parent;
    }
  }
}

export function hardPathSyntax(filePath) {
  if (typeof filePath !== 'string') return true;
  const value = filePath;
  if (/^[/\\]{2}(?:[.?][/\\]|[^/\\]+[/\\][^/\\]+)/.test(value)) return true;
  const driveColon = /^[A-Za-z]:/.test(value) ? 1 : -1;
  for (let index = value.indexOf(':'); index >= 0; index = value.indexOf(':', index + 1)) {
    if (index !== driveColon) return true;
  }
  return false;
}

export function canonicalize(filePath, baseCwd = process.cwd()) {
  const resolved = resolveAgainstCwd(filePath, baseCwd);
  const api = pathApi(resolved);
  try { return fs.realpathSync.native(resolved); }
  catch { const ancestor = existingAncestor(resolved, api); return api.resolve(ancestor.canonical, api.relative(ancestor.original, resolved)); }
}

function containment(target, root) {
  const targetText = canonicalize(target);
  const rootText = canonicalize(root);
  const api = pathApi(rootText);
  const compare = process.platform === 'win32' || isWinPath(rootText) ? (value) => value.toLowerCase() : (value) => value;
  const relative = api.relative(compare(rootText), compare(targetText));
  return !(relative === '..' || relative.startsWith(`..${api.sep}`) || api.isAbsolute(relative));
}

function safeContainment(target, root, baseCwd) {
  try {
    const resolved = resolveAgainstCwd(target, baseCwd);
    const rootResolved = resolveAgainstCwd(root, baseCwd);
    const targetText = canonicalize(resolved, baseCwd);
    const rootText = canonicalize(rootResolved, baseCwd);
    const api = pathApi(targetText);
    const compare = process.platform === 'win32' || isWinPath(targetText) || isWinPath(rootText) ? (value) => value.toLowerCase() : (value) => value;
    const relative = api.relative(compare(rootText), compare(targetText));
    return !(relative === '..' || relative.startsWith(`..${api.sep}`) || api.isAbsolute(relative));
  } catch { return false; }
}

function pathParts(filePath, baseCwd) {
  const canonical = canonicalize(resolveAgainstCwd(filePath, baseCwd), baseCwd);
  return canonical.split(/[\\/]+/).filter(Boolean).map((part) => part.toLowerCase());
}

function hardPathDeny(filePath, cwd) {
  const parts = pathParts(filePath, cwd);
  const outsideCwd = !safeContainment(filePath, cwd, cwd);
  if (parts.some((part) => HARD_READ_FRAGMENTS.has(part))) return true;
  return outsideCwd && parts.includes('.env');
}

function deny(reason, capabilityRequest = false) {
  return capabilityRequest ? { allow: false, reason, capabilityRequest: true } : { allow: false, reason };
}

function bashStageOne(input) {
  if (!input || typeof input !== 'object' || Object.keys(input).some((key) => !['command', 'description', 'timeout'].includes(key))) return false;
  const command = input.command;
  if (typeof command !== 'string' || /[\r\n"']/.test(command)) return false;
  if (/[><|;&$`%!()]/.test(command)) return false;
  if (/\\[><|;&$`%!()]/.test(command)) return false;
  const tokens = command.trim().split(/[ \t]+/).filter(Boolean);
  if (!tokens.length || tokens[0].includes('=')) return false;
  if (['cmd', 'cmd.exe', 'powershell', 'pwsh', 'sh', 'bash'].includes(tokens[0].toLowerCase())) return false;
  return true;
}

function bashTokens(input) {
  return input.command.trim().split(/[ \t]+/).filter(Boolean);
}

function neverListed(tokens) {
  const executable = tokens[0].toLowerCase();
  if (NEVER_EXECUTABLES.has(executable)) return true;
  const operations = NEVER_OPERATIONS[executable];
  return Boolean(operations && tokens.slice(1).some((token) => operations.has(token.toLowerCase())));
}

function prefixMatch(tokens, prefix) { return prefix.every((token, index) => tokens[index] === token); }

function escapeFlag(token) {
  return ESCAPE_FLAGS.some((flag) => token === flag || token.startsWith(flag));
}

export function bashDecision(input, policy) {
  if (!bashStageOne(input)) return deny('BASH-METACHAR');
  const tokens = bashTokens(input);
  if (tokens.some((token) => !SAFE_TOKEN.test(token))) return deny('BASH-METACHAR');
  if (neverListed(tokens)) return deny('BASH-NEVER-LIST');
  const matched = (policy?.bashMatrix ?? []).some((prefix) => prefixMatch(tokens, prefix));
  if (matched && tokens.some(escapeFlag)) return deny('BASH-ESCAPE-FLAG');
  if (matched) return { allow: true };
  return deny('BASH-NOT-IN-MATRIX', true);
}

export function decide(toolName, input = {}, policy, ctx = {}) {
  if (!policy?.tools?.includes(toolName)) return deny('TOOL-NOT-ALLOWED', true);
  const cwd = ctx.cwd;
  if (WRITE_TOOLS.has(toolName)) {
    if (typeof input.file_path !== 'string' || hardPathSyntax(input.file_path) || !safeContainment(input.file_path, cwd, cwd)) return deny('PATH-OUTSIDE-CWD');
    return { allow: true };
  }
  if (READ_TOOLS.has(toolName)) {
    const root = ctx.repoRoot ?? cwd;
    for (const field of ['file_path', 'path', 'pattern']) {
      if (typeof input[field] === 'string' && (hardPathSyntax(input[field]) || !safeContainment(input[field], root, cwd) || hardPathDeny(input[field], cwd))) return deny('PATH-DENIED');
    }
    return { allow: true };
  }
  if (toolName === 'AskUserQuestion') return { allow: false, reason: 'QUESTION-PROTOCOL' };
  if (toolName === 'Bash') return bashDecision(input, policy);
  return deny('TOOL-RULE-UNIMPLEMENTED', true);
}
