import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { appendEvent } from '../src/registry.mjs';
import { statePaths } from '../src/conductor.mjs';
import { createViewerServer } from '../src/viewer.mjs';

const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'conductor-viewerb-'));
const identity=(id=randomUUID())=>({runId:id,feature:'f',role:'writer',cwd:process.cwd(),attempt:1});
const started=(state)=>{const stateDir=temp(),runId=randomUUID(),paths=statePaths(stateDir,runId),base=identity(runId);fs.mkdirSync(paths.attempts,{recursive:true});fs.mkdirSync(paths.parks,{recursive:true});fs.writeFileSync(paths.manifest,JSON.stringify({feature:'f',role:'writer',canonicalCwd:process.cwd()}));appendEvent(paths.ledger,{...base,event:'started'},{generation:1});if(state==='waiting_operator')appendEvent(paths.ledger,{...base,event:'waiting_operator'},{generation:1});if(state==='investigate')appendEvent(paths.ledger,{...base,event:'investigate',reason:'x'},{generation:1});return {stateDir,runId,paths,base}};
const listen=async(s)=>{await new Promise(r=>s.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${s.address().port}`};
const fakeSpawn=(calls)=>(cmd,args,opts)=>{calls.push({cmd,args,opts});return {unref(){}}};
const post=(base,p,body,headers={})=>fetch(`${base}${p}`,{method:'POST',headers:{'content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
const authed={'x-conductor':'1'};

test('viewer-b resume: 404 unknown runId, 400 bad body, 403 missing guard, 200 spawns detached resume for waiting_operator',async(t)=>{
  const calls=[]; const {stateDir,runId}=started('waiting_operator');
  const s=createViewerServer({stateDir,spawnFn:fakeSpawn(calls)}); t.after(()=>s.close());
  const base=await listen(s);
  assert.equal((await post(base,'/api/resume',{runId:'nope'},authed)).status,404);
  assert.equal((await post(base,'/api/resume','{}',authed)).status,400);
  assert.equal((await post(base,'/api/resume',{runId},{})).status,403);
  const r=await post(base,'/api/resume',{runId},authed);
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{ok:true});
  assert.equal(calls.length,1);
  assert.equal(calls[0].cmd,process.execPath);
  assert.ok(calls[0].args.includes('resume'));
  assert.ok(calls[0].args.includes('--state'));
  assert.ok(calls[0].args.includes(stateDir));
  assert.equal(calls[0].args.at(-1),runId);
  assert.equal(calls[0].opts.detached,true);
  assert.equal(calls[0].opts.stdio,'ignore');
});

test('viewer-b resume: investigate (parked) is resumable; a live started run is not (409)',async(t)=>{
  const calls=[];
  const parked=started('investigate');
  const s1=createViewerServer({stateDir:parked.stateDir,spawnFn:fakeSpawn(calls)}); t.after(()=>s1.close());
  const base1=await listen(s1);
  assert.equal((await post(base1,'/api/resume',{runId:parked.runId},authed)).status,200);

  const running=started();
  const s2=createViewerServer({stateDir:running.stateDir,spawnFn:fakeSpawn(calls)}); t.after(()=>s2.close());
  const base2=await listen(s2);
  assert.equal((await post(base2,'/api/resume',{runId:running.runId},authed)).status,409);
});

test('viewer-b launch: 400 missing/empty worktree, 403 missing guard, success writes card + spawns run',async(t)=>{
  const calls=[]; const stateDir=temp();
  const s=createViewerServer({stateDir,spawnFn:fakeSpawn(calls)}); t.after(()=>s.close());
  const base=await listen(s);
  assert.equal((await post(base,'/api/launch',{card:{}},authed)).status,400);
  assert.equal((await post(base,'/api/launch',{card:{worktree:''}},authed)).status,400);
  assert.equal((await post(base,'/api/launch',{},authed)).status,400);
  assert.equal((await post(base,'/api/launch',{card:{worktree:'/x'}},{})).status,403);
  const r=await post(base,'/api/launch',{card:{worktree:'/some/worktree',feature:'f'}},authed);
  assert.equal(r.status,200);
  const j=await r.json();
  assert.equal(j.ok,true);
  assert.ok(fs.existsSync(j.cardPath));
  assert.deepEqual(JSON.parse(fs.readFileSync(j.cardPath,'utf8')),{worktree:'/some/worktree',feature:'f'});
  assert.equal(calls.length,1);
  assert.ok(calls[0].args.includes('run'));
  assert.ok(calls[0].args.includes('--card'));
  assert.ok(calls[0].args.includes(j.cardPath));
  assert.ok(calls[0].args.includes('--state'));
  assert.ok(calls[0].args.includes(stateDir));
});

test('viewer-b roles: 200 with roles.json contents',async(t)=>{
  const stateDir=temp();
  const s=createViewerServer({stateDir}); t.after(()=>s.close());
  const base=await listen(s);
  const roles=await fetch(`${base}/api/roles`);
  assert.equal(roles.status,200);
  const rj=await roles.json();
  assert.ok(rj.writer);
  assert.ok(Array.isArray(rj.writer.tools));
});

test('viewer-b mission: 404 when absent, 200 with contents when present',async(t)=>{
  const stateDir=temp();
  const s=createViewerServer({stateDir}); t.after(()=>s.close());
  const base=await listen(s);
  assert.equal((await fetch(`${base}/api/mission`)).status,404);
  fs.writeFileSync(path.join(stateDir,'mission.json'),JSON.stringify({name:'m'}));
  const r=await fetch(`${base}/api/mission`);
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{name:'m'});
});

test('viewer-b static: no dist -> falls back to inline page; unrelated paths 404; guards enforced on new POSTs',async(t)=>{
  const stateDir=temp();
  // distRoot injected as an empty dir: the fallback must not depend on whether
  // the real conductor/ui/dist happens to be built in this checkout.
  const s=createViewerServer({stateDir,distRoot:path.join(temp(),'no-dist')}); t.after(()=>s.close());
  const base=await listen(s);
  const root=await fetch(`${base}/`);
  assert.equal(root.status,200);
  assert.equal((await root.text()).includes('Conductor'),true);
  assert.equal((await fetch(`${base}/../src/viewer.mjs`)).status,404);
  assert.equal((await fetch(`${base}/assets/app.js`)).status,404);
  assert.equal((await post(base,'/api/resume',{runId:'x'},{})).status,403);
  assert.equal((await post(base,'/api/launch',{card:{worktree:'/x'}},{})).status,403);
});

test('viewer-b static: with dist present, serves index.html and assets with correct content-type, and blocks traversal',async(t)=>{
  const distRoot=path.join(temp(),'dist');
  fs.mkdirSync(path.join(distRoot,'assets'),{recursive:true});
  fs.writeFileSync(path.join(distRoot,'index.html'),'<!doctype html><title>deck</title>');
  fs.writeFileSync(path.join(distRoot,'assets','app.js'),'export default 1;');
  fs.writeFileSync(path.join(distRoot,'assets','style.css'),'body{}');
  const stateDir=temp();
  const s=createViewerServer({stateDir,distRoot}); t.after(()=>s.close());
  const base=await listen(s);
  const root=await fetch(`${base}/`);
  assert.equal(root.status,200);
  assert.equal(root.headers.get('content-type'),'text/html');
  assert.equal((await root.text()).includes('deck'),true);
  const js=await fetch(`${base}/assets/app.js`);
  assert.equal(js.status,200);
  assert.equal(js.headers.get('content-type'),'text/javascript');
  const css=await fetch(`${base}/assets/style.css`);
  assert.equal(css.status,200);
  assert.equal(css.headers.get('content-type'),'text/css');
  // path-traversal-style request: normalized by URL parsing to /src/viewer.mjs
  // (outside dist root), which does not exist under dist -> 404, not the real
  // repo source file.
  const trav=await fetch(`${base}/../src/viewer.mjs`);
  assert.equal(trav.status,404);
  const missing=await fetch(`${base}/assets/nope.js`);
  assert.equal(missing.status,404);
  const malformed=await fetch(`${base}/%zz`);
  assert.equal(malformed.status,404);
});
