/** Deterministic storage-protocol regressions, NOT native concurrent-browser evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
 const values=new Map(),writes=[];
 let interleave=null;
 function tab(name){
  const core={},games={},writer={};
  const storage={
   getItem(key){
    const observed=values.get(key)??null;
    // Model the other execution context completing after this read has observed
    // its value, but before this context can continue to its next instruction.
    if(interleave?.tab===name&&key==='life-ascension:brain-rot:checkpoint:v1'){
     const action=interleave.action;interleave=null;action();
    }
    return observed;
   },
   setItem(key,value){writes.push({tab:name,key});values.set(key,String(value));},
   removeItem(key){writes.push({tab:name,key});values.delete(key);},
  };
  vm.runInNewContext(compile('lib/brainRot/core.ts'),{exports:core,localStorage:storage,structuredClone});
  vm.runInNewContext(compile('lib/brainRot/games.ts'),{exports:games,require:()=>core,structuredClone});
  vm.runInNewContext(compile('lib/brainRot/checkpointWriter.ts'),{exports:writer,require:()=>core,localStorage:storage,structuredClone});
  return {core,games,writer};
 }
 const a=tab('A'),b=tab('B');
 const run=a.core.newRun(93),state=a.games.createGame(a.core.currentGame(run),1,123);
 a.core.saveCheckpoint(run,{level:1,state});writes.length=0;
 const wa=a.writer.createCheckpointWriter(),wb=b.writer.createCheckpointWriter();
 return {a,b,wa,wb,run,state,values,writes,arm(action){interleave={tab:'A',action};}};
}

test('overlapping guard reads cannot roll back another context’s accepted level completion',()=>{
 const f=setup(),completed=f.b.core.completeLevel(plain(f.run));
 assert.equal(f.a.core.validRun(completed),true);
 let peerResult;
 f.arm(()=>{peerResult=f.wb.commit(completed,null);});
 const staleResult=f.wa.commit(f.run,{level:1,state:f.state});
 const recovered=f.b.core.readCheckpoint();
 console.log(JSON.stringify({case:'interleaved-level-write',peerResult,staleResult,expectedLevel:2,actualLevel:recovered.run.level,revision:recovered.revision,legacyLevel:f.b.core.readRun().level}));
 assert.equal(peerResult,'saved','peer’s valid newer state must actually be saved');
 assert.equal(recovered.run.level,2,'a writer that observed its old guard before a peer commit must not overwrite that peer completion');
 assert.equal(f.b.core.readRun().level,2,'legacy mirror must not undo the accepted completion');
});

test('overlapping guard reads cannot restore a heart spent by another context',()=>{
 const f=setup(),spent={...plain(f.run),hearts:2};
 assert.equal(f.b.core.validRun(spent),true);
 let peerResult;
 f.arm(()=>{peerResult=f.wb.commit(spent,null);});
 const staleResult=f.wa.commit(f.run,{level:1,state:f.state});
 const recovered=f.b.core.readCheckpoint();
 console.log(JSON.stringify({case:'interleaved-heart-write',peerResult,staleResult,expectedHearts:2,actualHearts:recovered.run.hearts,revision:recovered.revision,legacyHearts:f.b.core.readRun().hearts}));
 assert.equal(peerResult,'saved');
 assert.equal(recovered.run.hearts,2,'overlapping stale writer must not restore an accepted spent heart');
 assert.equal(f.b.core.readRun().hearts,2);
});

test('control: peer completion before the stale guard is rejected without any further writes',()=>{
 const f=setup();assert.equal(f.wb.commit(f.b.core.completeLevel(plain(f.run)),null),'saved');
 const before=new Map(f.values);f.writes.length=0;
 assert.equal(f.wa.commit(f.run,{level:1,state:f.state}),'conflict');
 assert.deepEqual(f.values,before);assert.deepEqual(f.writes,[]);
});

test('control: reverse serialized order preserves the first accepted state and rejects the old peer',()=>{
 const f=setup(),spent={...f.run,hearts:2};
 assert.equal(f.wa.commit(spent,null),'saved');const before=new Map(f.values);f.writes.length=0;
 assert.equal(f.wb.commit(f.run,{level:1,state:f.state}),'conflict');
 assert.deepEqual(f.values,before);assert.deepEqual(f.writes,[]);
});

test('control: explicitly reloaded peer can continue from the accepted checkpoint',()=>{
 const f=setup(),completed=f.b.core.completeLevel(plain(f.run));
 assert.equal(f.wb.commit(completed,null),'saved');
 const fresh=f.a.writer.createCheckpointWriter();
 assert.equal(fresh.checkpoint.run.level,2);assert.equal(fresh.commit(fresh.checkpoint.run,null),'saved');
 assert.equal(f.b.core.readCheckpoint().run.level,2);assert.equal(f.b.core.readCheckpoint().revision,3);
});
