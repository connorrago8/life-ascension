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
  'Cloak / aura',
  'Banner / companion',
];

test('the demo has one cosmetic per equipment slot and does not grant XP', async () => {
  const gear = await import('../lib/demoGear.ts');
  assert.equal(gear.DEMO_ITEMS.length, EQUIPMENT_SLOTS.length);
  assert.deepEqual(gear.DEMO_ITEMS.map((item) => item.slot), EQUIPMENT_SLOTS.map((slot) => slot.key));
  assert.deepEqual(
    gear.DEMO_ITEMS.map((item) => [item.slot, item.kind]),
    [
      ['head', 'Headwear'],
      ['chest', 'Armor'],
      ['main-hand', 'Weapon skin'],
      ['off-hand', 'Shield'],
      ['feet', 'Banner / companion'],
      ['legs', 'Cloak / aura'],
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

  const withoutHead = toggleEquipped(start, 'head');
  assert.deepEqual(start, snapshot);
  assert.equal(withoutHead.includes('head'), false);
  assert.deepEqual(withoutHead, start.filter((slot) => slot !== 'head'));

  const withHeadAgain = toggleEquipped(withoutHead, 'head');
  assert.deepEqual(withHeadAgain, start);
  assert.deepEqual(withoutHead.includes('head'), false);

  const onlyFeet = toggleEquipped(toggleEquipped([], 'feet'), 'feet');
  assert.deepEqual(onlyFeet, []);
  const feetOn = toggleEquipped([], 'feet');
  assert.deepEqual(feetOn, ['feet']);
  assert.deepEqual(toggleEquipped(['feet', 'head'], 'chest'), ['head', 'chest', 'feet']);

  assert.deepEqual(itemsFromEquipped([]), []);
  assert.equal(itemsFromEquipped(start).length, EQUIPMENT_SLOTS.length);
  assert.deepEqual(itemsFromEquipped(withoutHead).map((item) => item.slot), withoutHead);
  assert.equal(itemsFromEquipped(['chest'])[0].name, 'Quilted Armor');
  assert.deepEqual(toggleEquipped(start, /** @type {import('../lib/equipment.ts').SlotKey} */ ('nope')), start);
});

test('each slot has cosmetic art that stays visible when every item is worn', async () => {
  const { SPRITE_HEIGHT, SPRITE_WIDTH, PALETTE, cosmeticOverlays, gearOverlay, spriteRows } = await import('../components/spriteArt.ts');
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

  for (const slot of order) {
    const later = order.slice(order.indexOf(slot) + 1);
    const rows = layers.get(slot);
    let visible = false;
    for (let y = 0; y < rows.length; y += 1) {
      for (let x = 0; x < rows[y].length; x += 1) {
        if (rows[y][x] === '.') continue;
        const covered = later.some((other) => layers.get(other)[y][x] !== '.');
        if (!covered) visible = true;
      }
    }
    assert.equal(visible, true, `${slot} is covered by a later cosmetic`);
  }

  const worn = cosmeticOverlays([{ slot: 'head', name: 'Wayfarer Hood' }, { slot: 'chest', name: '   ' }]);
  assert.deepEqual(Object.keys(worn), ['head']);
  assert.equal(worn.head, gearOverlay('head'));
  assert.deepEqual(cosmeticOverlays([]), {});
  assert.deepEqual(cosmeticOverlays(null), {});
});
