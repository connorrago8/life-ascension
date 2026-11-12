import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cosmeticTitle } from '../lib/levelTitles.ts';

const page = readFileSync(new URL('../app/(app)/companion/page.tsx', import.meta.url), 'utf8');
const pack = readFileSync(new URL('../docs/design-pack-v2.txt', import.meta.url), 'utf8');

test('the design pack is stored verbatim', () => {
  assert.match(pack, /^LIFE ASCENSION — CONTENT & DESIGN PACK V2/);
  assert.match(pack, /Nightcat Headset/);
  assert.match(pack, /Obsidian Sovereign/);
});

test('Izzy welcome and three steps use the pack copy', () => {
  assert.match(page, /Your story starts here, Izzy\./);
  assert.match(page, /Enter my story/);
  assert.match(page, /How it works/);
  assert.match(page, /Live it\./);
  assert.match(page, /Log it\./);
  assert.match(page, /Make it yours\./);
  assert.match(page, /Start my journey/);
});

test('titles show the most recent milestone', () => {
  assert.equal(cosmeticTitle(1, 'izzy'), 'The Unwritten');
  assert.equal(cosmeticTitle(4, 'izzy'), 'The Unwritten');
  assert.equal(cosmeticTitle(5, 'izzy'), 'Streetborn');
  assert.equal(cosmeticTitle(9, 'izzy'), 'Streetborn');
  assert.equal(cosmeticTitle(30, 'izzy'), 'Nightcat Operative');
  assert.equal(cosmeticTitle(50, 'izzy'), 'Obsidian Sovereign');
  assert.equal(cosmeticTitle(1, 'connor'), 'The Unmarked');
  assert.equal(cosmeticTitle(7, 'connor'), 'Ember Walker');
  assert.equal(cosmeticTitle(30, 'connor'), 'Voidrunner');
  assert.equal(cosmeticTitle(50, 'connor'), 'The Ascendant');
});

test('streak shield and weekly recap stay out of the app', () => {
  const home = readFileSync(new URL('../app/(app)/companion/home/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(home, /Streak Shield/);
  assert.doesNotMatch(page, /Another chapter written/);
});
