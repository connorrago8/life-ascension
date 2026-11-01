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
test('repeated crossing swipes move the character rather than granting unearned progress',()=>{let s=games.createGame('frog-kings-crossing',1,12);s.lastInput='up';const n=games.step(s,'up');assert.ok(n.player.y<s.player.y);assert.equal(n.progress,0);});

test('jetpack hazard collision cannot be bypassed by passive goal progress',()=>{let s=games.createGame('goblin-jetpack',1,42);s.progress=s.goal-1;s.tick=59;s.entities=[{x:.5,y:.5,vx:0,vy:0,type:0}];const n=games.step(s,null);assert.equal(n.won,false);assert.equal(n.lost,true);});

test('wyvern spawns paired upper and lower gates',()=>{let s=games.createGame('flappy-wyvern',1,42);s.tick=99;s.player.y=.5;s.player.vy=0;s=games.step(s,'tap');assert.ok(s.entities.some(e=>e.type===2),'upper gate should spawn');assert.ok(s.entities.some(e=>e.type===3),'lower gate should spawn');});
test('wyvern scores on gate passage rather than elapsed seconds',()=>{let s=games.createGame('flappy-wyvern',1,42);s.tick=150;s.player.y=.5;s.player.vy=0;s.entities=[{x:.502,y:.2,vx:-.0045,vy:0,type:2},{x:.502,y:.8,vx:-.0045,vy:0,type:3}];const n=games.step(s,null);assert.equal(n.progress,1);assert.equal(n.score,10);assert.equal(n.lost,false);});
test('wyvern collides with upper gate outside gap',()=>{let s=games.createGame('flappy-wyvern',1,42);s.player.y=.25;s.entities=[{x:.5,y:.2,vx:0,vy:0,type:2}];assert.equal(games.step(s,null).lost,true);});

test('rune opening tiles are deterministic, distinct and seed dependent',()=>{const a=games.createGame('rune-fusion',1,42).grid;const b=games.createGame('rune-fusion',1,42).grid;assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(a.filter(Boolean).length,2);assert.ok(a.every(n=>n===0||n===2));const variants=new Set(Array.from({length:12},(_,i)=>JSON.stringify(games.createGame('rune-fusion',1,i).grid)));assert.ok(variants.size>1);});

test('crossing up and down visibly move player with progress',()=>{const s=games.createGame('frog-kings-crossing',1,9);const up=games.step(s,'up');assert.ok(up.player.y<s.player.y);assert.equal(up.progress,0);const down=games.step(up,'down');assert.ok(down.player.y>up.player.y);assert.equal(down.progress,0);});

test('crossing traffic uses distinct lanes',()=>{let s=games.createGame('frog-kings-crossing',1,15);for(let i=0;i<180;i++){s=games.step(s,null);if(s.lost)break;}assert.ok(new Set(s.entities.map(e=>e.y)).size>=3);});
test('crossing collision requires matching player lane',()=>{let s=games.createGame('frog-kings-crossing',1,15);s.progress=3;s.player.y=.5;s.entities=[{x:.5,y:.24,vx:0,vy:0,type:0}];assert.equal(games.step(s,null).lost,false);s.entities=[{x:.5,y:.5,vx:0,vy:0,type:0}];assert.equal(games.step(s,null).lost,true);});

test('crossing collision is active even before three hops',()=>{let s=games.createGame('frog-kings-crossing',1,15);s.progress=0;s.entities=[{x:s.player.x,y:s.player.y,vx:0,vy:0,type:0}];assert.equal(games.step(s,null).lost,true);});

test('run validation rejects duplicate games and malformed boss',()=>{const r=core.newRun(12);assert.equal(core.validRun(r),true);r.order[1]=r.order[0];assert.equal(core.validRun(r),false);const b=core.newRun(12);b.level=31;b.boss=core.newBoss(12);assert.equal(core.validRun(b),true);b.boss.segmentMs=17000;assert.equal(core.validRun(b),false);});

