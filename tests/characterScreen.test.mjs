import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ATTRIBUTE_PLACEHOLDER, attributeEntries, attributeValue } from '../lib/attributes.ts';
import { EQUIPMENT_SLOTS, slotAccessibleLabel, slotsWithItems } from '../lib/equipment.ts';
import { NAV_ITEMS } from '../lib/nav.ts';
import { WELLNESS_EMPTY, wellnessSnapshot } from '../lib/wellness.ts';
import { SPRITE_LAYER_IDS, layerHasInk, spriteRows, SPRITE_WIDTH } from '../components/spriteArt.ts';
import { SLOT_ICON_SLOTS, slotIconRows } from '../components/slotIcons.ts';

const navSource = readFileSync(new URL('../app/components/AppNav.tsx', import.meta.url), 'utf8');
const characterSource = readFileSync(new URL('../app/(app)/character/page.tsx', import.meta.url), 'utf8');
const viewerSource = readFileSync(new URL('../components/CharacterViewer.tsx', import.meta.url), 'utf8');
const spriteSource = readFileSync(new URL('../components/AdventurerSprite.tsx', import.meta.url), 'utf8');
const playSource = readFileSync(new URL('../app/(app)/play/page.tsx', import.meta.url), 'utf8');
const hubSource = readFileSync(new URL('../components/play/AdventureHub.tsx', import.meta.url), 'utf8');
const cryptContent = readFileSync(new URL('../lib/crypt/content.ts', import.meta.url), 'utf8');

test('primary nav is Home, Quests, Play, Character, and More', () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item.label), ['Home', 'Quests', 'Hub', 'Character', 'More']);
  assert.equal(NAV_ITEMS.find((item) => item.label === 'Hub')?.href, '/play');
  assert.equal(NAV_ITEMS.some((item) => item.label === 'Health' || item.href === '/health'), false);
  assert.match(navSource, /NAV_ITEMS/);
  assert.match(navSource, /nav-play/);
  assert.doesNotMatch(navSource, /\/health/);
});

test('equipment slots start empty unless the player owns that item', () => {
  assert.equal(EQUIPMENT_SLOTS.length, 6);
  const empty = slotsWithItems([]);
  assert.deepEqual(empty.map((entry) => entry.label), [
    'Head: empty',
    'Chest: empty',
    'Main Hand: empty',
    'Off Hand: empty',
    'Feet: empty',
    'Legs: empty',
  ]);
  assert.equal(empty.every((entry) => entry.item === null), true);
  const owned = slotsWithItems([{ slot: 'head', name: 'Cloth Hood' }]);
  assert.equal(owned[0].label, 'Head: Cloth Hood');
  assert.equal(owned[0].item?.name, 'Cloth Hood');
  assert.equal(owned.slice(1).every((entry) => entry.item === null), true);
  assert.equal(slotAccessibleLabel('Feet', null), 'Feet: empty');
});

test('attribute cells stay a placeholder until the profile has real values', () => {
  const pending = attributeEntries(null);
  assert.equal(pending.length, 5);
  assert.deepEqual(pending.map((entry) => entry.short), ['STR', 'AGI', 'INT', 'END', 'LCK']);
  assert.equal(pending.every((entry) => entry.pending && entry.value === ATTRIBUTE_PLACEHOLDER), true);
  assert.equal(attributeValue({ display_name: 'Ada' }, 'strength'), ATTRIBUTE_PLACEHOLDER);
  const recorded = attributeEntries({ strength: 3, agility: 1, intelligence: 2, endurance: 0, luck: '4' });
  assert.deepEqual(recorded.map((entry) => entry.value), ['3', '1', '2', '0', '4']);
  assert.equal(recorded.some((entry) => entry.pending), false);
});

test('wellness stays disconnected unless real readings exist', () => {
  assert.equal(WELLNESS_EMPTY, 'Not connected yet');
  assert.deepEqual(wellnessSnapshot(null), { connected: false });
  assert.deepEqual(wellnessSnapshot({ display_name: 'Ada' }), { connected: false });
  // Readings come from wellness_readings rows (dated), not profile fields.
  assert.deepEqual(wellnessSnapshot({ sleep_hours: 7.2, steps: 6400 }), { connected: false });
  assert.deepEqual(wellnessSnapshot([{ reading_date: '2026-10-29', sleep_hours: 7.2, steps: 6400 }]), {
    connected: true,
    date: '2026-10-29',
    sleepHours: 7.2,
    steps: 6400,
  });
});

test('the adventurer is layered and beginner clothes are not weapons or armor', () => {
  for (const row of spriteRows()) assert.equal(row.length, SPRITE_WIDTH);
  assert.deepEqual([...SPRITE_LAYER_IDS], ['body', 'head', 'chest', 'main-hand', 'off-hand', 'legs', 'feet']);
  assert.equal(layerHasInk('body'), true);
  assert.equal(layerHasInk('chest'), true);
  assert.equal(layerHasInk('legs'), true);
  assert.equal(layerHasInk('feet'), true);
  assert.equal(layerHasInk('head'), false);
  assert.equal(layerHasInk('main-hand'), false);
  assert.equal(layerHasInk('off-hand'), false);
  for (const id of SPRITE_LAYER_IDS) assert.match(spriteSource, new RegExp(`data-layer=\\{id\\}|data-layer`));
  assert.match(spriteSource, /data-layer=\{id\}/);
});

test('slot silhouettes share one 16 by 16 pixel grid', () => {
  assert.deepEqual(SLOT_ICON_SLOTS, ['head', 'chest', 'main-hand', 'off-hand', 'feet', 'legs']);
  for (const slot of SLOT_ICON_SLOTS) {
    const rows = slotIconRows(slot);
    assert.equal(rows.length, 16);
    assert.equal(rows.every((row) => row.length === 16 && /^[.#]+$/.test(row)), true);
    assert.equal(rows.some((row) => row.includes('#')), true);
  }
});

test('character and play screens do not invent stats, wellness, or XP', () => {
  // Stats are the real Crypt allocation (read-only RPC) or a dash; no "Coming soon" tiles.
  assert.doesNotMatch(characterSource, /Coming soon/);
  assert.match(characterSource, /client\.rpc\('get_crypt_profile'\)/);
  assert.match(characterSource, /attributeEntries\(state\.stats\)/);
  assert.match(characterSource, /WELLNESS_EMPTY|Not connected yet/);
  assert.match(characterSource, /equipmentMode=\{state\.preview \? 'preview' : state\.gear \? 'verified' : 'unverified'\}/);
  assert.match(characterSource, /client\.rpc\('get_earned_gear'\)/);
  assert.match(characterSource, /client\.rpc\('get_lifetime_xp'\)/);
  assert.doesNotMatch(characterSource, /7\.2|6,400|STR 4/);
  assert.match(viewerSource, /role="dialog"/);
  assert.match(viewerSource, /aria-modal="true"/);
  assert.match(viewerSource, /aria-label="Close"/);
  assert.match(viewerSource, /returnFocusRef/);
  assert.match(playSource, /AdventureHub/);
  assert.match(hubSource, /PREVIEW_BANNER/);
  assert.match(cryptContent, /Forgotten Crypt/);
  assert.match(cryptContent, /Coming soon/);
  assert.match(cryptContent, /Locked/);
  assert.match(cryptContent, /Real-life quests earn XP/);
  assert.doesNotMatch(playSource + hubSource + cryptContent, /get_lifetime_xp|create_scheduled_quest/);
});
