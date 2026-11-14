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

test('old companion and together URLs resolve to the shared homes for every account', () => {
  assert.equal(companionRedirect('/', 'companion'), null);
  assert.equal(companionRedirect('/quests', 'companion'), null);
  assert.equal(companionRedirect('/play', 'companion'), null);
  assert.equal(companionRedirect('/character', 'companion'), null);
  assert.equal(companionRedirect('/more', 'companion'), null);
  assert.equal(companionRedirect('/play/crypt', 'companion'), null);
  assert.equal(companionRedirect('/companion/home', 'companion'), '/');
  assert.equal(companionRedirect('/companion/quests', 'adventurer'), '/quests');
  assert.equal(companionRedirect('/companion/character', 'companion'), '/character');
  assert.equal(companionRedirect('/companion/rewards', 'signed-out'), '/more/rewards');
  assert.equal(companionRedirect('/companion/history', 'companion'), '/more/history');
  assert.equal(companionRedirect('/companion/log', 'companion'), '/log');
  assert.equal(companionRedirect('/companion', 'companion', 'invite=abc12345'), '/more/relationship?invite=abc12345');
  assert.equal(companionRedirect('/together', 'adventurer'), '/quests?chip=together');
  assert.equal(companionRedirect('/together/plans', 'companion'), '/quests?chip=together');
});

test('both accounts share Home, Quests, Character, and More, and companions omit Play', () => {
  assert.deepEqual(COMPANION_NAV.map((item) => item.label), ['Home', 'Quests', 'Character', 'More']);
  assert.equal(COMPANION_NAV.some((item) => item.label === 'Play' || item.href === '/play'), false);
  const adventurer = read('app/components/AppNav.tsx');
  assert.match(adventurer, /NAV_ITEMS/);
  assert.match(adventurer, /nav-play/);
  assert.match(adventurer, /role\.mode !== 'companion'/);
  const shell = read('app/components/AppShell.tsx');
  assert.match(shell, /<AppNav \/>/);
  assert.match(shell, /data-slot="engagement-status"/);
  assert.doesNotMatch(shell, /status pill|engagement pill/i);
  assert.doesNotMatch(shell, /CompanionNav/);
  assert.match(shell, /role-loading/);
  assert.match(read('components/play/AdventureHub.tsx'), /role\.mode === 'companion'/);
});

test('Just type shows the endpoint source without changing the parser route', () => {
  assert.equal(draftSourceLabel('model'), 'AI organized');
  assert.equal(draftSourceLabel('fallback'), 'Basic draft');
  assert.equal(draftSourceLabel('unconfigured'), null);
  const page = read('app/(app)/companion/page.tsx');
  const quests = read('components/quests/CompanionAssignmentsPanel.tsx');
  const route = read('app/api/companion/draft/route.ts');
  assert.match(page, /companion-draft-source/);
  assert.match(quests, /draftSourceLabel\(source\)/);
  assert.match(route, /source: 'fallback'/);
  assert.match(route, /source: clean\.length > 0 \? 'model' : 'fallback'/);
});
