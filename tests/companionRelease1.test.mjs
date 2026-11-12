import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMPANION_NAV,
  clearCompanionRoleCache,
  companionRedirect,
  draftSourceLabel,
  readCompanionRoleCache,
  roleFromCompanionState,
  writeCompanionRoleCache,
} from '../lib/companionAccess.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('role resolution uses an active companion bond and treats every other bond as an adventurer', () => {
  assert.equal(roleFromCompanionState(null), 'signed-out');
  assert.equal(roleFromCompanionState({ signedIn: false, bond: { role: 'companion', status: 'active' } }), 'signed-out');
  assert.equal(roleFromCompanionState({ signedIn: true, bond: { role: 'companion', status: 'active' } }), 'companion');
  assert.equal(roleFromCompanionState({ signedIn: true, bond: { role: 'inviter', status: 'active' } }), 'adventurer');
  assert.equal(roleFromCompanionState({ signedIn: true, bond: { role: 'companion', status: 'pending' } }), 'adventurer');
  assert.equal(roleFromCompanionState({ signedIn: true, bond: { role: 'companion', status: 'revoked' } }), 'adventurer');
  assert.equal(roleFromCompanionState({ signedIn: true, bond: null }), 'adventurer');
});

test('cached companion role is cleared on sign-out and an account switch', () => {
  clearCompanionRoleCache();
  writeCompanionRoleCache({ userId: 'izzy', mode: 'companion' });
  assert.equal(readCompanionRoleCache()?.userId, 'izzy');
  clearCompanionRoleCache();
  assert.equal(readCompanionRoleCache(), null);
  const hook = read('components/useCompanionRole.ts');
  assert.match(hook, /clearCompanionRoleCache\(\)/);
  assert.match(hook, /SIGNED_OUT/);
  assert.match(hook, /cached\.userId !== userId/);
});

test('companions leave adventurer paths and adventurers leave companion-only paths', () => {
  assert.equal(companionRedirect('/', 'companion'), '/companion/home');
  assert.equal(companionRedirect('/quests', 'companion'), '/companion/home');
  assert.equal(companionRedirect('/play', 'companion'), '/companion/home');
  assert.equal(companionRedirect('/play/delve', 'companion'), '/companion/home');
  assert.equal(companionRedirect('/character', 'companion'), '/companion/home');
  assert.equal(companionRedirect('/companion', 'companion'), null);
  assert.equal(companionRedirect('/companion/home', 'companion'), null);
  assert.equal(companionRedirect('/play/crypt', 'companion'), null);
  assert.equal(companionRedirect('/companion/home', 'adventurer'), '/');
  assert.equal(companionRedirect('/companion/quests', 'adventurer'), '/');
  assert.equal(companionRedirect('/companion/rewards', 'signed-out'), '/');
  assert.equal(companionRedirect('/companion/character', 'adventurer'), '/');
  assert.equal(companionRedirect('/quests', 'adventurer'), null);
  assert.equal(companionRedirect('/companion', 'adventurer'), null);
});

test('companion nav is Home, Quests, Character, and History, with no Play control', () => {
  assert.deepEqual(COMPANION_NAV.map((item) => item.label), ['Home', 'Quests', 'Character', 'History']);
  assert.equal(COMPANION_NAV.some((item) => item.label === 'Play' || item.href === '/play'), false);
  const nav = read('components/CompanionNav.tsx');
  const adventurer = read('app/components/AppNav.tsx');
  assert.doesNotMatch(nav, /nav-play|href="\/play"/);
  assert.match(adventurer, /NAV_ITEMS/);
  assert.match(adventurer, /nav-play/);
  assert.match(read('app/components/AppShell.tsx'), /role\.mode === 'companion' \? <CompanionNav \/> : <AppNav \/>/);
  assert.match(read('app/components/AppShell.tsx'), /role-loading/);
});

test('Just type shows the endpoint source without changing the parser route', () => {
  assert.equal(draftSourceLabel('model'), 'AI organized');
  assert.equal(draftSourceLabel('fallback'), 'Basic draft');
  assert.equal(draftSourceLabel('unconfigured'), null);
  const page = read('app/(app)/companion/page.tsx');
  const quests = read('app/(app)/companion/quests/page.tsx');
  const route = read('app/api/companion/draft/route.ts');
  assert.match(page, /companion-draft-source/);
  assert.match(quests, /draftSourceLabel\(source\)/);
  assert.match(route, /source: 'fallback'/);
  assert.match(route, /source: clean\.length > 0 \? 'model' : 'fallback'/);
});
