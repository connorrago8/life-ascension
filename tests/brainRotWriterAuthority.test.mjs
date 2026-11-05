import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function fixture(){
 const values=new Map(),writes=[];let blocked=null;
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(blocked===k)throw Error('quota');writes.push(k);values.set(k,String(v));},removeItem:k=>{writes.push(k);values.delete(k);}};
 const core={},games={},writer={};
 vm.runInNewContext(compile('lib/brainRot/core.ts'),{exports:core,localStorage:storage,structuredClone});
 vm.runInNewContext(compile('lib/brainRot/games.ts'),{exports:games,require:()=>core,structuredClone});
 vm.runInNewContext(compile('lib/brainRot/checkpointWriter.ts'),{exports:writer,require:()=>core,localStorage:storage,structuredClone});
 const run=core.newRun(93),state=games.createGame(core.currentGame(run),1,123);
 core.saveCheckpoint(run,{level:1,state});writes.length=0;
 return {values,writes,storage,core,games,writer,run,state,block:k=>{blocked=k;}};
}
const plain=v=>JSON.parse(JSON.stringify(v));
test('stale level writer touches neither atomic nor either legacy save after a newer completion',()=>{
 const f=fixture(),a=f.writer.createCheckpointWriter(),b=f.writer.createCheckpointWriter();
 const next=f.core.completeLevel(f.run);
 assert.equal(a.commit(next,null),'saved');const before=new Map(f.values);f.writes.length=0;
 assert.equal(b.commit(f.run,{level:1,state:f.state}),'conflict');
 assert.deepEqual(f.values,before);assert.deepEqual(f.writes,[]);
 assert.equal(f.core.readCheckpoint().run.level,2);assert.equal(f.core.readRun().level,2);
});
test('stale writer cannot resurrect a spent heart and explicit fresh reader may continue',()=>{
 const f=fixture(),a=f.writer.createCheckpointWriter(),b=f.writer.createCheckpointWriter();
 assert.equal(a.commit({...f.run,hearts:2},null),'saved');
 assert.equal(b.commit(f.run,{level:1,state:f.state}),'conflict');assert.equal(f.core.readRun().hearts,2);
 const fresh=f.writer.createCheckpointWriter();assert.equal(fresh.checkpoint.run.hearts,2);
 assert.equal(fresh.commit({...f.run,hearts:2},{level:1,state:f.state}),'saved');
 assert.equal(f.core.readCheckpoint().revision,3);
});
test('same tab can repeatedly advance its own revision without false conflicts',()=>{
 const f=fixture(),w=f.writer.createCheckpointWriter();
 for(let i=1;i<=4;i++)assert.equal(w.commit(f.run,{level:1,state:{...f.state,tick:i}}),'saved');
 assert.equal(f.core.readCheckpoint().revision,5);assert.equal(f.core.readCheckpoint().active.state.tick,4);
 assert.equal(w.isCurrent(),true);
});
test('exact raw checkpoint guard catches changed content even with an unchanged revision',()=>{
 const f=fixture(),w=f.writer.createCheckpointWriter(),raw=f.core.readCheckpoint();
 raw.run.hearts=2;f.storage.setItem(f.core.CHECKPOINT_KEY,JSON.stringify(raw));f.writes.length=0;
 assert.equal(w.isCurrent(),false);assert.equal(w.commit(f.run,null),'conflict');assert.deepEqual(f.writes,[]);
});
test('removed checkpoint does not let a stale writer recreate an earlier attempt',()=>{
 const f=fixture(),w=f.writer.createCheckpointWriter();f.storage.removeItem(f.core.CHECKPOINT_KEY);f.writes.length=0;
 assert.equal(w.commit(f.run,null),'conflict');assert.deepEqual(f.writes,[]);
});
test('failed atomic write leaves legacy saves untouched and same tab may retry later',()=>{
 const f=fixture(),w=f.writer.createCheckpointWriter(),before=new Map(f.values);
 f.block(f.core.CHECKPOINT_KEY);assert.equal(w.commit(f.run,null),'unavailable');assert.deepEqual(f.values,before);assert.deepEqual(f.writes,[]);
 f.block(null);assert.equal(w.commit(f.run,null),'saved');assert.equal(f.core.readCheckpoint().revision,2);
});
test('legacy mirror failure cannot erase an accepted authoritative checkpoint',()=>{
 const f=fixture(),w=f.writer.createCheckpointWriter();f.block(f.core.SAVE_KEY);
 assert.equal(w.commit({...f.run,hearts:2},null),'saved');assert.equal(f.core.readCheckpoint().run.hearts,2);
 assert.equal(w.isCurrent(),true);
});
test('completed boss rejects every bank and failure action without changing hearts or time',()=>{
 const f=fixture();
 for(const game of f.core.GAMES){
  const boss=f.core.newBoss(93);boss.won=true;boss.segmentMs=15000;
  for(const id of Object.keys(boss.seconds))boss.seconds[id]=60;
  const index=boss.queue.indexOf(game.id);boss.index=index;
  const state=f.games.createGame(game.id,3,123);state.goal=Number.MAX_SAFE_INTEGER;boss.states[game.id]=state;
  const run={...f.run,level:31,best:31,boss},before=plain(boss);
  assert.equal(f.core.resumeGameState(run,{level:31,state}),null);
  assert.equal(f.core.resumeGameState(run,null),null);
  const failed=f.core.failBossSegment(boss);assert.equal(failed.reset,false);assert.deepEqual(plain(failed.boss),before);
  const w=f.writer.createCheckpointWriter();assert.equal(w.commit(run,{level:31,state}),'saved');assert.equal(f.core.readCheckpoint().active,null);
 }
});
