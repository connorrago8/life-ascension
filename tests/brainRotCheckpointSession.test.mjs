import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const core={},session={};
vm.runInNewContext(compile('lib/brainRot/core.ts'),{exports:core,structuredClone});
vm.runInNewContext(compile('lib/brainRot/checkpointSession.ts'),{exports:session,structuredClone});
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const calls=[],statuses=[];
 const commit=(run,active)=>new Promise((resolve,reject)=>calls.push({run:plain(run),active:plain(active),resolve,reject}));
 return{calls,statuses,s:session.createCheckpointSession(commit,x=>statuses.push(x)),run:core.newRun(93)};
}
const flush=()=>Promise.resolve();
test('failed stopped completion retains immutable Level2/null-active snapshot for exit retry',async()=>{
 const f=fixture(),next=core.completeLevel(f.run),first=f.s.save(next,null);next.level=1;
 await flush();f.calls[0].resolve('unavailable');await first;assert.equal(f.s.hasDirty(),true);
 const retry=f.s.retry();await flush();assert.equal(f.calls[1].run.level,2);assert.equal(f.calls[1].active,null);
 f.calls[1].resolve('saved');await retry;assert.equal(f.s.hasDirty(),false);
});
test('failed spent heart retries exact snapshot without restoring a heart',async()=>{
 const f=fixture(),first=f.s.save({...f.run,hearts:2},null);await flush();f.calls[0].resolve('unavailable');await first;
 const retry=f.s.retry();await flush();assert.equal(f.calls[1].run.hearts,2);f.calls[1].resolve('saved');await retry;
});
test('loading a clean paused session and retrying after success perform no extra writes',async()=>{
 const f=fixture();assert.equal(await f.s.retry(),null);assert.equal(f.calls.length,0);
 const first=f.s.save(f.run,null);await flush();f.calls[0].resolve('saved');await first;
 assert.equal(await f.s.retry(),null);assert.equal(f.calls.length,1);
});
test('old success cannot clear newer dirty state or announce it saved',async()=>{
 const f=fixture(),a=f.s.save(f.run,null),b=f.s.save({...f.run,hearts:2},null);await flush();
 f.calls[0].resolve('saved');await a;assert.equal(f.s.hasDirty(),true);assert.deepEqual(f.statuses,['saving','saving']);
 f.calls[1].resolve('unavailable');await b;assert.equal(f.s.hasDirty(),true);assert.equal(f.statuses.at(-1),'unavailable');
 const retry=f.s.retry();await flush();assert.equal(f.calls[2].run.hearts,2);f.calls[2].resolve('saved');await retry;
});
test('repeated lifecycle events coalesce the latest in-flight save',async()=>{
 const f=fixture(),first=f.s.save(f.run,null),r1=f.s.retry(),r2=f.s.retry();assert.equal(r1,first);assert.equal(r2,first);
 await flush();assert.equal(f.calls.length,1);f.calls[0].resolve('saved');await Promise.all([first,r1,r2]);
});
test('any conflict invalidates retry authority even while a newer operation waits',async()=>{
 const f=fixture(),a=f.s.save(f.run,null),b=f.s.save({...f.run,hearts:2},null);await flush();
 f.calls[0].resolve('conflict');await a;assert.equal(f.s.hasDirty(),false);assert.equal(await f.s.retry(),null);
 f.calls[1].resolve('unavailable');await b;assert.deepEqual(f.statuses,['saving','saving','conflict']);
 assert.equal(await f.s.save(f.run,null),'conflict');assert.equal(f.calls.length,2);
});
test('unmount invalidation suppresses late notifications but does not cancel the queued final snapshot',async()=>{
 const f=fixture(),first=f.s.save({...f.run,hearts:2},null);f.s.invalidate();await flush();
 assert.equal(f.calls[0].run.hearts,2);f.calls[0].resolve('saved');await first;assert.deepEqual(f.statuses,['saving']);assert.equal(await f.s.retry(),null);
});
test('unexpected commit rejection retains dirty state and permits retry',async()=>{
 const f=fixture(),first=f.s.save(f.run,null);await flush();f.calls[0].reject(Error('storage'));assert.equal(await first,'unavailable');
 const retry=f.s.retry();await flush();f.calls[1].resolve('saved');assert.equal(await retry,'saved');assert.equal(f.s.hasDirty(),false);
});
test('completed boss snapshot remains terminal through failed-save retry',async()=>{
 const f=fixture(),boss=core.newBoss(93);boss.won=true;boss.segmentMs=15000;for(const id of Object.keys(boss.seconds))boss.seconds[id]=60;
 const run={...f.run,level:31,best:31,boss};assert.equal(core.validRun(run),true);
 const first=f.s.save(run,null);await flush();f.calls[0].resolve('unavailable');await first;
 const retry=f.s.retry();await flush();assert.equal(f.calls[1].run.boss.won,true);assert.equal(f.calls[1].run.boss.segmentMs,15000);assert.equal(f.calls[1].active,null);
 f.calls[1].resolve('saved');await retry;
});
