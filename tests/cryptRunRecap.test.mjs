/** Victory & Return: recap uses tracked fields only, defeat keeps loot, Home banner shows once, nothing auto-equips. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { createDelve as openDelve, reduceDelve } from '../lib/crypt/delve/run.ts';
import { canPlay } from '../lib/crypt/delve/battle.ts';
import { ENCOUNTERS_PER_RUN, FLOOR_ROWS } from '../lib/crypt/delve/floor.ts';
import { RECAP_FIELDS, lootRetainedLine, runRecap } from '../lib/crypt/delve/recap.ts';
import { RETURN_KEY, RETURN_MAX_AGE_MS, parseReturn, returnDetail, returnHeadline, saveReturn, takeReturnBanner } from '../lib/cryptReturn.ts';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const ZERO = { strength: 0, agility: 0, intelligence: 0, endurance: 0, luck: 0 };
const runId = '00000000-0000-4000-a000-00000000000c';

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

function renderRecap(props) {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { RunRecapView } = loadModule(resolve(root, 'components/crypt/RunRecap.tsx'));
  return renderToStaticMarkup(React.createElement(RunRecapView, { checkpoint: null, onContinue: () => {}, exitHref: '/play', ...props }));
}

function playOut(seed, level, allocated) {
  let state = openDelve({ runId, seed, level, allocated });
  state = reduceDelve(state, { type: 'pick-start', cardId: state.startPick[0] });
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

function findEnd(phase) {
  for (let seed = 1; seed <= 60; seed += 1) {
    const end = phase === 'defeat' ? playOut(seed, 1, ZERO) : playOut(seed, 10, { ...ZERO, strength: 10, endurance: 12, luck: 8 });
    if (end.phase === phase) return end;
  }
  throw new Error(`no ${phase} found`);
}

test('the recap is built only from tracked run fields', () => {
  const source = read('lib/crypt/delve/recap.ts');
  const used = new Set([...source.matchAll(/state\.([a-zA-Z]+)/g)].map((m) => m[1]));
  assert.deepEqual([...used].sort(), ['battle', 'floor', 'found', 'path', 'phase', 'reward', 'runId']);
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /damage|dealt|\bturns?\b|seconds|duration|\bxp\b/i);

  const won = findEnd('floor-clear');
  const wonRecap = runRecap(won);
  assert.deepEqual(Object.keys(wonRecap).sort(), [...RECAP_FIELDS].sort());
  assert.equal(wonRecap.result, 'conquered');
  assert.equal(wonRecap.roomsCleared, FLOOR_ROWS + 1);
  assert.equal(wonRecap.roomsTotal, ENCOUNTERS_PER_RUN);
  assert.equal(wonRecap.bossReward, won.reward.loot);
  assert.deepEqual(wonRecap.found, won.found);

  const lost = findEnd('defeat');
  const lostRecap = runRecap(lost);
  assert.equal(lostRecap.result, 'fallen');
  assert.equal(lostRecap.roomsVisited, lost.path.length);
  assert.equal(lostRecap.roomsCleared, lost.path.length - 1);
  assert.equal(lostRecap.fellTo, lost.battle.foe.name);
  assert.equal(lostRecap.bossReward, null);

  assert.equal(runRecap({ ...lost, phase: 'map' }), null);
});

const VICTORY = { runId, result: 'conquered', floor: 1, roomsCleared: 13, roomsVisited: 13, roomsTotal: 13, fellTo: null, bossReward: 'warden-glaive', found: ['rusty-shortsword', 'warden-glaive'] };
const DEFEAT = { runId, result: 'fallen', floor: 1, roomsCleared: 6, roomsVisited: 7, roomsTotal: 13, fellTo: 'Restless Skeleton', bossReward: null, found: ['rusty-shortsword'] };

test('victory: Floor 1 Conquered, the boss reward up front, compact summary', () => {
  const html = renderRecap({ recap: VICTORY, mode: 'vault', confirmed: 2 });
  assert.match(html, /Floor 1 Conquered/);
  assert.match(html, /Boss reward<\/p><p class="recap-reward-name">Warden&#x27;s Glaive/);
  assert.match(html, /Saved to your vault/);
  assert.match(html, /<dt>Result<\/dt><dd>Conquered<\/dd>/);
  assert.match(html, /<dt>Rooms<\/dt><dd>13 of 13 cleared<\/dd>/);
  assert.match(html, /<dt>Gear<\/dt><dd>2 items saved<\/dd>/);
  assert.match(html, />Continue to camp</);
  const pending = renderRecap({ recap: VICTORY, mode: 'vault', confirmed: 1 });
  assert.match(pending, /1 of 2 saved so far/);
  assert.match(pending, /Saving to your vault…/);
});

test('defeat: The Road Continues and loot retained, in every save mode', () => {
  for (const mode of ['vault', 'visit', 'preview']) {
    const html = renderRecap({ recap: DEFEAT, mode, confirmed: 1 });
    assert.match(html, /The Road Continues/);
    assert.match(html, /Your loot is retained/);
    assert.ok(html.includes(lootRetainedLine(mode, false).replace(/\u2019/g, '’').split(':')[0]));
    assert.match(html, /<dt>Rooms<\/dt><dd>6 of 13 cleared<\/dd>/);
    assert.match(html, /Restless Skeleton/);
    if (mode === 'vault') assert.match(html, /saved to your vault/);
    else assert.match(html, /isn(’|&rsquo;|&#x27;|')t saved to your account/);
  }
});

test('preview and unsaved runs say plainly they are not saved; signed-in runs say vault', () => {
  assert.match(renderRecap({ recap: VICTORY, mode: 'preview', confirmed: 0 }), /Preview: this run isn’t saved to your account\./);
  assert.match(renderRecap({ recap: VICTORY, mode: 'visit', confirmed: 0 }), /Not signed in: this run isn’t saved to your account\./);
  assert.doesNotMatch(renderRecap({ recap: VICTORY, mode: 'vault', confirmed: 2 }), /recap-mode/);
  const screen = read('components/delve/DelveScreen.tsx');
  assert.match(screen, /const saveMode: SaveMode = mode === 'online' \? 'vault' : mode === 'preview' \? 'preview' : 'visit';/);
});

test('nothing in the recap or banner equips gear; no invented stats', () => {
  for (const html of [renderRecap({ recap: VICTORY, mode: 'vault', confirmed: 2 }), renderRecap({ recap: DEFEAT, mode: 'visit', confirmed: 0 })]) {
    assert.doesNotMatch(html, /Equipped|look at your adventurer/i);
    const summary = html.slice(html.indexOf('<dl'), html.indexOf('</dl>'));
    assert.doesNotMatch(summary, /damage|dealt|\bturns?\b|XP|HP/i);
    assert.equal((summary.match(/<dt>/g) ?? []).length, 3, 'Result, Rooms, Gear only');
    assert.match(html, /Nothing is worn automatically/);
  }
  for (const path of ['components/crypt/RunRecap.tsx', 'components/home/ReturnBanner.tsx', 'lib/cryptReturn.ts', 'lib/crypt/delve/recap.ts']) {
    const source = read(path);
    assert.doesNotMatch(source, /setWear|loadout|\.rpc\(|equip_|set_equipped|onStart/, path);
  }
  const run = read('components/crypt/DelveRun.tsx');
  const effect = run.slice(run.indexOf('const onRunEnd = props.onRunEnd;'), run.indexOf('}, [recap, keptCount, onRunEnd]);'));
  assert.doesNotMatch(effect, /setWear|dispatch|loadout/);
  // Continue only clears the finished run (back to camp, where Wear starts empty).
  assert.match(run, /onContinue=\{\(\) => dispatch\(\{ kind: 'clear' \}\)\}/);
});

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
}

test('the Home banner shows once per run and can be dismissed', () => {
  const storage = memoryStorage();
  const now = 1_800_000_000_000;
  saveReturn(storage, { runId, result: 'conquered', floor: 1, kept: 2, mode: 'vault', endedAt: now });
  const first = takeReturnBanner(storage, now + 1000);
  assert.equal(returnHeadline(first), 'Back from the Crypt: Floor 1 conquered · 2 items kept');
  assert.match(returnDetail(first), /Saved to your vault\. Nothing is worn automatically/);
  assert.equal(takeReturnBanner(storage, now + 2000), null, 'shown once');
  // The same run re-saving (e.g. a late vault confirmation) stays seen.
  saveReturn(storage, { runId, result: 'conquered', floor: 1, kept: 2, mode: 'vault', endedAt: now + 3000 });
  assert.equal(takeReturnBanner(storage, now + 4000), null);
  // A new run shows again.
  saveReturn(storage, { runId: '00000000-0000-4000-a000-00000000000d', result: 'fallen', floor: 1, kept: 1, mode: 'preview', endedAt: now + 5000 });
  const next = takeReturnBanner(storage, now + 6000);
  assert.equal(returnHeadline(next), 'Back from the Crypt: The road continues · 1 item found');
  assert.equal(returnDetail(next), 'Preview run: not saved to your account.');
  // Stale or malformed records never show.
  saveReturn(storage, { runId: '00000000-0000-4000-a000-00000000000e', result: 'fallen', floor: 1, kept: 0, mode: 'visit', endedAt: now });
  assert.equal(takeReturnBanner(storage, now + RETURN_MAX_AGE_MS + 1), null);
  assert.equal(parseReturn('{"runId":"x"}'), null);
  assert.equal(takeReturnBanner(memoryStorage({ [RETURN_KEY]: 'not json' }), now), null);
  // The stored record carries no gear ids or worn state.
  assert.deepEqual(Object.keys(JSON.parse(storage.data.get(RETURN_KEY))).sort(), ['endedAt', 'floor', 'kept', 'mode', 'result', 'runId', 'seen']);

  const banner = read('components/home/ReturnBanner.tsx');
  assert.match(banner, /const shown = takeReturnBanner\(window\.localStorage, Date\.now\(\)\);\n\s*if \(shown\) setRecord\(shown\);/, 'a repeat effect pass never hides a shown banner');
  assert.match(banner, /aria-label="Dismiss" onClick=\{\(\) => setRecord\(null\)\}/);
  const home = read('app/(app)/page.tsx');
  assert.equal((home.match(/<ReturnBanner \/>/g) ?? []).length, 2, 'signed-in and signed-out Home');
  const css = read('app/style.css');
  assert.match(css, /\.return-dismiss \{[^}]*width: 44px; height: 44px;/);
  assert.match(css, /\.recap \{[^}]*env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\n  \.recap-title, \.recap-reward \{ animation/);
});

test('the recap fixture is local-only', () => {
  const page = read('app/qa/crypt-recap/page.tsx');
  assert.match(page, /if \(process\.env\.NODE_ENV !== 'development'\) notFound\(\);/);
});

test('a run with no gear reads naturally on the banner', () => {
  assert.equal(returnHeadline({ runId, result: 'fallen', floor: 1, kept: 0, mode: 'visit', endedAt: 0, seen: false }), 'Back from the Crypt: The road continues · no items found');
});
