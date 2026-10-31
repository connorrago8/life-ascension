/**
 * Connor's 8:26–8:29 PM batch: an unfinished run survives the Play tab, a reload or a
 * remount; the bottom nav hides inside a run; double-tapping a map circle enters the room.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canPlay } from '../lib/crypt/delve/battle.ts';
import { canWearDrop, createDelve, reduceDelve } from '../lib/crypt/delve/run.ts';
import {
  ACTIVE_RUN_KEY, ACTIVE_RUN_MAX_AGE_MS, clearActiveRun, isLiveRun, loadActiveRun, runOwner, saveActiveRun,
} from '../lib/cryptActiveRun.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ZERO = { strength: 0, agility: 0, intelligence: 0, endurance: 0, luck: 0 };
const runId = '00000000-0000-4000-a000-0000000000a7';
const NOW = 1_800_000_000_000;

function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

/** One deterministic step of play (same policy as the other run tests). */
function step(state) {
  let command;
  if (state.phase === 'deck-select') command = { type: 'pick-deck', deckId: 'guardian' };
  else if (state.phase === 'start-pick') command = { type: 'pick-start', cardId: state.startPick[0] };
  else if (state.phase === 'map') command = { type: 'choose-room', row: state.row, index: 0 };
  else if (state.phase === 'combat') {
    const playable = state.battle.hand.find((c) => canPlay(state.battle, c.uid));
    command = playable ? { type: 'play', uid: playable.uid } : { type: 'end-turn' };
  } else if ((state.phase === 'reward' || state.phase === 'treasure' || (state.phase === 'event' && state.event.outcome))
    && state.reward?.loot && canWearDrop(state, state.reward.loot)) command = { type: 'wear', itemId: state.reward.loot };
  else if (state.phase === 'reward') command = { type: 'pick-card', cardId: state.reward.cards[0] ?? null };
  else if (state.phase === 'event') command = state.event.outcome ? { type: 'continue' } : { type: 'event-option', optionId: 'leave' };
  else if (state.phase === 'rest') command = { type: 'rest', choice: 'heal' };
  else command = { type: 'continue' };
  let next = reduceDelve(state, command);
  for (const optionId of ['pray', 'answer', 'run']) if (next === state && state.phase === 'event') next = reduceDelve(state, { type: 'event-option', optionId });
  assert.notEqual(next, state, `stuck in ${state.phase}`);
  return next;
}

function playOut(state) {
  for (let guard = 0; guard < 4000; guard += 1) {
    if (!isLiveRun(state)) return state;
    state = step(state);
  }
  throw new Error('run did not finish');
}

function midCombat(seed) {
  let state = createDelve({ runId, seed, level: 6, allocated: { ...ZERO, strength: 6 }, deckSelect: true });
  for (let i = 0; i < 400 && !(state.phase === 'combat' && state.battle.turn >= 2); i += 1) state = step(state);
  assert.equal(state.phase, 'combat');
  return state;
}

test('resume: a saved mid-combat run reloads (JSON round trip) and plays on exactly like the original', () => {
  for (const seed of [3, 11, 42]) {
    const storage = memoryStorage();
    const live = midCombat(seed);
    saveActiveRun(storage, 'guest', live, NOW);
    const resumed = loadActiveRun(storage, 'guest', NOW + 5_000);
    assert.ok(resumed, 'the run comes back after a remount / reload / Play tab');
    assert.equal(resumed.runId, live.runId);
    assert.equal(resumed.phase, 'combat');
    assert.equal(resumed.battle.foe.hp, live.battle.foe.hp);
    assert.deepEqual(resumed.battle.hand.map((c) => c.uid), live.battle.hand.map((c) => c.uid));
    const a = playOut(live);
    const b = playOut(resumed);
    assert.equal(JSON.stringify(b), JSON.stringify(a), 'same seed state, same outcome: nothing reset or re-rolled');
  }
});

test('resume: deck select, opening pick and the map are kept too', () => {
  const storage = memoryStorage();
  let state = createDelve({ runId, seed: 9, level: 3, allocated: ZERO, deckSelect: true });
  const seen = new Set();
  for (let i = 0; i < 60 && isLiveRun(state); i += 1) {
    saveActiveRun(storage, 'preview', state, NOW);
    const back = loadActiveRun(storage, 'preview', NOW);
    assert.equal(JSON.stringify(back), JSON.stringify(state), `phase ${state.phase} round-trips`);
    seen.add(state.phase);
    state = step(state);
  }
  for (const phase of ['deck-select', 'start-pick', 'map', 'combat']) assert.ok(seen.has(phase), phase);
});

