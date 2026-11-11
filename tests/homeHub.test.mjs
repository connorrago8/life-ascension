import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { HOME_TIERS, homeSky, homeTierForLevel, hubSoundsEnabled } from '../lib/homeHub.ts';
import { levelFor } from '../lib/level.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the house grows only from quest level, in a fixed table', () => {
  assert.equal(homeTierForLevel(1).id, 'cottage');
  assert.equal(homeTierForLevel(levelFor(0).level).rooms, 1);
  assert.equal(homeTierForLevel(3).id, 'hearth');
  assert.equal(homeTierForLevel(5).garden, true);
  assert.equal(homeTierForLevel(8).banner, true);
  assert.equal(homeTierForLevel(20).id, 'keep');
  assert.deepEqual(HOME_TIERS.map((tier) => tier.level), [1, 3, 5, 8, 12]);
  assert.equal(homeSky(new Date('2026-06-15T04:30:00-05:00')), 'night');
  assert.equal(homeSky(new Date('2026-06-15T12:00:00-05:00')), 'day');
  assert.equal(hubSoundsEnabled(() => null), false);
  assert.equal(hubSoundsEnabled(() => 'on'), true);
  assert.match(read('docs/roguelite-design.md'), /Release 5, exploration/);
  assert.match(read('docs/roguelite-design.md'), /Crypt XP cap/);
  assert.match(read('docs/roguelite-design.md'), /view-only board for her is a product choice/);
});

test('home facilities reuse camp training and armory, and companions are not sent here', () => {
  const home = read('app/(app)/page.tsx');
  const camp = read('components/crypt/DelveRun.tsx');
  assert.match(home, /<TrainingRoom/);
  assert.match(home, /<Armory/);
  assert.match(home, /<HomeEstate/);
  assert.match(camp, /<TrainingRoom/);
  assert.match(camp, /<Armory/);
  assert.match(read('app/components/AppShell.tsx'), /companionRedirect/);
  assert.doesNotMatch(read('app/(app)/companion/home/page.tsx'), /HomeEstate|TrainingRoom|Enter the dungeon/);
});
