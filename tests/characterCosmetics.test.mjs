import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../components/preview/CharacterScreen.tsx', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../lib/preview/catalog.ts', import.meta.url), 'utf8');
const appearance = readFileSync(new URL('../lib/preview/appearance.ts', import.meta.url), 'utf8');

test('cosmetics are separate from six gameplay equipment slots', () => {
  for (const slot of ['head', 'chest', 'main-hand', 'off-hand', 'legs', 'feet']) {
    assert.ok(appearance.includes("'"+slot+"'"), slot);
  }
  assert.match(screen, /character-cosmetics-panel/);
  assert.match(screen, /item.category === 'cosmetic'/);
  assert.match(screen, /cosmeticIds.includes\(item.id\)/);
  assert.match(screen, /unequip\(item.id\)/);
  assert.match(screen, /equip\(item.id\)/);
});

test('cosmetic catalog entries carry appearance colors and no stat modifiers', () => {
  for (const id of ['midnight-robe-dye', 'forest-mantle-dye', 'sunfire-cloak-dye', 'silver-hair-ribbon', 'copper-hair-ribbon']) {
    assert.ok(catalog.includes(id), id);
  }
  assert.doesNotMatch(catalog, /statBonus|xpBonus|attackBonus|defenseBonus/);
});
