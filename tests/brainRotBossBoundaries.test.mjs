/** Fresh test-only contracts; not an approval of the implementation author. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const core = {}, games = {};
const compile = p => ts.transpileModule(fs.readFileSync(p,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(compile('lib/brainRot/core.ts'), {exports:core,structuredClone});
vm.runInNewContext(compile('lib/brainRot/games.ts'), {exports:games,require:()=>core,structuredClone});

test('fifty seeded boss schedules require forty complete segments and credit each game exactly sixty seconds', () => {
  for(let seed=1;seed<=50;seed++) {
    let boss=core.newBoss(seed);const visits=new Map();let previous=null;
    for(let segment=0;segment<40;segment++) {
      const id=boss.queue[boss.index];assert.notEqual(id,previous);
      visits.set(id,(visits.get(id)||0)+1);previous=id;
      boss=core.advanceBoss(boss,15000,seed);
      assert.equal(boss.won,segment===39);
      assert.equal(Object.values(boss.seconds).reduce((a,b)=>a+b,0),(segment+1)*15);
    }
    for(const g of core.GAMES){assert.equal(boss.seconds[g.id],60);assert.equal(visits.get(g.id),4);}
  }
});

test('a failed late boss segment preserves completed credit and restores an independent entry snapshot', () => {
  let boss=core.newBoss(71);
  for(let i=0;i<19;i++)boss=core.advanceBoss(boss,15000,71);
  const id=boss.queue[boss.index],entry=games.createGame(id,3,29);entry.goal=Number.MAX_SAFE_INTEGER;
  boss=core.beginBossSegment(boss,id,entry);
  const expected=JSON.stringify(entry);entry.player.y=.123;entry.grid[0]=64;
  const before=JSON.stringify(boss.seconds);
  boss=core.advanceBoss(boss,14999,71);
  const result=core.failBossSegment(boss);
  assert.equal(JSON.stringify(result.boss.seconds),before);
  assert.equal(result.boss.segmentMs,0);assert.equal(result.boss.hearts,2);
  assert.equal(JSON.stringify(result.restore),expected);
  result.restore.player.y=.999;
  assert.notEqual(boss.snapshots[id].player.y,.999,'returned retry state must not mutate the retained entry snapshot');
});

test('invalid or paused time deltas cannot create boss progress', () => {
  const boss=core.newBoss(3);
  for(const delta of [0,-1,NaN,Infinity])assert.equal(JSON.stringify(core.advanceBoss(boss,delta,3)),JSON.stringify(boss));
});
