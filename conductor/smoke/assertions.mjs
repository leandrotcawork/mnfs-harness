import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const cases=[
  ['A1 tool hold','smoke1-tool-hold.mjs'],
  ['A3 resume after close','smoke3-resume-after-close.mjs'],
  ['A4 MCP inventory/init','smoke1b-tools-inventory.mjs'],
  ['A5 close releases and exits','smoke4-close-releases.mjs'],
  ['A6 outputFormat and MCP coexist','smoke5-outputformat-mcp.mjs'],
  ['A7 Windows handle delete','smoke6-handle-lock.mjs'],
  ['A8 pipe lease exclusivity','smoke7-pipe-lease.mjs']
];

export function runSmokeAssertions(){for(const [name,file] of cases){const result=spawnSync(process.execPath,[path.join(dir,file)],{cwd:path.join(dir,'..'),encoding:'utf8',windowsHide:true,timeout:120_000,env:{...process.env,CONDUCTOR_SMOKE:'1'}});assert.equal(result.status,0,`${name} failed\n${result.stdout}\n${result.stderr}`)}return cases.map(([name])=>name)}