test('only End run, defeat or victory clear the stored run', () => {
  const storage = memoryStorage();
  const live = midCombat(5);
  saveActiveRun(storage, 'guest', live, NOW);
  // Over runs (defeat / floor-clear) are never stored: saving one clears the slot.
  const over = playOut(live);
  assert.ok(over.phase === 'defeat' || over.phase === 'floor-clear');
  assert.equal(isLiveRun(over), false);
  saveActiveRun(storage, 'guest', over, NOW);
  assert.equal(storage.getItem(ACTIVE_RUN_KEY), null);
  // Confirmed End run clears it.
  saveActiveRun(storage, 'guest', live, NOW);
  clearActiveRun(storage);
  assert.equal(loadActiveRun(storage, 'guest', NOW), null);
  // The camp screen (no run) never clears it from DelveScreen.
  const screen = read('components/delve/DelveScreen.tsx');
  assert.match(screen, /if \(!owner \|\| !storage \|\| !state\) return;\s*saveActiveRun\(storage, owner, state, Date\.now\(\)\);/);
  assert.match(screen, /const onEndRun = useCallback\(\(\) => \{\s*const storage = browserStorage\(\);\s*if \(storage\) clearActiveRun\(storage\);/);
});

test('stored runs are owner-scoped, expire after a day and reject junk', () => {
  const storage = memoryStorage();
  const live = midCombat(7);
  assert.equal(runOwner('online', 'abc'), 'user:abc');
  assert.equal(runOwner('guest', null), 'guest');
  assert.equal(runOwner('preview', null), 'preview');
  saveActiveRun(storage, 'user:abc', live, NOW);
  assert.equal(loadActiveRun(storage, 'user:other', NOW), null, 'another account never resumes it');
  assert.equal(loadActiveRun(storage, 'guest', NOW), null);
  assert.ok(loadActiveRun(storage, 'user:abc', NOW + ACTIVE_RUN_MAX_AGE_MS - 1));
  assert.equal(loadActiveRun(storage, 'user:abc', NOW + ACTIVE_RUN_MAX_AGE_MS + 1), null, 'stale');
  for (const raw of ['{', 'null', '{"v":2}', JSON.stringify({ v: 1, owner: 'guest', savedAt: NOW, state: { ...live, runId: '<x>' } }),
    JSON.stringify({ v: 1, owner: 'guest', savedAt: NOW, state: { ...live, phase: 'defeat' } }),
    JSON.stringify({ v: 1, owner: 'guest', savedAt: NOW, state: { ...live, battle: null } })]) {
    storage.setItem(ACTIVE_RUN_KEY, raw);
    assert.equal(loadActiveRun(storage, 'guest', NOW), null, raw.slice(0, 40));
  }
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.doesNotThrow(() => saveActiveRun(throwing, 'guest', live, NOW));
  assert.equal(loadActiveRun(throwing, 'guest', NOW), null);
});

test('remount wiring: DelveScreen hands the saved run back to DelveRun; sign-out clears it', () => {
  const screen = read('components/delve/DelveScreen.tsx');
  assert.match(screen, /loadActiveRun\(storage, owner, Date\.now\(\)\)/);
  assert.match(screen, /key=\{`\$\{session\}:\$\{owner\}`\}\s*resume=\{resume\}\s*onStateChange=\{onStateChange\}\s*onEndRun=\{onEndRun\}/);
  assert.match(screen, /event === 'SIGNED_OUT'[\s\S]{0,120}clearActiveRun\(storage\)/);
  const run = read('components/crypt/DelveRun.tsx');
  assert.match(run, /useReducer\(holderReducer, props\.resume \?\? null, \(resume\): Holder => \(\{ state: resume \}\)\)/);
  assert.match(run, /onStateChange\?\.\(state\)/);
  assert.match(run, /const endRun = \(\) => \{\s*props\.onEndRun\?\.\(\);\s*dispatch\(\{ kind: 'clear' \}\);/);
  assert.match(run, /<RunHeader state=\{state\} exitHref=\{props\.exitHref\} onCamp=\{endRun\} \/>/);
  // Engine and run UI stay storage- and timer-free; persistence lives only in the lib-root helper.
  for (const path of ['components/crypt/DelveRun.tsx', 'lib/crypt/delve/run.ts', 'lib/crypt/delve/battle.ts']) {
    assert.doesNotMatch(read(path), /localStorage|sessionStorage|setTimeout|setInterval|Date\.now/, path);
  }
});

test('Play keeps ?preview=1 and the Crypt entry resumes the same mode', () => {
  const nav = read('app/components/AppNav.tsx');
  assert.match(nav, /href=\{play \? `\$\{item\.href\}\$\{previewQuery\}` : item\.href\}/);
  assert.match(nav, /get\('preview'\) === '1'/);
  const hub = read('components/play/AdventureHub.tsx');
  assert.match(hub, /get\('preview'\) === '1' \? `\$\{CRYPT_ENTRY_HREF\}\?preview=1` : CRYPT_ENTRY_HREF/);
  assert.match(hub, /setEntryHref\(cryptEntryHref\(window\.location\.search\)\)/);
  assert.match(hub, /hasRun \? 'Continue run' : HUB\.enter/);
});

test('dungeon mode: the bottom nav hides only while a run is live, with safe-area padding', () => {
  const screen = read('components/delve/DelveScreen.tsx');
  assert.match(screen, /setInRun\(isLiveRun\(state\)\)/);
  assert.match(screen, /if \(inRun\) root\.setAttribute\('data-delve-run', 'live'\);\s*else root\.removeAttribute\('data-delve-run'\);\s*return \(\) => root\.removeAttribute\('data-delve-run'\);/);
  const css = read('app/style.css');
  assert.match(css, /html\[data-delve-run='live'\] \.app-nav,\s*html\[data-delve-run='live'\] \.more-sheet,\s*html\[data-delve-run='live'\] \.more-backdrop,\s*html\[data-delve-run='live'\] vercel-live-feedback \{ display: none !important; \}/);
  assert.match(css, /html\[data-delve-run='live'\] \.shell-main \{ padding-bottom: env\(safe-area-inset-bottom\); \}/);
  assert.match(css, /html\[data-delve-run='live'\] \.delve \{ padding-bottom: calc\(16px \+ env\(safe-area-inset-bottom\)\); \}/);
  // The exit stays in the delve header behind the abandon confirm.
  const run = read('components/crypt/DelveRun.tsx');
  assert.match(run, /End this run for good\? It can't be resumed\./);
  // Recap phases are not live, so the nav comes back there.
  assert.equal(isLiveRun({ phase: 'defeat' }), false);
  assert.equal(isLiveRun({ phase: 'floor-clear' }), false);
  assert.equal(isLiveRun({ phase: 'map' }), true);
});

test('map double tap: first tap selects, second tap on the same circle enters, once per row', () => {
  const run = read('components/crypt/DelveRun.tsx');
  assert.match(run, /const tapNode = \(index: number\) => \{\s*if \(armedIndex === index\) enter\(index\);\s*else \{\s*setArmed\(\{ row: state\.row, index \}\);\s*showOnList\(index\);/);
  // Hover/focus on a card never arms a circle; moving the highlight elsewhere disarms it.
  assert.match(run, /const armedIndex = armed && armed\.row === state\.row && activeIndex === armed\.index \? armed\.index : null;/);
  assert.match(run, /const enter = \(index: number\) => \{\s*if \(entered\.current === state\.row\) return;\s*entered\.current = state\.row;\s*onChoose\(index\);/);
  assert.match(run, /`Selected: \$\{option\.ariaLabel\}\. Tap again to enter\.`/);
  assert.match(run, /`Select on map: \$\{option\.ariaLabel\}`/);
  assert.match(run, /focus\(\{ preventScroll: true \}\)/);
  assert.match(run, /onPointerEnter=\{\(event\) => \{ if \(event\.pointerType === 'mouse'\) highlight\(option\.index\); \}\}/);
  assert.match(run, /Tap a room card to enter it, or tap a circle on the map to select it and tap it again to enter\./);
  assert.doesNotMatch(run, /Show on list/);
  // Engine backstop: a repeated or stale choose-room never enters twice or skips a row.
  let state = createDelve({ runId, seed: 21, level: 4, allocated: ZERO });
  for (let i = 0; i < 20 && state.phase !== 'map'; i += 1) state = step(state);
  assert.equal(state.phase, 'map');
  const row = state.row;
  const entered = reduceDelve(state, { type: 'choose-room', row, index: 0 });
  assert.notEqual(entered, state);
  assert.equal(reduceDelve(entered, { type: 'choose-room', row, index: 0 }), entered, 'second enter ignored');
  assert.equal(reduceDelve(entered, { type: 'choose-room', row: row + 1, index: 0 }), entered, 'cannot skip into the next row mid-room');
});