test('jetpack collectible grants progress and score without causing damage',()=>{let s=games.createGame('goblin-jetpack',1,7);s.entities=[{x:s.player.x,y:s.player.y,vx:0,vy:0,type:1}];const n=games.step(s,null);assert.equal(n.progress,1);assert.equal(n.score,10);assert.equal(n.lost,false);assert.equal(n.entities.length,0);});
test('jetpack does not grant progress from idle time',()=>{let s=games.createGame('goblin-jetpack',1,7);for(let i=0;i<120;i++){s=games.step(s,null);if(s.lost)break;}assert.equal(s.progress,0);});
test('jetpack hazards still damage player',()=>{let s=games.createGame('goblin-jetpack',1,7);s.entities=[{x:s.player.x,y:s.player.y,vx:0,vy:0,type:0}];assert.equal(games.step(s,null).lost,true);});

test('collision defeats simultaneous collectible goal completion',()=>{let s=games.createGame('goblin-jetpack',1,22);s.progress=s.goal-1;s.entities=[{x:.5,y:.5,vx:0,vy:0,type:1},{x:.5,y:.5,vx:0,vy:0,type:0}];const n=games.step(s,null);assert.equal(n.progress,s.goal);assert.equal(n.lost,true);assert.equal(n.won,false);});
test('jetpack spawned pickups follow current altitude',()=>{let s=games.createGame('goblin-jetpack',1,22);s.player.y=.7;const interval=Math.max(35,90-Math.floor(s.goal/2));s.tick=interval*2-1;const n=games.step(s,null);const pickup=n.entities.find(e=>e.type===1);assert.ok(pickup);assert.equal(pickup.y,n.player.y);});

test('Frog King scores only after reaching far bank and resets to starting bank',()=>{let s=games.createGame('frog-kings-crossing',1,3);s.player.y=.2;const before=games.step(s,'up');assert.equal(before.progress,0);const reached=games.step(before,'up');assert.equal(reached.progress,1);assert.equal(reached.score,10);assert.equal(reached.player.y,.92);});

test('Endless Crossing scores forward hops while Frog King requires reaching bank',()=>{let endless=games.createGame('endless-crossing',1,19);let frog=games.createGame('frog-kings-crossing',1,19);endless=games.step(endless,'up');frog=games.step(frog,'up');assert.equal(endless.progress,1);assert.equal(endless.score,2);assert.equal(frog.progress,0);assert.ok(frog.player.y<.5);});

test('Endless Crossing forward hop scrolls traffic downward',()=>{let s=games.createGame('endless-crossing',1,8);s.entities=[{x:.2,y:.24,vx:0,vy:0,type:0}];const n=games.step(s,'up');assert.equal(n.progress,1);assert.equal(n.entities[0].y,.36);assert.equal(n.player.y,.5);});
test('Frog King forward hop does not scroll traffic',()=>{let s=games.createGame('frog-kings-crossing',1,8);s.entities=[{x:.2,y:.24,vx:0,vy:0,type:0}];const n=games.step(s,'up');assert.equal(n.entities[0].y,.24);assert.equal(n.progress,0);});

test('Endless Crossing traffic accelerates as distance increases',()=>{let low=games.createGame('endless-crossing',1,5);low.tick=44;let high=games.createGame('endless-crossing',1,5);high.tick=44;high.progress=35;const a=games.step(low,null).entities[0];const b=games.step(high,null).entities[0];assert.ok(Math.abs(b.vx)>Math.abs(a.vx));});
test('Frog King traffic velocity stays constant across crossing count',()=>{let low=games.createGame('frog-kings-crossing',1,5);low.tick=44;let high=games.createGame('frog-kings-crossing',1,5);high.tick=44;high.progress=35;assert.equal(Math.abs(games.step(low,null).entities[0].vx),Math.abs(games.step(high,null).entities[0].vx));});

test('Endless Crossing generated traffic varies in depth and stays in upcoming viewport',()=>{let s=games.createGame('endless-crossing',1,91);const depths=[];for(let i=0;i<400;i++){s=games.step(s,null);if(s.lost)break;if(s.tick%45===0){const e=s.entities[s.entities.length-1];if(e)depths.push(e.y);}}assert.ok(depths.length>=4);assert.ok(new Set(depths).size>=3);assert.ok(depths.every(y=>y>=.14&&y<.62));});

