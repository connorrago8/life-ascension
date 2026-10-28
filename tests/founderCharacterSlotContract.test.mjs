/**
 * Founder-approved six-slot Character progression: mock-only contract tests.
 * This file does NOT authorize equipment ownership, grants, auto-equip, or XP.
 * Runtime entitlement must be supplied by Alpha's trusted receipt contract.
 * Legacy Off Hand is a demo-only renderer slot, never a seventh progression slot.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const FOUNDER_SLOTS = Object.freeze([
  { slot: 'weapon', unlockLevel: 1 },
  { slot: 'head', unlockLevel: 5 },
  { slot: 'chest', unlockLevel: 10 },
  { slot: 'gloves', unlockLevel: 15 },
  { slot: 'boots', unlockLevel: 20 },
  { slot: 'legs', unlockLevel: 25 },
]);

/** Proposed UI-only projection; no application imports or backend writes. */
function mockSlotStates(levelProof, confirmedReceipts = []) {
  const level = levelProof?.confirmed === true
    && Number.isSafeInteger(levelProof.level) && levelProof.level >= 1
    ? levelProof.level : null;
  return FOUNDER_SLOTS.map(({ slot, unlockLevel }) => {
    if (level === null) return { slot, unlockLevel, status: 'LOCKED', reason: 'Verify level' };
    if (level < unlockLevel) return { slot, unlockLevel, status: 'LOCKED', reason: `Unlocks at Level ${unlockLevel}` };
    const receipt = confirmedReceipts.find((item) =>
      item?.slot === slot && item.confirmed === true && item.owned === true);
    if (!receipt) return { slot, unlockLevel, status: 'AVAILABLE', reason: 'Not owned' };
    return { slot, unlockLevel, status: receipt.equipped === true ? 'EQUIPPED' : 'OWNED', reason: 'Confirmed receipt' };
  });
}

test('Founder slot order and level gates are exact; legacy Off Hand is not progression', () => {
  assert.deepEqual(FOUNDER_SLOTS.map(({ slot, unlockLevel }) => [slot, unlockLevel]), [
    ['weapon', 1], ['head', 5], ['chest', 10],
    ['gloves', 15], ['boots', 20], ['legs', 25],
  ]);
  assert.equal(FOUNDER_SLOTS.some(({ slot }) => slot === 'off-hand' || slot === 'belt' || slot === 'mantle'), false);
});

test('unverified level fails closed, Level 1 has no armor, and Level 7 unlocks only weapon and head', () => {
  assert.equal(mockSlotStates({ level: 25, confirmed: false }).every((slot) => slot.status === 'LOCKED'), true);
  assert.equal(mockSlotStates({ level: 1, confirmed: true }).filter((slot) => slot.status === 'AVAILABLE').map((slot) => slot.slot).join(','), 'weapon');
  const level7 = mockSlotStates({ level: 7, confirmed: true });
  assert.deepEqual(level7.map((slot) => slot.status), [
    'AVAILABLE', 'AVAILABLE', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED',
  ]);
  assert.equal(level7.some((slot) => slot.status === 'OWNED' || slot.status === 'EQUIPPED'), false);
});

test('ownership and auto-equip require a confirmed receipt and a trusted unlocked level', () => {
  const forged = [
    { slot: 'weapon', confirmed: false, owned: true, equipped: true },
    { slot: 'head', confirmed: true, owned: false, equipped: true },
    { slot: 'chest', confirmed: true, owned: true, equipped: true },
  ];
  assert.deepEqual(mockSlotStates({ level: 7, confirmed: true }, forged).map((slot) => slot.status), [
    'AVAILABLE', 'AVAILABLE', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED',
  ]);
  const confirmed = [
    { slot: 'weapon', confirmed: true, owned: true, equipped: true },
    { slot: 'head', confirmed: true, owned: true, equipped: false },
  ];
  assert.deepEqual(mockSlotStates({ level: 7, confirmed: true }, confirmed).map((slot) => slot.status), [
    'EQUIPPED', 'OWNED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED',
  ]);
});

test('signed-in Character route never substitutes sample Level 7 for trusted XP', () => {
  const page = readFileSync(new URL('../app/(app)/character/page.tsx', import.meta.url), 'utf8');
  const demo = readFileSync(new URL('../components/preview/CharacterScreen.tsx', import.meta.url), 'utf8');
  assert.match(page, /client\.rpc\('get_lifetime_xp'\)/);
  assert.match(page, /const progress = levelFor\(state\.xp\)/);
  assert.match(page, /equipmentMode=\{state\.preview \? 'preview' : state\.gear \? 'verified' : 'unverified'\}/);
  assert.match(demo, /equipmentMode=\{state\.preview \? 'preview' : state\.gear \? 'verified' : 'unverified'\}/);
  assert.doesNotMatch(page, /Level 7|level:\s*7/);
  assert.match(page, /Equipment below is a visual demo using starter items/);
  assert.match(page, /const verifiedXp = verifiedLifetimeXp\(xpResult\.data\)/);
  assert.match(page, /equipmentMode=\{state\.preview \? 'preview' : state\.gear \? 'verified' : 'unverified'\}/);
  // Source guard only: the existing demo equipment picker is NOT a trusted entitlement UI.
});
