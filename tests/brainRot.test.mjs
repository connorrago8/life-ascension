import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const cache=new Map();
function load(path){if(cache.has(path))return cache.get(path);const source=fs.readFileSync(path,'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};vm.runInNewContext(js,{exports,require:(name)=>{if(name==='./core')return load('lib/brainRot/core.ts');throw Error(name);},localStorage:undefined,structuredClone});cache.set(path,exports);return exports;}
const core=load('lib/brainRot/core.ts'),games=load('lib/brainRot/games.ts');
test('all thirty levels contain each of ten games exactly once per cycle',()=>{for(let seed=1;seed<101;seed++){const list=core.order(seed);assert.equal(list.length,30);for(let cycle=0;cycle<3;cycle++)assert.equal(new Set(list.slice(cycle*10,cycle*10+10)).size,10);assert.notEqual(list[9],list[10]);assert.notEqual(list[19],list[20]);}});
test('level thirty unlocks boss and does not exceed 31',()=>{let run=core.newRun(42);for(let i=0;i<31;i++)run=core.completeLevel(run);assert.equal(run.level,31);assert.equal(run.best,31);});
test('all ten games create deterministic states and restore exactly',()=>{for(const game of core.GAMES){let a=games.createGame(game.id,1,123);let b=games.createGame(game.id,1,123);for(let i=0;i<25;i++){a=games.step(a,i%3===0?'up':null);b=games.step(b,i%3===0?'up':null);}assert.equal(JSON.stringify(a),JSON.stringify(b),game.id);assert.equal(JSON.stringify(games.restore(games.serialize(a))),JSON.stringify(a));}});
test('paused simulation does not advance',()=>{const state=games.createGame('flappy-wyvern',1,9);assert.equal(games.step(state,null,0),state);});
test('boss rotates every 15 seconds and credits only completed intervals',()=>{let b=core.newBoss(9);const first=b.queue[0];b=core.advanceBoss(b,14999,9);assert.equal(b.seconds[first],0);b=core.advanceBoss(b,1,9);assert.equal(b.seconds[first],15);assert.equal(b.segmentMs,0);});
test('boss clears after four visits to every game',()=>{let b=core.newBoss(13);for(let i=0;i<40;i++)b=core.advanceBoss(b,15000,13);assert.equal(b.won,true);assert.ok(Object.values(b.seconds).every(n=>n===60));});
test('rune fusion combines equal tiles without duplicate merges',()=>{const before=[2,2,2,2,...Array(12).fill(0)];const after=games.moveTiles(before,'left',11);assert.equal(after[0],4);assert.equal(after[1],4);});

test('boss visits all ten portals once before repeating',()=>{let b=core.newBoss(71);const seen=[];for(let i=0;i<10;i++){seen.push(b.queue[b.index]);b=core.advanceBoss(b,15000,71);}assert.equal(new Set(seen).size,10);assert.ok(seen.every(id=>b.seconds[id]===15));});
test('boss checkpoint retains exact segment time',()=>{let b=core.newBoss(71);b=core.advanceBoss(b,8000,71);const restored=JSON.parse(JSON.stringify(b));assert.equal(restored.segmentMs,8000);const first=restored.queue[restored.index];const next=core.advanceBoss(restored,7000,71);assert.equal(next.seconds[first],15);});

test('boss failed segment restores exact entry state and never credits time',()=>{const initial={tick:5,grid:[2,4],player:{x:.5}};let boss=core.newBoss(44);const id=boss.queue[boss.index];boss=core.beginBossSegment(boss,id,initial);initial.tick=999;boss=core.advanceBoss(boss,14000,44);const outcome=core.failBossSegment(boss);assert.equal(outcome.reset,false);assert.equal(outcome.boss.hearts,2);assert.equal(outcome.boss.segmentMs,0);assert.equal(outcome.boss.seconds[id],0);assert.equal(outcome.restore.tick,5);assert.equal(outcome.boss.states[id].tick,5);});
test('boss failure after three hearts resets attempt',()=>{let b=core.newBoss(10);for(let i=0;i<3;i++){const result=core.failBossSegment(b);if(i<2){assert.equal(result.reset,false);b=result.boss;}else assert.equal(result.reset,true);}});

test('flappy wyvern fails on floor contact',()=>{let s=games.createGame('flappy-wyvern',1,4);s.player.y=.939;s.player.vy=.012;const next=games.step(s,null);assert.equal(next.lost,true);});
test('goblin jetpack stays inside arena and zeroes velocity at edge',()=>{let s=games.createGame('goblin-jetpack',1,4);s.player.y=.94;s.player.vy=.01;const next=games.step(s,null);assert.equal(next.player.y,.94);assert.equal(next.player.vy,0);});
test('crossing hazard velocity always points into the playfield',()=>{let s=games.createGame('frog-kings-crossing',1,12);for(let i=0;i<45;i++)s=games.step(s,null);assert.ok(s.entities.length>0);for(const e of s.entities)assert.ok(e.x<0?e.vx>0:e.x>1?e.vx<0:true);});

test('repeated rune swipes work even when previous input matches',()=>{let s=games.createGame('rune-fusion',1,12);s.grid=[2,0,2,0,...Array(12).fill(0)];s.lastInput='left';const n=games.step(s,'left');assert.equal(n.grid[0],4);});
test('repeated crossing swipes advance even after matching prior direction',()=>{let s=games.createGame('frog-kings-crossing',1,12);s.lastInput='up';const n=games.step(s,'up');assert.equal(n.progress,1);});

test('completing objective and touching hazard on same tick is a win',()=>{let s=games.createGame('goblin-jetpack',1,42);s.progress=s.goal-1;s.tick=59;s.entities=[{x:.5,y:.5,vx:0,vy:0,type:0}];const n=games.step(s,null);assert.equal(n.won,true);assert.equal(n.lost,false);});

test('wyvern spawns paired upper and lower gates',()=>{let s=games.createGame('flappy-wyvern',1,42);s.tick=99;s.player.y=.5;s.player.vy=0;s=games.step(s,'tap');assert.ok(s.entities.some(e=>e.type===2),'upper gate should spawn');assert.ok(s.entities.some(e=>e.type===3),'lower gate should spawn');});
test('wyvern scores on gate passage rather than elapsed seconds',()=>{let s=games.createGame('flappy-wyvern',1,42);s.tick=150;s.player.y=.5;s.player.vy=0;s.entities=[{x:.502,y:.2,vx:-.0045,vy:0,type:2},{x:.502,y:.8,vx:-.0045,vy:0,type:3}];const n=games.step(s,null);assert.equal(n.progress,1);assert.equal(n.score,10);assert.equal(n.lost,false);});
test('wyvern collides with upper gate outside gap',()=>{let s=games.createGame('flappy-wyvern',1,42);s.player.y=.25;s.entities=[{x:.5,y:.2,vx:0,vy:0,type:2}];assert.equal(games.step(s,null).lost,true);});

test('rune opening tiles are deterministic, distinct and seed dependent',()=>{const a=games.createGame('rune-fusion',1,42).grid;const b=games.createGame('rune-fusion',1,42).grid;assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(a.filter(Boolean).length,2);assert.ok(a.every(n=>n===0||n===2));const variants=new Set(Array.from({length:12},(_,i)=>JSON.stringify(games.createGame('rune-fusion',1,i).grid)));assert.ok(variants.size>1);});

test('crossing up and down visibly move player with progress',()=>{const s=games.createGame('frog-kings-crossing',1,9);const up=games.step(s,'up');assert.ok(up.player.y<s.player.y);assert.equal(up.progress,1);const down=games.step(up,'down');assert.ok(down.player.y>up.player.y);assert.equal(down.progress,0);});
