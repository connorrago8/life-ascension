/** Independent acceptance contracts. Failures are intentionally left visible. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

function fixture() {
  const values = new Map();
  const storage = {getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)};
  const core = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('lib/brainRot/core.ts', 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS},
  }).outputText, {exports: core, localStorage: storage, structuredClone});
  const games = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('lib/brainRot/games.ts', 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS},
  }).outputText, {exports: games, require: () => core, structuredClone});
  return {core, games, storage};
}

test('atomic boss checkpoint preserves segment time, hearts and state without legacy keys', () => {
  const {core, games} = fixture();
  const run = {...core.newRun(71), level: 31, best: 31, boss: core.newBoss(71)};
  const id = run.boss.queue[run.boss.index];
  const state = games.createGame(id, 3, 71);
  state.goal = Number.MAX_SAFE_INTEGER;
  run.boss = core.advanceBoss(core.beginBossSegment(run.boss, id, state), 8000, run.seed);
  core.saveCheckpoint(run, {level: 31, state});
  const loaded = core.readCheckpoint();
  assert.ok(loaded);
  assert.equal(loaded.run.boss.segmentMs, 8000);
  assert.equal(loaded.run.boss.hearts, 3);
  assert.equal(JSON.stringify(loaded.active.state), JSON.stringify(state));
  assert.equal(core.readActive(), null);
  assert.equal(core.readRun(), null);
});

test('checkpoint loader rejects a state missing the structures consumed by the renderer', () => {
  const {core, storage} = fixture();
  const run = core.newRun(71);
  storage.setItem(core.CHECKPOINT_KEY, JSON.stringify({version: 1, revision: 1, run,
    active: {level: run.level, state: {id: core.currentGame(run)}}}));
  assert.equal(core.readCheckpoint()?.active ?? null, null,
    'an object without player/entities/grid must not become authoritative active state');
});

test('checkpoint loader rejects a valid game state belonging to a different active game', () => {
  const {core, games, storage} = fixture();
  const run = core.newRun(71);
  const other = core.GAMES.find(g => g.id !== core.currentGame(run)).id;
  storage.setItem(core.CHECKPOINT_KEY, JSON.stringify({version: 1, revision: 1, run,
    active: {level: run.level, state: games.createGame(other, 1, 71)}}));
  assert.equal(core.readCheckpoint()?.active ?? null, null, 'run and active game must agree');
});

test('legacy run loader rejects level 31 without a boss just like the atomic loader', () => {
  const {core, storage} = fixture();
  const malformed = {...core.newRun(71), level: 31, best: 31};
  assert.equal(core.validRun(malformed), false);
  storage.setItem(core.SAVE_KEY, JSON.stringify(malformed));
  const loaded = core.readRun();
  assert.ok(loaded === null || core.validRun(loaded), 'legacy fallback must not bypass boss validation');
});
