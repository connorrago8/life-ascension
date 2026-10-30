/** Executes the committed Character route handlers with deferred authenticated RPCs.
 * No browser, hosted database, or Production calls. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { createLatestCharacterLoadGate } from '../lib/preview/latestCharacterLoadGate.ts';
import { SERVER_EQUIPPABLE_ITEMS, canRequestEquip, isSlotUnlocked, levelForVerifiedXp, slotLockText } from './helpers/gearSlotsModule.mjs';

const source = readFileSync(new URL('../app/(app)/character/page.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function findNode(predicate) {
  let found;
  function visit(node) {
    if (predicate(node)) { found = node; return; }
    if (!found) ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, 'expected Character route handler exists');
  return found;
}

function routeHandler(name, deps) {
  const node = name === 'load'
    ? findNode((n) => ts.isVariableDeclaration(n) && n.name.getText(ast) === 'load')
    : findNode((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'setItemEquipped');
  const code = name === 'load'
    ? `const handler = ${node.initializer.arguments[0].getText(ast)};`
    : `${node.getText(ast)}\nconst handler = setItemEquipped;`;
  const compiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(deps), `${compiled}\nreturn handler;`)(...Object.values(deps));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function scenario(oldGearPromise, equipPromise = null) {
  const owned = ['ashen-hood'];
  let gearCalls = 0;
  let equipCalls = 0;
  const history = [];
  let state = { status: 'ready', preview: false,
    gear: { ownedItemIds: owned, equippedItemIds: [] } };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'account-a', email: 'a@example.test' } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: null, error: null }),
    }) }) }),
    rpc: async (name) => {
      if (name === 'get_lifetime_xp') return { data: 10, error: null };
      if (name === 'equip_earned_armor') {
        equipCalls += 1;
        return equipPromise ?? { error: null };
      }
      if (name === 'get_earned_gear') {
        gearCalls += 1;
        return gearCalls === 1 ? oldGearPromise
          : { data: { ownedItemIds: owned, equippedItemIds: ['ashen-hood'] }, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
  const setState = (next) => { state = next; history.push(next); };
  const loadGate = { current: createLatestCharacterLoadGate() };
  const load = routeHandler('load', {
    loadGate, process, window: undefined, setState, supabase: () => client,
    verifiedLifetimeXp: (value) => value,
    parseAuthenticatedGearSnapshot: (value) => value,
    adventurerName: () => 'Adventurer', loginHref: () => '/login',
  });
  const equipItem = routeHandler('setItemEquipped', {
    levelForVerifiedXp, canRequestEquip, isSlotUnlocked, slotLockText, SERVER_EQUIPPABLE_ITEMS,
    state: { ...state, xp: 25 }, equipmentBusy: false, equipmentMutationInFlight: { current: false }, loadGate, setEquipmentBusy: () => {},
    setEquipmentError: () => {}, supabase: () => client, setState, load,
  });
  const equip = (on) => equipItem('headwear', 'ashen-hood', on);
  return { load, equip, loadGate, history, get state() { return state; },
    get gearCalls() { return gearCalls; }, get equipCalls() { return equipCalls; } };
}

test('late focus snapshot cannot visually unequip armor after successful server equip and fresh read', async () => {
  const staleGear = deferred();
  const app = scenario(staleGear.promise);
  const staleLoad = app.load();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.gearCalls, 1, 'focus read must be pending before equip');
  await app.equip(true); // actual route equip handler performs server RPC + await load()
  assert.equal(app.gearCalls, 2);
  assert.deepEqual(app.state.gear.equippedItemIds, ['ashen-hood']);
  staleGear.resolve({ data: { ownedItemIds: ['ashen-hood'], equippedItemIds: [] }, error: null });
  await staleLoad;
  assert.deepEqual(app.state.gear.equippedItemIds, ['ashen-hood'],
    'old verified snapshot must not overwrite newer server-confirmed equipment');
  assert.equal(app.history.at(-1).status, 'ready');
});

test('late failed focus request cannot replace successful newer character load with an error', async () => {
  const staleGear = deferred();
  const app = scenario(staleGear.promise);
  const staleLoad = app.load();
  await new Promise((resolve) => setImmediate(resolve));
  await app.load();
  staleGear.reject(new Error('offline'));
  await staleLoad;
  assert.equal(app.state.status, 'ready');
  assert.deepEqual(app.state.gear.equippedItemIds, ['ashen-hood']);
});

test('unmounted Character invalidates pending response and all load commits use latest-only gate', async () => {
  const staleGear = deferred();
  const app = scenario(staleGear.promise);
  const staleLoad = app.load();
  await new Promise((resolve) => setImmediate(resolve));
  app.loadGate.current.invalidate();
  staleGear.resolve({ data: { ownedItemIds: ['ashen-hood'], equippedItemIds: [] }, error: null });
  await staleLoad;
  assert.equal(app.history.length, 0);
  assert.match(source, /loadGate\.current\.invalidate\(\)/);
  const loadSource = findNode((n) => ts.isVariableDeclaration(n) && n.name.getText(ast) === 'load')
    .initializer.arguments[0].getText(ast);
  assert.equal((loadSource.match(/setState\(/g) ?? []).length, 1,
    'only guarded commit closure may call setState inside load');
  assert.match(loadSource, /if \(isCurrent\(\)\) setState\(next\)/);
});


test('rapid equip double-tap sends one mutation and releases the lock after confirmation', async () => {
  const pendingEquip = deferred();
  const confirmedGear = Promise.resolve({
    data: { ownedItemIds: ['ashen-hood'], equippedItemIds: ['ashen-hood'] }, error: null,
  });
  const app = scenario(confirmedGear, pendingEquip.promise);
  const first = app.equip(true);
  const second = app.equip(true);
  assert.equal(app.equipCalls, 1, 'second tap must not issue a concurrent armor RPC');
  pendingEquip.resolve({ error: null });
  await Promise.all([first, second]);
  assert.equal(app.equipCalls, 1);
  assert.equal(app.gearCalls, 1, 'successful equip must refresh authoritative gear once');
  assert.deepEqual(app.state.gear.equippedItemIds, ['ashen-hood']);
  await app.equip(true);
  assert.equal(app.equipCalls, 2, 'completed operation must release its synchronous lock');
});

test('failed equip releases singleflight lock without claiming equipment ownership', async () => {
  const failedEquip = deferred();
  const gear = Promise.resolve({
    data: { ownedItemIds: ['ashen-hood'], equippedItemIds: [] }, error: null,
  });
  const app = scenario(gear, failedEquip.promise);
  const first = app.equip(true);
  const second = app.equip(true);
  assert.equal(app.equipCalls, 1, 'pending failed request must still block duplicate taps');
  failedEquip.resolve({ error: { message: 'not authorized' } });
  await Promise.all([first, second]);
  assert.equal(app.equipCalls, 1);
  assert.equal(app.gearCalls, 0, 'failed mutation must not refresh as a success');
  assert.deepEqual(app.state.gear.equippedItemIds, [], 'failed equip cannot invent owned gear');
  await app.equip(true);
  assert.equal(app.equipCalls, 2, 'failure must release synchronous lock for a new attempt');
});

test('locked headwear (below Lv 3) never reaches the equip RPC', async () => {
  const gear = Promise.resolve({ data: { ownedItemIds: ['ashen-hood'], equippedItemIds: [] }, error: null });
  const app = scenario(gear);
  let message = '';
  const locked = routeHandler('setItemEquipped', {
    levelForVerifiedXp, canRequestEquip, isSlotUnlocked, slotLockText, SERVER_EQUIPPABLE_ITEMS,
    state: { status: 'ready', preview: false, xp: 24, gear: { ownedItemIds: ['ashen-hood'], equippedItemIds: [] } },
    equipmentBusy: false, equipmentMutationInFlight: { current: false }, loadGate: app.loadGate,
    setEquipmentBusy: () => {}, setEquipmentError: (m) => { message = m; },
    supabase: () => { throw new Error('locked slot must not call Supabase'); }, setState: () => {}, load: app.load,
  });
  await locked('headwear', 'ashen-hood', true);
  assert.equal(message, 'Unlocks at Lv 3.');
});
