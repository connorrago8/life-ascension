import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { visibleCosmeticIds } from '../lib/adventurerCosmetics.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('worn cosmetics keep one piece per slot and do not touch combat stats', () => {
  assert.deepEqual(visibleCosmeticIds(['scarred-gloves', 'warden-boots']), ['warden-boots']);
  assert.deepEqual(visibleCosmeticIds(['dark-tunic', 'road-boots']).sort(), ['dark-tunic', 'road-boots'].sort());
  assert.deepEqual(visibleCosmeticIds(['not-a-piece']), []);
  const sprite = read('components/AdventurerCosmeticSprite.tsx');
  assert.match(sprite, /#ff2bd6/);
  assert.match(sprite, /#00f0ff/);
  assert.match(sprite, /#c9a227/);
  assert.doesNotMatch(sprite, /strength|agility|crypt_xp|record_crypt/);
  const track = read('components/AdventurerCosmeticTrack.tsx');
  assert.match(track, /adventurer_set_worn/);
  assert.match(track, /Wardrobe/);
  assert.doesNotMatch(track, /AdventurerCosmeticSprite/);
  assert.doesNotMatch(track, /from\('adventurer_worn'\)|insert into public\.adventurer_worn/);
  const page = read('app/(app)/character/page.tsx');
  assert.match(page, /AdventurerCosmeticTrack/);
  assert.doesNotMatch(page, /from\('adventurer_worn'\)/);
  const css = read('app/adventurer-dark.css');
  for (const line of css.split('\n')) {
    if (!line.includes('{')) continue;
    assert.match(line, /adventurer-track/);
  }
});
