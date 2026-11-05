import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
// FIFO lock model for deterministic unit contracts, not a native browser proof.
function fixture(mode='supported'){
 const values=new Map(),writes=[],requests=[];let tail=Promise.resolve(),hold;
 const gate=new Promise(r=>{hold=r;});
 const locks={request(name,options,callback){
  requests.push({name,mode:options.mode});
  const next=tail.then(async()=>{if(mode==='held')await gate;if(mode==='rejected')throw Error('denied');if(options.signal.aborted)throw Error('aborted');return callback();});
  tail=next.catch(()=>{});return next;
 }};
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);writes.push(k);},removeItem:k=>{values.delete(k);writes.push(k);}};
 const core={},writer={};
 const scope={localStorage:storage,structuredClone,AbortController,setTimeout,clearTimeout};
 vm.runInNewContext(compile('lib/brainRot/core.ts'),{exports:core,...scope});
 vm.runInNewContext(compile('lib/brainRot/checkpointWriter.ts'),{exports:writer,require:()=>core,...scope,...(mode==='missing'?{}:{navigator:{locks}})});
 const run=core.newRun(93);core.saveCheckpoint(run,null);writes.length=0;
 return {core,writer,run,values,writes,requests,release:hold};
}
test('serialized peer completion cannot be overwritten by an older level snapshot',async()=>{
 const f=fixture(),a=f.writer.createCheckpointWriter(),b=f.writer.createCheckpointWriter();
 assert.deepEqual(await Promise.all([b.commitExclusive(f.core.completeLevel(f.run),null),a.commitExclusive(f.run,null)]),['saved','conflict']);
 assert.equal(f.core.readCheckpoint().run.level,2);assert.equal(f.core.readRun().level,2);assert.equal(f.core.readCheckpoint().revision,2);
 assert.ok(f.requests.every(r=>r.name===f.writer.CHECKPOINT_LOCK&&r.mode==='exclusive'));
});
test('serialized peer heart loss cannot be undone by an older heart snapshot',async()=>{
 const f=fixture(),a=f.writer.createCheckpointWriter(),b=f.writer.createCheckpointWriter();
 assert.deepEqual(await Promise.all([b.commitExclusive({...f.run,hearts:2},null),a.commitExclusive(f.run,null)]),['saved','conflict']);
 assert.equal(f.core.readCheckpoint().run.hearts,2);assert.equal(f.core.readRun().hearts,2);
});
test('same writer queued saves preserve order and advance revisions once each',async()=>{
 const f=fixture(),w=f.writer.createCheckpointWriter();
 assert.deepEqual(await Promise.all([w.commitExclusive({...f.run,hearts:2},null),w.commitExclusive({...f.run,hearts:1},null)]),['saved','saved']);
 assert.equal(f.core.readCheckpoint().revision,3);assert.equal(f.core.readRun().hearts,1);
});
test('queued payload is a snapshot even if the caller later mutates its run',async()=>{
 const f=fixture('held'),w=f.writer.createCheckpointWriter(),run=structuredClone(f.run);
 const result=w.commitExclusive(run,null);run.hearts=1;f.release();
 assert.equal(await result,'saved');assert.equal(f.core.readRun().hearts,3);
});
for(const mode of ['missing','rejected'])test(`${mode} Web Locks never falls back to unsafe writes`,async()=>{
 const f=fixture(mode),w=f.writer.createCheckpointWriter(),before=new Map(f.values);
 assert.equal(await w.commitExclusive({...f.run,hearts:2},null),'unavailable');
 assert.deepEqual(f.values,before);assert.deepEqual(f.writes,[]);
});
test('storage changes while waiting are checked inside the exclusive callback',async()=>{
 const f=fixture('held'),w=f.writer.createCheckpointWriter(),result=w.commitExclusive(f.run,null);
 f.core.saveCheckpoint({...f.run,hearts:2},null);const before=new Map(f.values);f.writes.length=0;f.release();
 assert.equal(await result,'conflict');assert.deepEqual(f.values,before);assert.deepEqual(f.writes,[]);
});
