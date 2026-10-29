import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Executes the actual Home logout callback against isolated auth/state mocks.
// No React renderer, hosted database, deployment, or iPhone acceptance.
const home = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
const start = home.indexOf('async function logout(){');
const end = home.indexOf('\n if(!ready)', start);
assert.ok(start >= 0 && end > start, 'Home logout callback boundaries changed');
const logoutSource = home.slice(start, end).trim();
const factory = new Function('layoutPreview', 'window', 'supabase', 'loadEpoch',
  'accountRef', 'setQuests', 'setInstances', 'setRecoveryQuests',
  'setRecoveryIds', 'setXp', 'setUser', 'setMessage', 'return (' + logoutSource + ');');

function setup(outcome = 'ok', preview = false) {
  const state = {
    user: 'account-a', quests: ['private quest'], instances: ['private progress'],
    recoveryQuests: ['private recovery'], recoveryIds: ['private id'],
    xp: 15, message: '', epoch: 4, account: 'account-a', signouts: 0, navigation: null,
  };
  const set = key => value => { state[key] = value; };
  const loadEpoch = { get current() { return state.epoch; }, set current(v) { state.epoch = v; } };
  const accountRef = { get current() { return state.account; }, set current(v) { state.account = v; } };
  const logout = factory(preview, { location: { assign: path => { state.navigation = path; } } },
    () => ({ auth: { signOut: async () => {
      state.signouts++;
      if (outcome === 'throw') throw Error('offline');
      return { error: outcome === 'error' ? { message: 'not signed out' } : null };
    } } }), loadEpoch, accountRef, set('quests'), set('instances'),
    set('recoveryQuests'), set('recoveryIds'), set('xp'), set('user'), set('message'));
  return { logout, state };
}

test('confirmed signout invalidates pending loads and clears all private state', async () => {
  const { logout, state } = setup();
  await logout();
  assert.equal(state.epoch, 5);
  assert.equal(state.account, null);
  assert.equal(state.user, null);
  assert.deepEqual(state.quests, []);
  assert.deepEqual(state.instances, []);
  assert.deepEqual(state.recoveryQuests, []);
  assert.deepEqual(state.recoveryIds, []);
  assert.equal(state.xp, null, 'signed-out XP is unknown, not verified zero');
  assert.equal(state.signouts, 1);
});

for (const outcome of ['error', 'throw']) {
  test(outcome + ' signout keeps authenticated UI state and reports failure', async () => {
    const { logout, state } = setup(outcome);
    await logout();
    assert.equal(state.epoch, 4);
    assert.equal(state.account, 'account-a');
    assert.equal(state.user, 'account-a');
    assert.deepEqual(state.quests, ['private quest']);
    assert.deepEqual(state.instances, ['private progress']);
    assert.equal(state.xp, 15);
    assert.match(state.message, /sign out.*not confirmed/i);
  });
}

test('development-only layout preview navigates without an auth mutation', async () => {
  const { logout, state } = setup('ok', true);
  await logout();
  assert.equal(state.navigation, '/login');
  assert.equal(state.signouts, 0);
  assert.equal(state.epoch, 4);
});
