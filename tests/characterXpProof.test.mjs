/** Authenticated Character UI fail-closed XP regression. No Supabase/network writes. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { verifiedLifetimeXp } from '../lib/characterXpProof.ts';

test('trusted lifetime XP accepts zero and safe integer RPC payloads', () => {
  for (const [value, expected] of [[0, 0], [135, 135], [' 270 ', 270], [0n, 0], [25n, 25]]) {
    assert.equal(verifiedLifetimeXp(value), expected);
  }
});

test('malformed, missing, negative and unsafe XP fail closed rather than inventing Level 1', () => {
  for (const value of [null, undefined, '', 'not-xp', '-1', -1, 1.5, NaN, Infinity,
    '9007199254740992', Number.MAX_SAFE_INTEGER + 1, 9007199254740992n, {}, [], true]) {
    assert.equal(verifiedLifetimeXp(value), null, String(value));
  }
});

test('authenticated Character uses verified XP and never mounts sample Level 7', () => {
  const page = readFileSync(new URL('../app/(app)/character/page.tsx', import.meta.url), 'utf8');
  const preview = readFileSync(new URL('../components/preview/CharacterScreen.tsx', import.meta.url), 'utf8');
  assert.match(page, /client\.rpc\('get_lifetime_xp'\)/);
  assert.match(page, /const verifiedXp = verifiedLifetimeXp\(xpResult\.data\)/);
  assert.match(page, /if \(verifiedXp === null\)/);
  assert.match(page, /xp: verifiedXp/);
  assert.match(page, /equipmentMode=\{state\.preview \? 'preview' : state\.gear \? 'verified' : 'unverified'\}/);
  assert.match(preview, /gearView\.canChange && <p className="level-line">/);
  assert.doesNotMatch(page, /xp:\s*coerceXp\(xpResult\.data\)|Level 7|level:\s*7/);
  assert.match(page, /Equipment below is a visual demo using starter items/);
  assert.match(page, /parseAuthenticatedGearSnapshot\(gearResult\.data\)/);
  assert.match(page, /equipmentMode=\{state\.preview \? 'preview' : state\.gear \? 'verified' : 'unverified'\}/);
  assert.doesNotMatch(page, /xp:\s*coerceXp\(xpResult\.data\)/);
});

test('independent account fixture values cannot be silently substituted for missing XP', () => {
  // Contract-only two-user scenario; actual Supabase RLS and persistence remain blocked.
  const izzy = { userId: 'fixture-izzy', lifetimeXp: '135' };
  const friend = { userId: 'fixture-friend', lifetimeXp: '25' };
  const projections = new Map([izzy, friend].map(({ userId, lifetimeXp }) =>
    [userId, verifiedLifetimeXp(lifetimeXp)]));
  assert.equal(projections.get(izzy.userId), 135);
  assert.equal(projections.get(friend.userId), 25);
  assert.equal(projections.get('unrecognized-account') ?? null, null);
  assert.equal(verifiedLifetimeXp(undefined), null);
});
