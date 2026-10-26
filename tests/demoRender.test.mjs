import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
import { EQUIPMENT_SLOTS } from '../lib/equipment.ts';

register(new URL('./tsx-loader.mjs', import.meta.url).href);

function buttonBlock(html, control, slot) {
  const match = html.match(new RegExp(
    `<button\\b(?=[^>]*data-equip-control="${control}")(?=[^>]*data-slot="${slot}")[^>]*>[\\s\\S]*?</button>`,
  ));
  assert.ok(match, `missing ${control} control for ${slot}`);
  return match[0];
}

function layers(html, slot) {
  return (html.match(/<g\b[^>]*>/g) ?? []).filter((tag) => tag.includes(`data-layer="${slot}"`));
}

async function render(initialEquipped) {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DemoCharacter } = await import('../components/DemoCharacter.tsx');
  const element = initialEquipped
    ? React.createElement(DemoCharacter, { initialEquipped })
    : React.createElement(DemoCharacter);
  return renderToStaticMarkup(element);
}

test('each slot renders in the row, the bag, and on the sprite', async () => {
  const { DEMO_ITEMS, DEMO_BANNER, DEMO_COSMETIC_NOTE } = await import('../lib/demoGear.ts');
  const html = await render();
  assert.match(html, new RegExp(DEMO_BANNER.replace(/[.]/g, '\\.')));
  assert.match(html, /Cosmetics only/);
  assert.match(html, new RegExp(DEMO_COSMETIC_NOTE.split('.')[0]));
  assert.match(html, /Coming soon/);
  assert.match(html, /Not connected yet/);
  assert.match(html, /Level 1/);
  assert.match(html, /0 \/ 10 XP/);
  assert.match(html, /aria-label="Equipped items"/);
  assert.doesNotMatch(html, /STR 4|7\.2|6,400/);

  for (const item of DEMO_ITEMS) {
    const row = buttonBlock(html, 'slot', item.slot);
    const bag = buttonBlock(html, 'bag', item.slot);
    const viewer = buttonBlock(html, 'viewer', item.slot);
    assert.match(row, /aria-pressed="true"/);
    assert.match(row, /class="equip-name"/);
    assert.match(row, new RegExp(item.name));
    assert.match(bag, /aria-pressed="true"/);
    assert.match(bag, new RegExp(item.kind.replace(/[/.]/g, '\\$&')));
    assert.match(bag, new RegExp(item.name));
    assert.match(bag, /Equipped/);
    assert.match(viewer, /aria-pressed="true"/);
    const painted = layers(html, item.slot);
    assert.equal(painted.length >= 2, true, item.slot);
    assert.equal(painted.every((tag) => tag.includes('data-equipped="true"')), true, item.slot);
  }

  assert.equal(EQUIPMENT_SLOTS.length, DEMO_ITEMS.length);
});

test('unequipping a slot clears that control, the sprite layer, and the equipped list', async () => {
  const { initialEquippedSlots, toggleEquipped } = await import('../lib/demoGear.ts');
  const html = await render(toggleEquipped(initialEquippedSlots(), 'head'));
  const head = buttonBlock(html, 'slot', 'head');
  const chest = buttonBlock(html, 'slot', 'chest');
  assert.match(head, /aria-pressed="false"/);
  assert.doesNotMatch(head, /class="equip-name"/);
  assert.match(chest, /aria-pressed="true"/);
  assert.match(chest, /Quilted Armor/);
  assert.equal(layers(html, 'head').some((tag) => tag.includes('data-equipped="true"')), false);
  assert.equal(layers(html, 'chest').every((tag) => tag.includes('data-equipped="true"')), true);
  assert.match(buttonBlock(html, 'bag', 'head'), /In bag/);
  assert.match(buttonBlock(html, 'bag', 'chest'), /Equipped/);
  assert.doesNotMatch(html, /Wayfarer Hood<\/span><\/li>/);

  const empty = await render([]);
  for (const slot of EQUIPMENT_SLOTS) {
    assert.match(buttonBlock(empty, 'slot', slot.key), /aria-pressed="false"/);
    assert.match(buttonBlock(empty, 'bag', slot.key), /In bag/);
    assert.equal(layers(empty, slot.key).some((tag) => tag.includes('data-equipped="true"')), false);
  }
  assert.match(empty, /Nothing equipped/);
});
