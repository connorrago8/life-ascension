import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const cache=new Map();
function load(path){if(cache.has(path))return cache.get(path);const source=fs.readFileSync(path,'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};vm.runInNewContext(js,{exports,require:(name)=>{if(name==='./core')return load('lib/brainRot/core.ts');throw Error(name);},localStorage:undefined});cache.set(path,exports);return exports;}
const core=load('lib/brainRot/core.ts'),games=load('lib/brainRot/games.ts');
test('all thirty levels contain each of ten games exactly once per cycle',()=>{for(let seed=1;seed<101;seed++){const list=core.order(seed);assert.equal(list.length,30);for(let cycle=0;cycle<3;cycle++)assert.equal(new Set(list.slice(cycle*10,cycle*10+10)).size,10);assert.notEqual(list[9],list[10]);assert.notEqual(list[19],list[20]);}});
test('level thirty unlocks boss and does not exceed 31',()=>{let run=core.newRun(42);for(let i=0;i<31;i++)run=core.completeLevel(run);assert.equal(run.level,31);assert.equal(run.best,31);});
test('all ten games create deterministic states and restore exactly',()=>{for(const game of core.GAMES){let a=games.createGame(game.id,1,123);let b=games.createGame(game.id,1,123);for(let i=0;i<25;i++){a=games.step(a,i%3===0?'up':null);b=games.step(b,i%3===0?'up':null);}assert.equal(JSON.stringify(a),JSON.stringify(b),game.id);assert.equal(JSON.stringify(games.restore(games.serialize(a))),JSON.stringify(a));}});
test('paused simulation does not advance',()=>{const state=games.createGame('flappy-wyvern',1,9);assert.equal(games.step(state,null,0),state);});
test('boss rotates every 15 seconds and credits only completed intervals',()=>{let b=core.newBoss(9);const first=b.queue[0];b=core.advanceBoss(b,14999,9);assert.equal(b.seconds[first],0);b=core.advanceBoss(b,1,9);assert.equal(b.seconds[first],15);assert.equal(b.segmentMs,0);});
test('boss clears after four visits to every game',()=>{let b=core.newBoss(13);for(let i=0;i<40;i++)b=core.advanceBoss(b,15000,13);assert.equal(b.won,true);assert.ok(Object.values(b.seconds).every(n=>n===60));});
test('rune fusion combines equal tiles without duplicate merges',()=>{const before=[2,2,2,2,...Array(12).fill(0)];const after=games.moveTiles(before,'left',11);assert.equal(after[0],4);assert.equal(after[1],4);});
