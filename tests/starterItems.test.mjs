import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  RUSTY_ARMOR, RUSTY_SWORD, RUST_COLORS, STARTER_ITEM_IDS, isStarterItemId, starterItemForSlot, starterSlots,
} from '../lib/starterLook.ts';
import { gearOverlays, rustyArmorOverlay, rustySwordOverlay, wornGearLabels, GEAR_INKS, GEAR_WIDTH, GEAR_HEIGHT } from '../lib/crypt/delve/gearArt.ts';
import { LOOT, LOOT_IDS, EARNED_GEAR, gearAttributes, lootById, loadoutPassives, loadoutCards } from '../lib/crypt/delve/loot.ts';
import { REWARD_POOL } from '../lib/crypt/delve/cards.ts';
import { homeCharacterModel } from '../lib/preview/characterRender.ts';
import { appearanceFromLoadout } from '../lib/preview/appearance.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ZERO = { strength: 0, agility: 0, intelligence: 0, endurance: 0, luck: 0 };

test('default: empty Weapon and Armor slots wear Rusty Sword and Rusty Armor', () => {
  assert.equal(RUSTY_SWORD.name, 'Rusty Sword');
  assert.equal(RUSTY_ARMOR.name, 'Rusty Armor');
  assert.deepEqual(starterSlots({ armor: false, weapon: false }), { armor: RUSTY_ARMOR, weapon: RUSTY_SWORD });
  assert.equal(starterItemForSlot('weapon'), RUSTY_SWORD);
  assert.equal(starterItemForSlot('armor'), RUSTY_ARMOR);
  assert.equal(starterItemForSlot('headwear'), null);
  const overlays = gearOverlays({});
  assert.deepEqual(overlays.chest, rustyArmorOverlay());
  assert.deepEqual(overlays['main-hand'], rustySwordOverlay());
  assert.equal(overlays.head, undefined);
  assert.equal(overlays['off-hand'], undefined);
  for (const rows of [rustyArmorOverlay(), rustySwordOverlay()]) {
    assert.equal(rows.length, GEAR_HEIGHT);
    for (const row of rows) {
      assert.equal(row.length, GEAR_WIDTH);
      for (const ink of row) assert.ok(ink === '.' || GEAR_INKS[ink], ink);
    }
  }
  assert.deepEqual(wornGearLabels({}), ['Rusty Sword', 'Rusty Armor']);
  // Home and /character sprite model.
  const model = homeCharacterModel(appearanceFromLoadout({ equipmentIds: [] }));
  assert.equal(model.starterArmor, true);
  assert.equal(model.starterWeapon, true);
});

test('override: real gear replaces the Rusty item in its slot only', () => {
  const sword = LOOT.find((entry) => entry.slot === 'weapon');
  const mail = LOOT.find((entry) => entry.slot === 'armor');
  const withSword = gearOverlays({ weapon: sword.id });
  assert.notDeepEqual(withSword['main-hand'], rustySwordOverlay());
  assert.deepEqual(withSword.chest, rustyArmorOverlay());
  assert.deepEqual(wornGearLabels({ weapon: sword.id }), [sword.name, 'Rusty Armor']);
  const full = gearOverlays({ weapon: sword.id, armor: mail.id });
  assert.notDeepEqual(full.chest, rustyArmorOverlay());
  assert.deepEqual(wornGearLabels({ weapon: sword.id, armor: mail.id }), [sword.name, mail.name]);
  assert.deepEqual(starterSlots({ armor: true, weapon: true }), { armor: null, weapon: null });
  const staff = homeCharacterModel(appearanceFromLoadout({ equipmentIds: ['walking-staff', 'ember-coat'] }));
  assert.equal(staff.starterWeapon, false);
  assert.equal(staff.starterArmor, false);
  assert.equal(staff.mainHand, 'staff');
});

test('unequip fallback: removing real gear returns the slot to its Rusty item, not empty', () => {
  const sword = LOOT.find((entry) => entry.slot === 'weapon');
  const worn = { weapon: sword.id };
  const unequipped = { ...worn };
  delete unequipped.weapon;
  assert.deepEqual(gearOverlays(unequipped)['main-hand'], rustySwordOverlay());
  assert.deepEqual(wornGearLabels(unequipped), ['Rusty Sword', 'Rusty Armor']);
  const hood = homeCharacterModel(appearanceFromLoadout({ equipmentIds: ['ashen-hood'] }));
  assert.equal(hood.starterWeapon, true);
  assert.equal(hood.starterArmor, true);
  // /character tiles and Home gear line name the Rusty item instead of Empty / Starter clothes.
  const screen = read('components/preview/CharacterScreen.tsx');
  assert.match(screen, /const itemName = item\?\.name \?\? starter\?\.name \?\? 'Empty';/);
  assert.match(screen, /starterItemForSlot\(slot\.key\)/);
  const home = read('app/(app)/page.tsx');
  assert.match(home, /starterSlots\(/);
  assert.doesNotMatch(home, /Starter clothes/);
});

test('Rusty items are zero-stat defaults that never drop, persist or change combat', () => {
  for (const item of [RUSTY_SWORD, RUSTY_ARMOR]) {
    assert.deepEqual(item.stats, {});
    assert.equal(item.passive, null);
    assert.ok(isStarterItemId(item.id));
    assert.equal(lootById(item.id), null);
    assert.ok(!LOOT_IDS.includes(item.id));
    assert.ok(!EARNED_GEAR.some((entry) => entry.id === item.id));
    assert.ok(!REWARD_POOL.includes(item.id));
  }
  // The combat loadout stays empty, so stats, passives and cards are unchanged.
  assert.deepEqual(gearAttributes({}), ZERO);
  assert.deepEqual(loadoutPassives({}), []);
  assert.deepEqual(loadoutCards({}), []);
  // Not referenced by any DB migration, loot table or run/battle logic.
  const sources = ['lib/crypt/delve/loot.ts', 'lib/crypt/delve/run.ts', 'lib/crypt/delve/battle.ts', 'lib/crypt/delve/cards.ts', 'lib/cryptVault.ts', 'lib/gearSlots.ts'];
  for (const path of sources) assert.doesNotMatch(read(path), /Rusty Sword|Rusty Armor|starter-rusty|starterLook/, path);
  for (const id of STARTER_ITEM_IDS) assert.doesNotMatch(read('supabase/migrations/202610300001_crypt_delve.sql'), new RegExp(id));
});

test('Home SVG draws the Rusty pieces only for empty slots, in sync with RUST_COLORS', () => {
  const art = read('components/preview/HomeCharacter.tsx');
  assert.match(art, /\{model\.starterArmor \? \(\n\s*<g data-starter="rusty-armor">/);
  assert.match(art, /model\.starterWeapon && model\.mainHand !== 'staff' && model\.mainHand !== 'lantern'/);
  assert.match(art, /data-starter="rusty-sword"/);
  for (const [key, value] of Object.entries(RUST_COLORS)) assert.match(art, new RegExp(`${key}: '${value}'`));
  // Crypt camp, run and combat sprites use the same overlays.
  assert.match(read('components/crypt/DelveRun.tsx'), /Wearing \{wornGearLabels\(loadout\)\.join/);
  assert.match(read('components/crypt/CombatView.tsx'), /const STARTER_OVERLAYS = gearOverlays\(\{\}\)/);
  assert.match(read('components/play/AdventureHub.tsx'), /const STARTER_OVERLAYS = gearOverlays\(\{\}\)/);
});
