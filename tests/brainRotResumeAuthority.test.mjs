import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const values = new Map();
const storage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
const compile = p => ts.transpileModule(fs.readFileSync(p,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const core = {}, games = {};
vm.runInNewContext(compile('lib/brainRot/core.ts'), { exports: core, localStorage: storage, structuredClone });
vm.runInNewContext(compile('lib/brainRot/games.ts'), { exports: games, require: () => core, structuredClone });
const plain = value => JSON.parse(JSON.stringify(value));

test('every game resumes a serialized in-progress snapshot and deterministic next input', () => {
  for (const game of core.GAMES) {
    let seed=1;
    while(core.currentGame(core.newRun(seed))!==game.id) seed++;
    const run=core.newRun(seed), state=games.createGame(game.id,1,seed+17);
    const resumed=core.resumeGameState(run,{level:1,state:plain(state)});
    assert.deepEqual(plain(resumed),plain(state),game.id);
    assert.equal(games.serialize(games.step(resumed,'up')),games.serialize(games.step(state,'up')),game.id);
  }
});

test('required render and stepper fields reject malformed/nonfinite payloads', () => {
  const original=games.createGame('rune-fusion',1,7);
  const corruptions=[s=>delete s.player,s=>s.player.y=Infinity,s=>s.player.vx=NaN,s=>delete s.entities,
    s=>s.entities=[{x:0,y:0,vx:NaN,vy:0,type:0}],s=>s.grid=[2,2],s=>s.grid[0]=3,
    s=>s.tick=-1,s=>s.tick=1.5,s=>s.goal=0,s=>s.score=NaN,s=>s.won='false',
    s=>s.pressed=null,s=>s.lastInput='teleport',s=>s.lastMeaningfulTick=2];
  for(const corrupt of corruptions){const s=plain(original);corrupt(s);assert.equal(core.validGameState(s),false);}
});

test('invalid active payload preserves the valid run, level and hearts', () => {
  values.clear(); const run={...core.newRun(17),hearts:2};
  storage.setItem(core.CHECKPOINT_KEY,JSON.stringify({version:1,revision:9,run,active:{level:1,state:{id:core.currentGame(run)}}}));
  const loaded=core.readCheckpoint();
  assert.deepEqual(plain(loaded.run),plain(run));
  assert.equal(loaded.revision,9);assert.equal(loaded.active,null);
});

test('legacy active rejects malformed state and legacy run rejects duplicate cycle', () => {
  values.clear();storage.setItem(core.ACTIVE_KEY,JSON.stringify({level:1,state:{id:'rune-fusion'}}));
  assert.equal(core.readActive(),null);
  const run=core.newRun(7);run.order[1]=run.order[0];storage.setItem(core.SAVE_KEY,JSON.stringify(run));
  assert.equal(core.readRun(),null);
});

test('boss fallback preserves a validated per-game snapshot and exact segment time', () => {
  const run={...core.newRun(71),level:31,best:31,boss:core.newBoss(71)};
  const id=run.boss.queue[0],state=games.createGame(id,3,19);state.goal=Number.MAX_SAFE_INTEGER;
  run.boss.states[id]=state;run.boss.segmentMs=8123;run.boss.hearts=2;
  assert.deepEqual(plain(core.resumeGameState(run,null)),plain(state));
  assert.equal(run.boss.segmentMs,8123);assert.equal(run.boss.hearts,2);
  run.boss.states[id]={id};assert.equal(core.validRun(run),false);
});

test('boss entry snapshots validate identity before a later retry can consume them', () => {
  const run={...core.newRun(71),level:31,boss:core.newBoss(71)};
  const id=run.boss.queue[0];
  const other=core.GAMES.find(g=>g.id!==id).id;
  run.boss.snapshots[id]=games.createGame(other,3,19);
  assert.equal(core.validRun(run),false);
});

test('terminal snapshots cannot replay a win or lost frame on Resume', () => {
  const run=core.newRun(17), state=games.createGame(core.currentGame(run),1,7);
  for(const flag of ['won','lost']) {
    const terminal={...state,[flag]:true};
    assert.equal(core.resumeGameState(run,{level:1,state:terminal}),null);
  }
  assert.equal(run.level,1);assert.equal(run.hearts,3);
});
