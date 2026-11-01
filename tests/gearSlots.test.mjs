import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GEAR_SLOTS, LEFT_GEAR_SLOTS, RIGHT_GEAR_SLOTS, canRequestEquip, isSlotUnlocked, levelForVerifiedXp,
  ownedItemsForSlot, slotLockText,
} from './helpers/gearSlotsModule.mjs';

test('Character uses exactly the approved six slots with the approved unlock levels', () => {
  assert.deepEqual(GEAR_SLOTS.map((s) => [s.key, s.unlockLevel]), [
    ['headwear', 3], ['armor', 1], ['shield', 5], ['weapon', 1], ['cloak', 10], ['companion', 15],
  ]);
  assert.equal(LEFT_GEAR_SLOTS.length + RIGHT_GEAR_SLOTS.length, 6);
  assert.equal(slotLockText('companion'), 'Unlocks at Lv 15');
});

test('slot locks follow level and fail closed without a verified level', () => {
  assert.equal(isSlotUnlocked(1, 'weapon'), true);
  assert.equal(isSlotUnlocked(1, 'armor'), true);
  assert.equal(isSlotUnlocked(2, 'headwear'), false);
  assert.equal(isSlotUnlocked(3, 'headwear'), true);
  assert.equal(isSlotUnlocked(4, 'shield'), false);
  assert.equal(isSlotUnlocked(9, 'cloak'), false);
  assert.equal(isSlotUnlocked(14, 'companion'), false);
  assert.equal(isSlotUnlocked(15, 'companion'), true);
  assert.equal(isSlotUnlocked(null, 'weapon'), false);
});

test('verified XP maps to the same thresholds the SQL level gate uses', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202610290001_equip_level_gate.sql', import.meta.url), 'utf8');
  for (const [slot, xp] of [['headwear', 25], ['shield', 70], ['cloak', 270], ['companion', 595]]) {
    assert.match(sql, new RegExp(`'${slot}' then ${xp}`));
    const level = levelForVerifiedXp(xp);
    assert.equal(isSlotUnlocked(level, slot), true, `${slot} unlocked at ${xp} XP`);
    assert.equal(isSlotUnlocked(levelForVerifiedXp(xp - 1), slot), false, `${slot} locked at ${xp - 1} XP`);
  }
  assert.equal(levelForVerifiedXp(null), null);
});

test('only owned, slot-matching items can be requested', () => {
  assert.deepEqual(ownedItemsForSlot(['ashen-hood'], 'headwear'), ['ashen-hood']);
  assert.deepEqual(ownedItemsForSlot(['ashen-hood'], 'weapon'), []);
  assert.deepEqual(ownedItemsForSlot(undefined, 'headwear'), []);
  assert.equal(canRequestEquip(3, ['ashen-hood'], 'headwear', 'ashen-hood'), true);
  assert.equal(canRequestEquip(2, ['ashen-hood'], 'headwear', 'ashen-hood'), false);
  assert.equal(canRequestEquip(3, [], 'headwear', 'ashen-hood'), false);
  assert.equal(canRequestEquip(15, ['ashen-hood'], 'companion', 'ashen-hood'), false);
});
