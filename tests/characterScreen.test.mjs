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

test('primary nav is Home, Quests, Play, Character, and More', () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item.label), ['Home', 'Quests', 'Play', 'Character', 'More']);
  assert.equal(NAV_ITEMS.find((item) => item.label === 'Play')?.href, '/play');
  assert.equal(NAV_ITEMS.some((item) => item.label === 'Health' || item.href === '/health'), false);
  assert.match(navSource, /NAV_ITEMS/);
  assert.match(navSource, /nav-play/);
  assert.doesNotMatch(navSource, /\/health/);
});

test('the six equipment slots are headwear, armor, shield, weapon, cloak, and companion', () => {
  assert.deepEqual(
    EQUIPMENT_SLOTS.map((slot) => slot.key),
    ['headwear', 'armor', 'shield', 'weapon', 'cloak', 'companion'],
  );
  assert.deepEqual(
    EQUIPMENT_SLOTS.map((slot) => slot.label),
    ['Headwear', 'Armor', 'Shield', 'Weapon', 'Cloak', 'Companion'],
  );
  assert.doesNotMatch(JSON.stringify(EQUIPMENT_SLOTS), /legs|feet/i);
  assert.doesNotMatch(JSON.stringify([...SPRITE_LAYER_IDS]), /legs|feet/i);
  assert.doesNotMatch(viewerSource, /['"](?:legs|feet)['"]/);
});

test('equipment slots start empty unless the player owns that item', () => {
  assert.equal(EQUIPMENT_SLOTS.length, 6);
  const empty = slotsWithItems([]);
  assert.deepEqual(empty.map((entry) => entry.label), [
    'Headwear: empty',
    'Armor: empty',
    'Shield: empty',
    'Weapon: empty',
    'Cloak: empty',
    'Companion: empty',
  ]);
  assert.equal(empty.every((entry) => entry.item === null), true);
  const owned = slotsWithItems([{ slot: 'headwear', name: 'Cloth Hood' }]);
  assert.equal(owned[0].label, 'Headwear: Cloth Hood');
  assert.equal(owned[0].item?.name, 'Cloth Hood');
  assert.equal(owned.slice(1).every((entry) => entry.item === null), true);
  assert.equal(slotAccessibleLabel('Companion', null), 'Companion: empty');
});

test('attribute cells stay a placeholder until the profile has real values', () => {
  const pending = attributeEntries(null);
  assert.equal(pending.length, 4);
  assert.deepEqual(pending.map((entry) => entry.short), ['STR', 'INT', 'VIT', 'DIS']);
  assert.equal(pending.every((entry) => entry.pending && entry.value === ATTRIBUTE_PLACEHOLDER), true);
  assert.equal(attributeValue({ display_name: 'Ada' }, 'strength'), ATTRIBUTE_PLACEHOLDER);
  const recorded = attributeEntries({ strength: 3, intelligence: 2, vitality: 0, discipline: '4' });
  assert.deepEqual(recorded.map((entry) => entry.value), ['3', '2', '0', '4']);
  assert.equal(recorded.some((entry) => entry.pending), false);
});

test('wellness stays disconnected unless real readings exist', () => {
  assert.equal(WELLNESS_EMPTY, 'Not connected yet');
  assert.deepEqual(wellnessSnapshot(null), { connected: false });
  assert.deepEqual(wellnessSnapshot({ display_name: 'Ada' }), { connected: false });
  assert.deepEqual(wellnessSnapshot({ sleep_hours: 7.2, steps: 6400 }), {
    connected: true,
    sleepHours: 7.2,
    steps: 6400,
  });
});

test('the adventurer is layered and beginner clothes are not weapons or armor', () => {
  for (const row of spriteRows()) assert.equal(row.length, SPRITE_WIDTH);
  assert.deepEqual([...SPRITE_LAYER_IDS], ['cloak', 'body', 'headwear', 'armor', 'shield', 'weapon', 'companion']);
  assert.equal(SPRITE_LAYER_IDS[0], 'cloak');
  assert.equal(SPRITE_LAYER_IDS.at(-1), 'companion');
  assert.equal(layerHasInk('body'), true);
  assert.equal(layerHasInk('cloak'), false);
  assert.equal(layerHasInk('headwear'), false);
  assert.equal(layerHasInk('armor'), false);
  assert.equal(layerHasInk('shield'), false);
  assert.equal(layerHasInk('weapon'), false);
  assert.equal(layerHasInk('companion'), false);
  for (const id of SPRITE_LAYER_IDS) assert.match(spriteSource, new RegExp(`data-layer=\\{id\\}|data-layer`));
  assert.match(spriteSource, /data-layer=\{id\}/);
});

test('slot silhouettes share one 16 by 16 pixel grid', () => {
  assert.deepEqual(SLOT_ICON_SLOTS, ['headwear', 'armor', 'shield', 'weapon', 'cloak', 'companion']);
  for (const slot of SLOT_ICON_SLOTS) {
    const rows = slotIconRows(slot);
    assert.equal(rows.length, 16);
    assert.equal(rows.every((row) => row.length === 16 && /^[.#]+$/.test(row)), true);
    assert.equal(rows.some((row) => row.includes('#')), true);
  }
});

test('character and play screens do not invent stats, wellness, or XP', () => {
  assert.match(characterSource, /Coming soon/);
  assert.match(characterSource, /WELLNESS_EMPTY|Not connected yet/);
  assert.match(characterSource, /slotsWithItems\(owned\)/);
  assert.doesNotMatch(characterSource, /7\.2|6,400|STR 4/);
  assert.match(viewerSource, /role="dialog"/);
  assert.match(viewerSource, /aria-modal="true"/);
  assert.match(viewerSource, /aria-label="Close"/);
  assert.match(viewerSource, /returnFocusRef/);
  assert.match(playSource, /Forgotten Crypt/);
  assert.match(playSource, /Coming soon/);
  assert.match(playSource, /Locked/);
  assert.match(playSource, /Real-life quests earn XP/);
  assert.doesNotMatch(playSource, /get_lifetime_xp|create_scheduled_quest/);
});
