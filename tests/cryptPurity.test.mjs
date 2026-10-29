import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ROOTS = ['lib/crypt', 'components/crypt', 'app/(app)/play/crypt'];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (/\.(ts|tsx|mjs|css)$/.test(entry)) files.push(path);
  }
  return files;
}

const files = ROOTS.flatMap((dir) => walk(join(root, dir)));
const blob = files.map((path) => readFileSync(path, 'utf8')).join('\n');
const presentation = files
  .filter((path) => !path.endsWith(`${join('lib', 'crypt', 'content.ts')}`))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

test('crypt code does not call Supabase, grant XP, or store progress', () => {
  assert.ok(files.length >= 4);
  const forbidden = [
    [/supabase/i, 'supabase'],
    [/\.rpc\s*\(/, 'rpc'],
    [/get_lifetime_xp/, 'get_lifetime_xp'],
    [/create_scheduled_quest/, 'create_scheduled_quest'],
    [/set_quest_instance_status/, 'set_quest_instance_status'],
    [/add_quest_progress/, 'add_quest_progress'],
    [/localStorage|sessionStorage|indexedDB/, 'browser storage'],
    [/\.from\s*\(/, 'from('],
    [/\binsert\s*\(/, 'insert'],
    [/\bupsert\s*\(/, 'upsert'],
    [/\bupdate\s*\(/, 'update'],
    [/\bfetch\s*\(/, 'fetch'],
    [/Bone King/, 'Bone King'],
  ];
  for (const [pattern, label] of forbidden) {
    assert.doesNotMatch(blob, pattern, label);
  }
  assert.match(blob, /Preview — progress is not saved and earns no XP/);
  assert.match(blob, /endCardParagraphs/);
  assert.match(blob, /broken compass/);
  assert.doesNotMatch(presentation, /broken compass/);
});

test('the level chip is a read of lifetime XP and nothing else', () => {
  const mark = readFileSync(join(root, 'components/play/WayfarerMark.tsx'), 'utf8');
  const rpcs = [...mark.matchAll(/\.rpc\(\s*'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(rpcs, ['get_lifetime_xp']);
  assert.match(mark, /getUser/);
  assert.doesNotMatch(mark, /\.from\s*\(|\binsert\s*\(|\bupsert\s*\(|\bupdate\s*\(|create_scheduled_quest|set_quest_instance_status|add_quest_progress|localStorage|sessionStorage/);
});


test('field journal and epilogue remain UI-only and provide accessible choices', () => {
  const screen = readFileSync(join(root, 'components/crypt/CryptRun.tsx'), 'utf8');
  assert.match(screen, /Wayfarer field journal/);
  assert.match(screen, /aria-expanded=\{fieldNotesOpen\}/);
  assert.match(screen, /aria-label="Wayfarer field journal"/);
  assert.match(screen, /run\.fightCleared/);
  assert.match(screen, /run\.eventCleared/);
  assert.match(screen, /run\.treasureCleared/);
  assert.ok(screen.includes("<strong>Compass:</strong> {run.hint ??"), "optional compass clue follows the warning choice");
  assert.match(screen, /Inspect the compass/);
  assert.match(screen, /Return to Brackenlight/);
  assert.match(screen, /Choose another ending/);
  assert.match(screen, /setShowFieldNotes\(null\)/);
  assert.match(screen, /setEndingChoice\(null\)/);
});


test('Character preserves six slots and never grants preview gear as authenticated ownership', () => {
  const screen = readFileSync(join(root, 'components/preview/CharacterScreen.tsx'), 'utf8');
  for (const slot of ['head', 'chest', 'legs', 'main-hand', 'off-hand', 'feet']) {
    assert.ok(screen.includes("slot: '" + slot + "'"), slot);
  }
  assert.match(screen, /characterGearView\(equipmentMode, appearance, verifiedGear\)/);
  assert.match(screen, /gearView\.source === 'verified'/);
  assert.match(screen, /verifiedGear\?\.ownedItemIds\.includes\('ashen-hood'\)/);
  assert.match(screen, /onEquipArmor/);
  assert.doesNotMatch(screen, /set_quest_instance_status|add_quest_progress|grantXp|supabase/);
});
