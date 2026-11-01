import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { cachedQuestStreakCount, countQuestsOnStreak, homeStreakLabel } from '../lib/homeStreak.ts';
import { lockedAttributeEntries, playerStatRow } from '../lib/attributes.ts';
import { backDecision, notePop, noteVisit, pathKey } from '../lib/inAppBack.ts';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const today = '2026-11-01';
const row = (questId, fire) => ({ quest_id: questId, fire, done_today: fire > 0, today, time_zone: 'America/Chicago' });

test('Home counts quests on a streak from get_quest_streaks and hides zero', () => {
  const quests = [
    { id: 'a', cadence: 'daily' },
    { id: 'b', cadence: 'daily' },
    { id: 'c', cadence: 'daily' },
    { id: 'w', cadence: 'weekly' },
  ];
  // Account-wide fire can be 0 on a day that was just completed. Per-quest fire is 1.
  assert.equal(countQuestsOnStreak([row('a', 1), row('b', 0), row('c', 4), row('w', 9), row('missing', 3)], quests), 2);
  assert.equal(countQuestsOnStreak([row('a', 1), row('a', 1)], quests), 1, 'one quest counts once');
  assert.equal(countQuestsOnStreak([row('a', 0), row('b', 0)], quests), 0);
  assert.equal(countQuestsOnStreak(null, quests), null);
  assert.equal(homeStreakLabel(0), null);
  assert.equal(homeStreakLabel(null), null);
  assert.equal(homeStreakLabel(1), '🔥 1 quest on a streak');
  assert.equal(homeStreakLabel(2), '🔥 2 quests on a streak');
  assert.equal(cachedQuestStreakCount({ fire: 7, doneToday: true }), null, 'old day counter stays hidden');
  assert.equal(cachedQuestStreakCount({ questsOnStreak: 3 }), 3);

  const home = read('app/(app)/page.tsx');
  assert.match(home, /rpc\('get_quest_streaks'\)/);
  assert.doesNotMatch(home, /get_quest_streak(?!s)/);
  assert.match(home, /homeStreakLabel/);
  assert.doesNotMatch(home, /Streak \$\{|🔥 \{/);
  assert.doesNotMatch(home, /Finish a quest|keeps the streak|grace/);
});

test('Hub → Town → Hearth → Back to Town → browser Back lands on Hub', () => {
  let stack = noteVisit([], '/play');
  stack = noteVisit(stack, '/play/emberhaven');
  stack = noteVisit(stack, '/play/emberhaven/hearth');
  const backToTown = backDecision(stack, '/play/emberhaven');
  assert.equal(backToTown.action, 'back');
  stack = notePop(stack);
  assert.deepEqual(stack, ['/play', '/play/emberhaven']);
  stack = notePop(stack);
  assert.deepEqual(stack, ['/play']);
});

test('in-app Back replaces the current entry when the previous one is not the target', () => {
  const opened = noteVisit([], '/play/emberhaven/hearth');
  const back = backDecision(opened, '/play/emberhaven');
  assert.equal(back.action, 'replace');
  assert.deepEqual(back.stack, ['/play/emberhaven']);
  assert.equal(pathKey('/play/emberhaven/'), '/play/emberhaven');
  assert.deepEqual(noteVisit(['/play'], '/play'), ['/play']);
});

test('town, hub, and crypt ← Back links pop or replace instead of pushing', () => {
  const files = [
    'components/play/AdventureHub.tsx',
    'app/(app)/play/brain-rot/BrainRotDungeon.tsx',
    'app/(app)/play/emberhaven/TownBackLink.tsx',
    'components/crypt/DelveRun.tsx',
  ];
  for (const file of files) {
    const source = read(file);
    assert.match(source, /InAppBackLink/, file);
    assert.match(source, /← /, file);
  }
  assert.match(read('app/components/AppShell.tsx'), /<AppPathStack \/>/);
  assert.doesNotMatch(read('app/(app)/play/emberhaven/TownBackLink.tsx'), /<Link/);
  assert.doesNotMatch(read('components/crypt/DelveRun.tsx'), /<a className="btn ghost delve-leave"/);
});

test('rendered stat panels show STR, INT, VIT, and DIS only', () => {
  const row = playerStatRow(
    { display_name: 'Ada', vitality: 5, discipline: 2 },
    { attributes: { strength: 4, agility: 9, intelligence: 3, endurance: 8, luck: 7 } },
  );
  assert.deepEqual(lockedAttributeEntries(row).map((entry) => [entry.short, entry.value]), [
    ['STR', '4'],
    ['INT', '3'],
    ['VIT', '5'],
    ['DIS', '2'],
  ]);
  assert.deepEqual(lockedAttributeEntries(null).map((entry) => entry.short), ['STR', 'INT', 'VIT', 'DIS']);

  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { PlayerStatPanel } = loadModule(resolve(root, 'components/PlayerStatPanel.tsx'));
  const html = ['home', 'character', 'sample']
    .map((variant) => renderToStaticMarkup(React.createElement(PlayerStatPanel, { variant, row })))
    .join('\n');
  for (const label of ['STR', 'INT', 'VIT', 'DIS']) assert.match(html, new RegExp(`\\b${label}\\b`));
  assert.doesNotMatch(html, /\b(AGI|END|LCK)\b/);
  assert.doesNotMatch(html, />9<|>8<|>7</);

  for (const file of walk(resolve(root, 'app')).concat(walk(resolve(root, 'components')))) {
    const source = readFileSync(file, 'utf8');
    if (!/hub-stat-label|character-stat-label|character-stats|aria-label="Stats"|aria-label="Sample character attributes"/.test(source)) continue;
    assert.doesNotMatch(source, /\b(AGI|END|LCK)\b/, file);
  }
});

test('town pages clear the raised Hub button, and the hub warning stays on the Crypt', () => {
  for (const file of [
    'app/(app)/play/emberhaven/page.tsx',
    'app/(app)/play/emberhaven/hearth/page.tsx',
    'app/(app)/play/emberhaven/market/page.tsx',
    'app/(app)/play/emberhaven/waystone/page.tsx',
    'app/(app)/play/emberhaven/blacksmith/page.tsx',
  ]) {
    const source = read(file);
    const match = source.match(/paddingBottom: 'calc\((\d+)px \+ env\(safe-area-inset-bottom/);
    assert.ok(match, file);
    assert.ok(Number(match[1]) >= 112, `${file} bottom padding clears the raised Hub button`);
    assert.match(source, /town-screen/);
  }
  const hub = read('components/play/AdventureHub.tsx');
  assert.match(hub, /Crypt preview: earns no XP\./);
  assert.doesNotMatch(hub, /progress is not saved/);
  assert.match(read('lib/lanternRoute.ts'), /Progress is saved on this device/);
  assert.match(read('app/(app)/play/brain-rot/BrainRotDungeon.tsx'), /this device/);
  assert.match(read('lib/crypt/content.ts'), /Preview — progress is not saved and earns no XP/);
});

function pngPixels(buf) {
  let offset = 8;
  const parts = [];
  let size = 0;
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') size = data.readUInt32BE(0);
    if (type === 'IDAT') parts.push(data);
    if (type === 'IEND') break;
    offset += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = size * 4;
  const pixels = [];
  for (let y = 0; y < size; y++) pixels.push(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
  return Buffer.concat(pixels);
}

test('favicon is a gold-on-dark mark served at /favicon.ico', () => {
  const ico = readFileSync(resolve(root, 'public/favicon.ico'));
  const png = readFileSync(resolve(root, 'app/icon.png'));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1, 'icon type');
  assert.equal(pngPixels(png).includes(Buffer.from([0xe8, 0xc7, 0x7a])), true, 'gold #E8C77A');
  assert.equal(pngPixels(png).includes(Buffer.from([0x1c, 0x1f, 0x24])), true, 'dark ground');
  const embedded = ico.subarray(ico.readUInt32LE(18));
  assert.equal(pngPixels(embedded).includes(Buffer.from([0xe8, 0xc7, 0x7a])), true);
  assert.equal(existsSync(resolve(root, 'public/favicon.ico')), true);
});

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
    const base = resolve(dirname(file), spec);
    const found = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => existsSync(candidate));
    assert.ok(found, `cannot resolve ${spec} from ${file}`);
    return loadModule(found);
  };
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports);
  return module.exports;
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (path.endsWith('.tsx')) files.push(path);
  }
  return files;
}
