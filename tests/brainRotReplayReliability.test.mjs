import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const core={},games={};
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(compile('lib/brainRot/core.ts'),{exports:core,structuredClone});
vm.runInNewContext(compile('lib/brainRot/games.ts'),{exports:games,require:()=>core,structuredClone});
const inputs=['left',null,'up','right',null,'down','hold',null,'tap','slice','release',null];
for(const {id} of core.GAMES){
 test(id+' deterministic replay survives serialized split at every checkpoint',()=>{
  for(let seed=1;seed<=16;seed++){
   let live=games.createGame(id,3,seed),replay=games.restore(games.serialize(live));
   for(let frame=0;frame<240;frame++){
    const input=inputs[(frame+seed)%inputs.length],before=games.serialize(live);
    const stepped=games.step(live,input);
    assert.equal(games.serialize(live),before,'step mutated input '+id+'/'+seed+'/'+frame);
    live=stepped;replay=games.step(replay,input);
    assert.equal(games.serialize(replay),games.serialize(live),'replay divergence '+id+'/'+seed+'/'+frame);
    if(frame%23===0)replay=games.restore(games.serialize(replay));
   }
  }
 });
}
test('all completed banks conserve credit across seeded forty-segment replay and restore',()=>{
 for(let seed=1;seed<=25;seed++){
  let boss=core.newBoss(seed),replay=JSON.parse(JSON.stringify(boss));
  for(let segment=0;segment<40;segment++){
   const before=JSON.stringify(boss),id=boss.queue[boss.index];
   boss=core.advanceBoss(boss,15000,seed);replay=core.advanceBoss(JSON.parse(JSON.stringify(replay)),15000,seed);
   assert.equal(JSON.stringify(boss),JSON.stringify(replay));
   assert.equal(Object.values(boss.seconds).reduce((a,b)=>a+b,0),(segment+1)*15);
   assert.equal(boss.won,segment===39);
   assert.notEqual(before,JSON.stringify(boss));
   if(segment<39)assert.notEqual(boss.queue[boss.index],id);
  }
  assert.ok(Object.values(boss.seconds).every(n=>n===60));
 }
});
