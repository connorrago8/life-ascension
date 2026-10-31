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

test('Crypt gameplay remains reward-free; persistence is isolated and cloud saves default off', () => {
  assert.ok(files.length >= 4);
  const pureFiles = files.filter((path) => !path.endsWith(join('lib', 'crypt', 'cloudSave.ts'))
    && !path.endsWith(join('components', 'crypt', 'CryptRun.tsx')));
  const pureBlob = pureFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
  for (const [pattern, label] of [
    [/supabase/i, 'supabase in pure gameplay'], [/\.rpc\s*\(/, 'rpc in pure gameplay'],
    [/localStorage|sessionStorage|indexedDB/, 'browser storage in pure gameplay'],
    [/\.from\s*\(/, 'database query in pure gameplay'],
    [/\bfetch\s*\(/, 'network fetch in pure gameplay'],
  ]) assert.doesNotMatch(pureBlob, pattern, label);
  for (const pattern of [/get_lifetime_xp/, /create_scheduled_quest/, /set_quest_instance_status/,
    /add_quest_progress/, /grantXp/, /Bone King/]) assert.doesNotMatch(blob, pattern);
  const screen = readFileSync(join(root, 'components/crypt/CryptRun.tsx'), 'utf8');
  assert.match(screen, /NEXT_PUBLIC_CRYPT_CLOUD_SAVE_ENABLED\s*===\s*'true'/);
  assert.match(screen, /LOCAL_PREVIEW_SAVE_KEY/);
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


test('Character shows the six approved slots and never grants preview gear as authenticated ownership', () => {
  const screen = readFileSync(join(root, 'components/preview/CharacterScreen.tsx'), 'utf8');
  const slots = readFileSync(join(root, 'lib/gearSlots.ts'), 'utf8');
  for (const slot of ['headwear', 'armor', 'shield', 'weapon', 'cloak', 'companion']) {
    assert.ok(slots.includes("key: '" + slot + "'"), slot);
  }
  for (const old of ['Legs', 'Boots', 'Off hand']) assert.ok(!screen.includes("label: '" + old + "'"), old);
  assert.match(screen, /LEFT_GEAR_SLOTS/);
  assert.match(screen, /RIGHT_GEAR_SLOTS/);
  assert.match(screen, /characterGearView\(equipmentMode, appearance, verifiedGear\)/);
  assert.match(screen, /gearView\.source === 'verified'/);
  assert.match(screen, /ownedItemsForSlot\(verifiedGear\?\.ownedItemIds, key\)/);
  assert.match(screen, /onEquipItem/);
  assert.doesNotMatch(screen, /set_quest_instance_status|add_quest_progress|grantXp|supabase/);
});
