import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const core={},games={};
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(compile('lib/brainRot/core.ts'),{exports:core,structuredClone});
vm.runInNewContext(compile('lib/brainRot/games.ts'),{exports:games,require:()=>core,structuredClone});
const timed=s=>games.hillSlope(s.glide.distance)>=0?'hold':null;
for(const tier of [1,2,3]){
 test(`tier${tier}: idle and constant dive cannot clear or score across50 seeds`,()=>{
  for(let seed=1;seed<=50;seed++)for(const input of [null,'hold']){
   let s=games.createGame('hill-glider',tier,seed);
   for(let i=0;i<6000&&!s.lost&&!s.won;i++)s=games.step(s,input);
   assert.equal(s.won,false);assert.equal(s.progress,0);assert.equal(s.score,0);assert.equal(s.lost,true);assert.equal(s.glide.stall,90);
  }
 });
 test(`tier${tier}: timed downhill dives and uphill releases clear a real course`,()=>{
  for(let seed=1;seed<=20;seed++){
   let s=games.createGame('hill-glider',tier,seed),launches=0,landings=0;
   for(let i=0;i<3000&&!s.lost&&!s.won;i++){
    const before=s;s=games.step(s,timed(s));
    if(before.glide.grounded&&!s.glide.grounded)launches++;
    if(s.progress>before.progress){landings++;assert.equal(before.glide.grounded,false);assert.equal(s.glide.grounded,true);assert.ok(games.hillSlope(s.glide.distance)>.04);}
   }
   assert.equal(s.won,true);assert.equal(s.lost,false);assert.equal(s.goal,[6,9,12][tier-1]);assert.equal(s.progress,s.goal);assert.equal(landings,s.goal);assert.ok(launches>=landings);assert.equal(s.score,10*s.progress);
  }
 });
}
test('one landing credits once; remaining on the ground earns nothing',()=>{
 let s=games.createGame('hill-glider',1,1);while(!s.progress)s=games.step(s,timed(s));
 const p=s.progress;for(let i=0;i<10;i++)s=games.step(s,'hold');assert.equal(s.progress,p);
});
test('restored airborne glider and input replay equal uninterrupted physics without input mutation',()=>{
 let live=games.createGame('hill-glider',3,12);while(live.glide.grounded)live=games.step(live,timed(live));
 let replay=games.restore(games.serialize(live));
 for(let i=0;i<1000&&!live.won&&!live.lost;i++){
  const raw=games.serialize(live),input=timed(live),next=games.step(live,input);
  assert.equal(games.serialize(live),raw);live=next;replay=games.step(replay,input);
  assert.equal(games.serialize(replay),games.serialize(live));assert.equal(core.validGameState(live),true);
  if(i%19===0)replay=games.restore(games.serialize(replay));
 }
});
test('boss goal stays uncapped by level goal, supports15 seconds of genuine gliding',()=>{
 let s=games.createGame('hill-glider',3,8);s.goal=Number.MAX_SAFE_INTEGER;
 for(let frame=0;frame<900;frame++)s=games.step(s,timed(s));
 assert.equal(s.won,false);assert.equal(s.lost,false);assert.equal(s.tick,900);assert.ok(s.progress>0);
});
test('legacy timer-only active state restarts only the challenge with zero unearned credit',()=>{
 const old=games.createGame('hill-glider',1,5);delete old.glide;old.progress=34;old.score=100;old.goal=35;
 const n=games.step(old,null);assert.equal(n.progress,0);assert.equal(n.score,0);assert.equal(n.goal,6);assert.ok(n.glide);assert.equal(n.lost,false);
 old.goal=Number.MAX_SAFE_INTEGER;assert.equal(games.step(old,null).goal,Number.MAX_SAFE_INTEGER);
});
test('malformed optional glider physics is rejected; old snapshots remain readable',()=>{
 const s=games.createGame('hill-glider',1,6);assert.equal(core.validGameState(s),true);
 for(const patch of [{distance:NaN},{distance:1e308},{distance:-1},{grounded:'yes'},{stall:-1},{stall:.5},{stall:91}])assert.equal(core.validGameState({...s,glide:{...s.glide,...patch}}),false);
 const old={...s};delete old.glide;assert.equal(core.validGameState(old),true);
 assert.equal(core.validGameState({...s,id:'goblin-jetpack'}),false);
});
test('paused and terminal glider states are immutable',()=>{
 const s=games.createGame('hill-glider',1,8);assert.equal(games.step(s,'hold',0),s);
 for(const flag of ['won','lost']){const end={...s,[flag]:true};assert.equal(games.step(end,'hold'),end);}
});