test('Endless Crossing spawn preserves clearance around player altitude',()=>{let s=games.createGame('endless-crossing',1,91);s.tick=44;s.player.y=.5;const n=games.step(s,null);assert.ok(n.entities.length>0);assert.ok(Math.abs(n.entities[0].y-n.player.y)>=.08);});

test('Endless Crossing lethal forward hop never awards distance',()=>{let s=games.createGame('endless-crossing',1,17);s.entities=[{x:s.player.x,y:s.player.y-.12,vx:0,vy:0,type:0}];const n=games.step(s,'up');assert.equal(n.lost,true);assert.equal(n.progress,0);assert.equal(n.score,0);});

test('Endless Crossing backward input does not detach player from camera',()=>{let s=games.createGame('endless-crossing',1,33);const y=s.player.y;const n=games.step(s,'down');assert.equal(n.player.y,y);assert.equal(n.progress,0);});

test('Endless Crossing suppresses same-direction traffic on an occupied nearby corridor',()=>{let s=games.createGame('endless-crossing',1,91);s.tick=44;s.entities=[{x:-.1,y:.32,vx:.006,vy:0,type:0},{x:1.1,y:.32,vx:-.006,vy:0,type:0}];const n=games.step(s,null);assert.ok(n.entities.length<=3);});

test('Crossing games keep horizontal movement within screen margins',()=>{for(const id of ['endless-crossing','frog-kings-crossing']){let s=games.createGame(id,1,17);for(let i=0;i<20;i++)s=games.step(s,'left');assert.ok(s.player.x>=.08);for(let i=0;i<40;i++)s=games.step(s,'right');assert.ok(s.player.x<=.92);}});

test('Endless Crossing track generator keeps player track clear at spawn',()=>{for(let seed=1;seed<=30;seed++){let s=games.createGame('endless-crossing',1,seed);s.tick=44;const n=games.step(s,null);assert.ok(n.entities.length>0);assert.ok(Math.abs(n.entities[0].x-n.player.x)>.1);assert.ok(Math.abs(n.entities[0].y-n.player.y)>=.08);}});
test('Endless Crossing lateral input changes which traffic track is protected',()=>{let s=games.createGame('endless-crossing',1,15);s=games.step(s,'right');s.tick=44;const n=games.step(s,null);assert.ok(n.entities.length>0);assert.ok(Math.abs(n.entities[0].x-n.player.x)>.1);});

test('Endless Crossing keeps an adjacent dodge track open for generated traffic',()=>{for(let seed=1;seed<=50;seed++){for(const x of [.08,.29,.5,.71,.92]){let s=games.createGame('endless-crossing',1,seed);s.player.x=x;s.tick=44;const n=games.step(s,null);assert.ok(n.entities.length>0);const track=Math.round((n.entities[0].x-.08)/.21);const playerTrack=Math.round((x-.08)/.21);assert.ok(Math.abs(track-playerTrack)>1);}}});

test('Endless Crossing long idle traffic generation stays bounded and leaves player clear',()=>{for(let seed=1;seed<=24;seed++){let s=games.createGame('endless-crossing',1,seed);for(let frame=0;frame<1800;frame++){s=games.step(s,null);assert.equal(s.lost,false,'seed '+seed+' frame '+frame);assert.ok(s.entities.length<=16);assert.ok(s.entities.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.vx)));}}});
test('Endless Crossing forward-hop scrolling remains bounded across long runs',()=>{for(let seed=1;seed<=12;seed++){let s=games.createGame('endless-crossing',1,seed);for(let frame=0;frame<600&&!s.lost&&!s.won;frame++){s=games.step(s,frame%12===0?'up':null);assert.ok(s.entities.length<=16);assert.ok(s.entities.every(e=>Number.isFinite(e.y)&&e.y<1.2));}assert.ok(s.progress>=0);}});
