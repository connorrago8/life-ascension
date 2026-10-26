import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
import { xpToAdvance } from '../lib/level.ts';
import { EQUIPMENT_SLOTS } from '../lib/equipment.ts';

register(new URL('./tsx-loader.mjs', import.meta.url).href);

const APPROVED_KINDS = [
  'Headwear',
  'Armor',
  'Weapon skin',
  'Shield',
  'Cloak',
  'Companion',
];

test('the demo has one cosmetic per equipment slot and does not grant XP', async () => {
  const gear = await import('../lib/demoGear.ts');
  assert.equal(gear.DEMO_ITEMS.length, EQUIPMENT_SLOTS.length);
  assert.deepEqual(gear.DEMO_ITEMS.map((item) => item.slot), EQUIPMENT_SLOTS.map((slot) => slot.key));
  assert.deepEqual(
    gear.DEMO_ITEMS.map((item) => [item.slot, item.kind]),
    [
      ['headwear', 'Headwear'],
      ['armor', 'Armor'],
      ['shield', 'Shield'],
      ['weapon', 'Weapon skin'],
      ['cloak', 'Cloak'],
      ['companion', 'Companion'],
    ],
  );
  assert.deepEqual(new Set(gear.DEMO_ITEMS.map((item) => item.kind)), new Set(APPROVED_KINDS));
  assert.equal(new Set(gear.DEMO_ITEMS.map((item) => item.name)).size, EQUIPMENT_SLOTS.length);
  for (const item of gear.DEMO_ITEMS) {
    assert.equal(item.name.trim().length > 0, true);
    assert.deepEqual(Object.keys(item).sort(), ['kind', 'name', 'slot']);
  }
  assert.equal(gear.DEMO_XP, 0);
  assert.equal(gear.DEMO_LEVEL, 1);
  assert.equal(gear.DEMO_XP_INTO_LEVEL, 0);
  assert.equal(gear.DEMO_XP_FOR_NEXT, xpToAdvance(1));
  assert.equal(gear.DEMO_BANNER, 'Demo items. Nothing is saved.');
  assert.match(gear.DEMO_COSMETIC_NOTE, /do not change stats, XP, or combat/);
  assert.deepEqual(gear.initialEquippedSlots(), EQUIPMENT_SLOTS.map((slot) => slot.key));
});

test('equip and unequip stay in local slot state and do not mutate the previous list', async () => {
  const { initialEquippedSlots, itemsFromEquipped, toggleEquipped } = await import('../lib/demoGear.ts');
  const start = initialEquippedSlots();
  const snapshot = [...start];

  const withoutHead = toggleEquipped(start, 'headwear');
  assert.deepEqual(start, snapshot);
  assert.equal(withoutHead.includes('headwear'), false);
  assert.deepEqual(withoutHead, start.filter((slot) => slot !== 'headwear'));

  const withHeadAgain = toggleEquipped(withoutHead, 'headwear');
  assert.deepEqual(withHeadAgain, start);
  assert.deepEqual(withoutHead.includes('headwear'), false);

  const onlyCompanion = toggleEquipped(toggleEquipped([], 'companion'), 'companion');
  assert.deepEqual(onlyCompanion, []);
  const companionOn = toggleEquipped([], 'companion');
  assert.deepEqual(companionOn, ['companion']);
  assert.deepEqual(toggleEquipped(['companion', 'headwear'], 'armor'), ['headwear', 'armor', 'companion']);

  assert.deepEqual(itemsFromEquipped([]), []);
  assert.equal(itemsFromEquipped(start).length, EQUIPMENT_SLOTS.length);
  assert.deepEqual(itemsFromEquipped(withoutHead).map((item) => item.slot), withoutHead);
  assert.equal(itemsFromEquipped(['armor'])[0].name, 'Quilted Armor');
  assert.deepEqual(toggleEquipped(start, /** @type {import('../lib/equipment.ts').SlotKey} */ ('nope')), start);
});

test('each slot has cosmetic art that stays visible when every item is worn', async () => {
  const { SPRITE_HEIGHT, SPRITE_LAYER_IDS, SPRITE_WIDTH, PALETTE, cosmeticOverlays, gearOverlay, layerRows, spriteRows } = await import('../components/spriteArt.ts');
  const gearInks = new Set(['K', 'G', 'g', 'A', 'a', 'D', 'I', 'W', 'V', 'v', 'R', 'Y', 'N']);
  for (const row of spriteRows()) {
    for (const ink of row) assert.equal(gearInks.has(ink), false);
  }

  const order = EQUIPMENT_SLOTS.map((slot) => slot.key);
  const layers = new Map(order.map((slot) => [slot, gearOverlay(slot)]));
  for (const slot of order) {
    const rows = layers.get(slot);
    assert.equal(rows.length, SPRITE_HEIGHT);
    let ink = 0;
    for (const row of rows) {
      assert.equal(row.length, SPRITE_WIDTH);
      for (const pixel of row) {
        assert.equal(pixel === '.' || Boolean(PALETTE[pixel]), true);
        if (pixel !== '.') ink += 1;
      }
    }
    assert.equal(ink >= 16, true, `${slot} should paint enough pixels to see`);
  }

  const body = layerRows('body');
  const paint = SPRITE_LAYER_IDS.map((id) => (id === 'body' ? body : layers.get(id)));
  for (const slot of order) {
    const rows = layers.get(slot);
    const start = SPRITE_LAYER_IDS.indexOf(slot);
    let visible = 0;
    for (let y = 0; y < rows.length; y += 1) {
      for (let x = 0; x < rows[y].length; x += 1) {
        if (rows[y][x] === '.') continue;
        const covered = paint.slice(start + 1).some((later) => later[y][x] !== '.');
        if (!covered) visible += 1;
      }
    }
    assert.equal(visible >= 8, true, `${slot} is covered by a later layer`);
  }

  const cloak = layers.get('cloak');
  let cloakAround = 0;
  let cloakBehind = 0;
  for (let y = 0; y < body.length; y += 1) {
    for (let x = 0; x < body[y].length; x += 1) {
      if (cloak[y][x] === '.') continue;
      if (body[y][x] === '.') cloakAround += 1;
      else cloakBehind += 1;
    }
  }
  assert.equal(SPRITE_LAYER_IDS.indexOf('cloak') < SPRITE_LAYER_IDS.indexOf('body'), true);
  assert.equal(cloakAround >= 16, true);
  assert.equal(cloakBehind >= 16, true);

  const companion = layers.get('companion');
  let companionOnBody = 0;
  let companionMax = -1;
  for (let y = 0; y < companion.length; y += 1) {
    for (let x = 0; x < companion[y].length; x += 1) {
      if (companion[y][x] === '.') continue;
      if (body[y][x] !== '.') companionOnBody += 1;
      companionMax = Math.max(companionMax, x);
    }
  }
  assert.equal(companionOnBody, 0);
  assert.equal(companionMax < 7, true);
  assert.equal(SPRITE_LAYER_IDS.at(-1), 'companion');

  const worn = cosmeticOverlays([{ slot: 'headwear', name: 'Wayfarer Hood' }, { slot: 'armor', name: '   ' }]);
  assert.deepEqual(Object.keys(worn), ['headwear']);
  assert.equal(worn.headwear, gearOverlay('headwear'));
  assert.deepEqual(cosmeticOverlays([]), {});
  assert.deepEqual(cosmeticOverlays(null), {});
});
