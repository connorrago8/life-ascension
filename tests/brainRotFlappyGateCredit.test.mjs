import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const core={},games={};const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(compile('lib/brainRot/core.ts'),{exports:core,structuredClone});vm.runInNewContext(compile('lib/brainRot/games.ts'),{exports:games,require:()=>core,structuredClone});
function fixture(y=.5,x=.504,vx=-.0045){const s=games.createGame('flappy-wyvern',1,9);s.player.y=y;s.entities=[{x,y:.28,vx,vy:0,type:2},{x,y:.72,vx,vy:0,type:3}];return s;}
for(const post of ['top','bottom'])for(const reverse of [false,true]){
 test(`${post} lethal gate crossing awards no progress/score in ${reverse?'reversed':'normal'} entity order`,()=>{
  const s=fixture(post==='top'?.3:.7);s.progress=s.goal-1;s.score=80;if(reverse)s.entities.reverse();
  const before=games.serialize(s),n=games.step(s,null);
  assert.equal(n.lost,true);assert.equal(n.won,false);assert.equal(n.progress,s.progress);assert.equal(n.score,80);assert.equal(games.serialize(s),before);
 });
}
test('clear gate pair credits once and a goal-reaching pass wins',()=>{
 const s=fixture();s.progress=s.goal-1;s.score=80;const n=games.step(s,null);
 assert.equal(n.lost,false);assert.equal(n.won,true);assert.equal(n.progress,s.goal);assert.equal(n.score,90);assert.equal(games.step(n,null),n);
});
test('stationary already-passed post never farms progress while idle',()=>{
 let s=fixture(.5,.499,0);
 for(let i=0;i<4;i++)s=games.step(s,null);
 assert.equal(s.progress,0);assert.equal(s.score,0);assert.equal(s.won,false);
});
test('a gate still ahead grants no early credit',()=>{
 const n=games.step(fixture(.5,.65),null);assert.equal(n.progress,0);assert.equal(n.score,0);assert.equal(n.lost,false);
});
test('steering right through a clear gap counts the relative-plane pass once',()=>{
 const s=fixture(.5,.52);const n=games.step(s,'right');assert.equal(n.progress,1);assert.equal(n.score,10);assert.equal(n.lost,false);
 const next=games.step(n,null);assert.equal(next.progress,1);assert.equal(next.score,10);
});
test('steering left back in front of a gate never grants reverse credit',()=>{
 const n=games.step(fixture(.5,.48),'left');assert.equal(n.progress,0);assert.equal(n.score,0);
});
test('a lethal second pair suppresses earlier clear-pair credit in the same frame',()=>{
 const s=fixture();s.entities.push({x:.504,y:.6,vx:-.0045,vy:0,type:2});const n=games.step(s,null);
 assert.equal(n.lost,true);assert.equal(n.progress,0);assert.equal(n.score,0);
});
test('actual generated gate pair passes safely and preserves serialized replay across tiers/seeds',()=>{
 for(const tier of [1,2,3])for(let seed=1;seed<=30;seed++){
  const s=games.createGame('flappy-wyvern',tier,seed);s.tick=99;s.player.vy=0;s.player.y=.5;
  const spawned=games.step(s,null);assert.equal(spawned.entities.length,2);
  const center=(spawned.entities[0].y+spawned.entities[1].y)/2;
  const pair=spawned.entities.map(e=>({...e,x:.504}));const encounter={...spawned,player:{...spawned.player,y:center,vy:0},entities:pair};
  const a=games.step(encounter,null),b=games.step(games.restore(games.serialize(encounter)),null);
  assert.equal(a.progress,1);assert.equal(a.score,10);assert.equal(a.lost,false);assert.equal(games.serialize(a),games.serialize(b));
 }
});

test('a gate exactly on the previous player plane counts once across steering positions',()=>{
 for(let offset=-9;offset<=9;offset++){
  const x=.5+offset*.045;if(x<.07||x>.93)continue;
  const s=fixture(.5,x);s.player.x=x;const n=games.step(s,null);
  assert.equal(n.progress,1);assert.equal(n.score,10);assert.equal(n.lost,false);
  assert.equal(games.step(n,null).progress,1);
 }
});
