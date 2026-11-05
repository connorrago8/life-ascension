import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const modules={};
for(const name of ['core','games','bossHandoff']){
 const exports={};
 const code=ts.transpileModule(fs.readFileSync('lib/brainRot/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,structuredClone,require:path=>modules[path.replace('./','')]});
 modules[name]=exports;
}
const {newBoss,advanceBoss,failBossSegment}=modules.core;
const {createGame}=modules.games;
const {handoffBossSegment}=modules.bossHandoff;
function setup(){
 const boss=newBoss(71);boss.queue=['goblin-jetpack','rune-fusion',...boss.queue.filter(id=>!['goblin-jetpack','rune-fusion'].includes(id))];boss.segmentMs=14990;
 const outgoing=createGame('goblin-jetpack',3,123);outgoing.tick=60;outgoing.score=4;outgoing.goal=Number.MAX_SAFE_INTEGER;
 return {boss,outgoing};
}
test('handoff pairs selected game, bank and independent retry snapshot',()=>{
 const {boss,outgoing}=setup();const advanced=advanceBoss(boss,1000/60,71);
 const result=handoffBossSegment(advanced,outgoing,71);
 assert.equal(result.active.id,'rune-fusion');
 assert.equal(result.active.goal,Number.MAX_SAFE_INTEGER);
 assert.equal(result.boss.seconds['goblin-jetpack'],15);
 assert.equal(result.boss.states['goblin-jetpack'].score,4);
 assert.deepEqual(result.boss.states['rune-fusion'],result.active);
 assert.deepEqual(result.boss.snapshots['rune-fusion'],result.active);
 result.active.grid[0]=128;
 assert.notEqual(result.boss.snapshots['rune-fusion'].grid[0],128);
 assert.equal(boss.index,0);assert.equal(boss.states['rune-fusion'],undefined);
});
test('revisited game preserves full bank without mutating prior boss state',()=>{
 const {boss,outgoing}=setup();const saved=createGame('rune-fusion',3,555);saved.grid=[8,4,2,0,0,0,0,0,0,0,0,0,0,0,0,0];saved.score=19;saved.tick=120;
 boss.states['rune-fusion']=saved;const before=JSON.stringify(boss);
 const result=handoffBossSegment(advanceBoss(boss,1000/60,71),outgoing,71);
 assert.equal(result.active.score,19);assert.equal(result.active.seed,555);assert.deepEqual(result.active.grid,saved.grid);
 assert.equal(JSON.stringify(boss),before);
 result.active.grid[0]=64;assert.equal(saved.grid[0],8);
});
test('loss in the incoming portal restores its handoff entry, not the outgoing game',()=>{
 const {boss,outgoing}=setup();const handoff=handoffBossSegment(advanceBoss(boss,1000/60,71),outgoing,71);
 const entry=structuredClone(handoff.active);handoff.active.grid[0]=64;
 const failed=failBossSegment(handoff.boss);
 assert.equal(failed.boss.hearts,2);assert.equal(failed.boss.segmentMs,0);
 assert.deepEqual(failed.restore,entry);assert.equal(failed.restore.id,'rune-fusion');
 assert.equal(failed.boss.seconds['goblin-jetpack'],15);assert.equal(failed.boss.seconds['rune-fusion'],0);
});
test('queue rollover with only one unfinished game snapshots the latest outgoing state',()=>{
 const {boss,outgoing}=setup();boss.queue=['goblin-jetpack'];boss.index=0;
 for(const id of Object.keys(boss.seconds))boss.seconds[id]=60;
 boss.seconds['goblin-jetpack']=15;
 const advanced=advanceBoss(boss,1000/60,71);const result=handoffBossSegment(advanced,outgoing,71);
 assert.equal(result.active.id,'goblin-jetpack');assert.equal(result.active.score,4);
 assert.equal(result.boss.seconds['goblin-jetpack'],30);assert.equal(result.boss.snapshots['goblin-jetpack'].score,4);
});
test('completed boss cannot start another handoff',()=>{
 const {boss,outgoing}=setup();boss.won=true;
 assert.throws(()=>handoffBossSegment(boss,outgoing,71),/nonterminal selected portal/);
});
