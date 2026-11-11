import assert from 'node:assert/strict';
import test from 'node:test';
import { canPlay } from '../lib/crypt/delve/battle.ts';
import { BOSS, FLOOR_ROWS } from '../lib/crypt/delve/floor.ts';
import { FLOOR_DEFINITIONS, JOURNEY, floorCheckpointKey, journeyAfterClear, layoutForFloor } from '../lib/crypt/delve/journey.ts';
import { canWearDrop, createDelve, reduceDelve } from '../lib/crypt/delve/run.ts';
import { seedRng } from '../lib/crypt/delve/rng.ts';
import {
  ACTIVE_RUN_KEY, ACTIVE_RUN_VERSION, clearActiveRun, isLiveRun, loadActiveRun, migrateRunState, runShouldStaySaved, saveActiveRun,
} from '../lib/cryptActiveRun.ts';

const ZERO = { strength: 0, agility: 0, intelligence: 0, endurance: 0, luck: 0 };
const runId = '00000000-0000-4000-a000-0000000000b1';
const NOW = 1_800_000_000_000;

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

function step(state) {
  let command;
  if (state.phase === 'deck-select') command = { type: 'pick-deck', deckId: 'guardian' };
  else if (state.phase === 'start-pick') command = { type: 'pick-start', cardId: state.startPick[0] };
  else if (state.phase === 'map') command = { type: 'choose-room', row: state.row, index: 0 };
  else if (state.phase === 'combat') {
    const playable = state.battle.hand.find((card) => canPlay(state.battle, card.uid));
    command = playable ? { type: 'play', uid: playable.uid } : { type: 'end-turn' };
  } else if ((state.phase === 'reward' || state.phase === 'treasure' || (state.phase === 'event' && state.event.outcome))
    && state.reward?.loot && canWearDrop(state, state.reward.loot)) command = { type: 'wear', itemId: state.reward.loot };
  else if (state.phase === 'reward') command = { type: 'pick-card', cardId: state.reward.cards[0] ?? null };
  else if (state.phase === 'event') command = state.event.outcome ? { type: 'continue' } : { type: 'event-option', optionId: 'leave' };
  else if (state.phase === 'rest') command = { type: 'rest', choice: 'heal' };
  else command = { type: 'continue' };
  let next = reduceDelve(state, command);
  for (const optionId of ['pray', 'answer', 'run']) {
    if (next === state && state.phase === 'event') next = reduceDelve(state, { type: 'event-option', optionId });
  }
  assert.notEqual(next, state, `stuck in ${state.phase}`);
  return next;
}

test('a one-floor journey still ends the run when Floor 1 is cleared', () => {
  assert.deepEqual(JOURNEY, [1]);
  assert.equal(FLOOR_DEFINITIONS[0].rows, FLOOR_ROWS);
  assert.equal(FLOOR_DEFINITIONS[0].bossId, BOSS.id);
  assert.deepEqual(journeyAfterClear(1), { kind: 'run-complete' });
  assert.equal(journeyAfterClear(1, [1, 2]).kind, 'run-complete');
  const strong = { ...ZERO, strength: 12, endurance: 12, luck: 8 };
  let ended = null;
  for (let seed = 1; seed <= 40 && !ended; seed += 1) {
    let state = createDelve({ runId, seed, level: 12, allocated: strong });
    for (let guard = 0; guard < 5000 && isLiveRun(state); guard += 1) state = step(state);
    if (state.phase === 'floor-clear') ended = state;
  }
  assert.equal(ended?.phase, 'floor-clear');
  assert.equal(ended.floor, 1);
  assert.deepEqual(ended.boons, []);
});

test('the journey can name a next floor only when that floor is defined', () => {
  assert.equal(journeyAfterClear(1, [1, 1]).kind, 'next-floor');
  assert.equal(layoutForFloor({ number: 2, id: 'missing', name: 'Missing', rows: 4, bossId: 'nope' }, seedRng(1)), null);
  const layout = layoutForFloor(FLOOR_DEFINITIONS[0], seedRng(4));
  assert.equal(layout.rows.length, FLOOR_ROWS);
});

test('floor checkpoints are one per floor, not one per run', () => {
  assert.equal(floorCheckpointKey(runId, 1), `${runId}:1`);
  assert.notEqual(floorCheckpointKey(runId, 1), floorCheckpointKey(runId, 2));
  assert.equal(floorCheckpointKey(runId, 1), floorCheckpointKey(runId, 1));
});

test('a version 1 browser save migrates and a finished or ended run is dropped', () => {
  const storage = memoryStorage();
  const live = createDelve({ runId, seed: 3, level: 4, allocated: { ...ZERO, strength: 4 }, deckSelect: true });
  const legacy = { ...live };
  delete legacy.boons;
  storage.setItem(ACTIVE_RUN_KEY, JSON.stringify({ v: 1, owner: 'guest', savedAt: NOW, state: legacy }));
  const loaded = loadActiveRun(storage, 'guest', NOW);
  assert.ok(loaded);
  assert.deepEqual(loaded.boons, []);
  assert.equal(loaded.phase, 'deck-select');
  assert.deepEqual(migrateRunState(legacy).boons, []);

  saveActiveRun(storage, 'guest', loaded, NOW);
  const saved = JSON.parse(storage.getItem(ACTIVE_RUN_KEY));
  assert.equal(saved.v, ACTIVE_RUN_VERSION);
  assert.deepEqual(loadActiveRun(storage, 'guest', NOW).boons, []);

  const defeated = { ...loaded, phase: 'defeat', hp: 0 };
  assert.equal(runShouldStaySaved(defeated), false);
  saveActiveRun(storage, 'guest', defeated, NOW);
  assert.equal(storage.getItem(ACTIVE_RUN_KEY), null);

  saveActiveRun(storage, 'guest', loaded, NOW);
  const cleared = { ...loaded, phase: 'floor-clear' };
  assert.equal(runShouldStaySaved(cleared), false);
  saveActiveRun(storage, 'guest', cleared, NOW);
  assert.equal(storage.getItem(ACTIVE_RUN_KEY), null);

  saveActiveRun(storage, 'guest', loaded, NOW);
  clearActiveRun(storage);
  assert.equal(loadActiveRun(storage, 'guest', NOW), null);
});
