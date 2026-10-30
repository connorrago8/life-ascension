/** Crypt camp: worn gear never carries over between runs, and Enter Floor 1 sits above the vault. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { createDelve, reduceDelve, runLoadout } from '../lib/crypt/delve/run.ts';
import { canPlay } from '../lib/crypt/delve/battle.ts';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const ZERO = { strength: 0, agility: 0, intelligence: 0, endurance: 0, luck: 0 };
const runId = '00000000-0000-4000-a000-000000000002';

// Minimal TS/TSX loader so the real camp component can be server-rendered.
const cache = new Map();
function loadModule(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, allowImportingTsExtensions: true },
  });
  const module = { exports: {} };
  cache.set(file, module);
  const localRequire = (spec) => {
    if (!spec.startsWith('.')) return require(spec);
    if (/\.css$/.test(spec)) return {};
    const base = resolve(dirname(file), spec);
    const found = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((candidate) => existsSync(candidate) && !candidate.endsWith('/'));
    assert.ok(found, `cannot resolve ${spec} from ${file}`);
    return loadModule(found);
  };
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports);
  return module.exports;
}

function renderCamp(vaultItemIds) {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { DelveRun } = loadModule(resolve(root, 'components/crypt/DelveRun.tsx'));
  return renderToStaticMarkup(React.createElement(DelveRun, {
    level: 3, savedAttributes: ZERO, vaultItemIds, keepNote: 'note', exitHref: '/play',
    onSaveAttributes: async () => true, onLoot: () => {}, onFloorCleared: async () => '',
  }));
}

test('a new run starts with nothing worn, even with gear in the vault', () => {
  const vault = ['ember-blade', 'ashen-hood', 'grave-mail'];
  const first = createDelve({ runId, seed: 5, level: 3, allocated: ZERO, vaultItemIds: vault, wear: ['ember-blade', 'ashen-hood'] });
  assert.deepEqual(first.loadout, { weapon: 'ember-blade', helm: 'ashen-hood' });
  // Next run without choosing again: nothing carries over.
  const next = createDelve({ runId, seed: 6, level: 3, allocated: ZERO, vaultItemIds: vault });
  assert.deepEqual(next.loadout, {});
});

test('runLoadout only wears owned vault items, one per slot', () => {
  assert.deepEqual(runLoadout([], []), {});
  assert.deepEqual(runLoadout(['ember-blade'], ['ember-blade', 'hollow-crown']), { weapon: 'ember-blade' });
  assert.deepEqual(runLoadout(['ember-blade', 'rusty-shortsword'], ['rusty-shortsword', 'ember-blade']), { weapon: 'rusty-shortsword' });
});

function playOut(seed) {
  let state = createDelve({ runId, seed, level: 8, allocated: { ...ZERO, strength: 8, endurance: 10, luck: 5 } });
  for (let guard = 0; guard < 4000; guard += 1) {
    if (state.phase === 'defeat' || state.phase === 'floor-clear') return state;
    let command;
    if (state.phase === 'map') command = { type: 'choose-room', row: state.row, index: 0 };
    else if (state.phase === 'combat') {
      const playable = state.battle.hand.find((c) => canPlay(state.battle, c.uid));
      command = playable ? { type: 'play', uid: playable.uid } : { type: 'end-turn' };
    } else if (state.phase === 'reward') command = { type: 'pick-card', cardId: state.reward.cards[0] ?? null };
    else if (state.phase === 'event') command = state.event.outcome ? { type: 'continue' } : { type: 'event-option', optionId: 'leave' };
    else if (state.phase === 'rest') command = { type: 'rest', choice: 'heal' };
    else command = { type: 'continue' };
    let next = reduceDelve(state, command);
    for (const optionId of ['pray', 'answer', 'run']) if (next === state && state.phase === 'event') next = reduceDelve(state, { type: 'event-option', optionId });
    assert.notEqual(next, state, `stuck in ${state.phase}`);
    state = next;
  }
  throw new Error('run did not finish');
}

test('gear auto-worn after a mid-run drop does not survive into the next run', () => {
  let checked = 0;
  for (let seed = 1; seed <= 30 && checked < 3; seed += 1) {
    const end = playOut(seed);
    if (Object.keys(end.loadout).length === 0) continue;
    checked += 1;
    const fresh = createDelve({ runId, seed: seed + 100, level: 8, allocated: ZERO, vaultItemIds: end.found });
    assert.deepEqual(fresh.loadout, {}, 'next run shows nothing worn until the player taps Wear');
  }
  assert.ok(checked > 0, 'some run wore found gear');
});

test('camp renders nothing Worn, offers Wear per item, and puts Enter Floor 1 above attributes and vault', () => {
  const html = renderCamp(['ember-blade', 'ashen-hood']);
  assert.doesNotMatch(html, />Worn</, 'nothing is worn when camp opens');
  assert.equal((html.match(/aria-pressed="false"[^>]*>Wear</g) ?? []).length, 2);
  const enter = html.indexOf('>Enter Floor 1<');
  assert.ok(enter > 0);
  assert.ok(enter < html.indexOf('id="delve-attr-title"'), 'Enter before attributes');
  assert.ok(enter < html.indexOf('id="delve-vault-title"'), 'Enter before the gear vault');
});

test('Crypt worn state is run-local: not persisted, and separate from /character equipment', () => {
  const run = read('components/crypt/DelveRun.tsx');
  const screen = read('components/delve/DelveScreen.tsx');
  const vault = read('lib/cryptVault.ts');
  const sql = read('supabase/migrations/202610300001_crypt_delve.sql');
  assert.match(run, /const \[wear, setWear\] = useState<string\[\]>\(\[\]\)/);
  for (const source of [run, screen, vault]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage/);
    // The Crypt may read owned earned gear, but never writes /character equipment.
    assert.doesNotMatch(source, /equip_earned_armor|set_equipped|equipped_item/);
  }
  assert.doesNotMatch(sql, /\b(worn|equipped)\b/i, 'the Crypt tables store owned loot only');
});
