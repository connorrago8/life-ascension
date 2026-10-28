import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(source, resolver) {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)(resolver, mod, mod.exports);
  return mod.exports;
}
async function viewModule() {
  const appearance = load(await readFile(new URL('../lib/preview/appearance.ts', import.meta.url), 'utf8'), require);
  const view = load(await readFile(new URL('../lib/preview/characterGearView.ts', import.meta.url), 'utf8'),
    (name) => name === './appearance' ? appearance : require(name));
  return { appearance, view };
}

test('unverified account hides every sample item and never grants an equip action', async () => {
  const { appearance, view } = await viewModule();
  const demo = appearance.appearanceFromLoadout({
    equipmentIds: ['travelers-hood', 'walking-staff', 'wayfarer-coat'],
    colors: { belt: '#FFFFFF' },
  });
  const result = view.characterGearView('unverified', demo);
  assert.deepEqual(result.appearance.equipment, []);
  assert.equal(result.beltStage, 'starter');
  assert.equal(result.canChange, false);
  assert.notEqual(result.appearance.belt, demo.belt);
});

test('preview retains its session-only cosmetics without promoting them to ownership', async () => {
  const { appearance, view } = await viewModule();
  const demo = appearance.appearanceFromLoadout({ equipmentIds: ['walking-staff'] });
  const result = view.characterGearView('preview', demo);
  assert.equal(result.appearance, demo);
  assert.equal(result.beltStage, undefined);
  assert.equal(result.canChange, true);
});

test('authenticated character route opts out of preview loadout even when preview storage exists', async () => {
  const route = await readFile(new URL('../app/(app)/character/page.tsx', import.meta.url), 'utf8');
  const screen = await readFile(new URL('../components/preview/CharacterScreen.tsx', import.meta.url), 'utf8');
  assert.match(route, /equipmentMode=\{state\.preview \? 'preview' : 'unverified'\}/);
  assert.match(screen, /characterGearView\(equipmentMode, appearance, verifiedGear\)/);
  assert.match(screen, /visibleAppearance = displayName \? \{ \.\.\.gearView\.appearance, name: displayName \}/);
  assert.match(screen, /homeCharacterModel\(visibleAppearance\)/);
  assert.match(screen, /beltPreviewStage=\{gearView\.beltStage\}/);
  assert.match(screen, /gearView\.canChange && selectedSlot/);
  assert.match(screen, /gearView\.canChange && !hideSampleStats/);
});

test('verified armor needs both server-owned and equipped evidence, not XP or preview storage', async () => {
  const { appearance, view } = await viewModule();
  const demo = appearance.appearanceFromLoadout({
    equipmentIds: ['ashen-hood', 'walking-staff', 'ember-coat'],
  });
  const ownedOnly = view.characterGearView('verified', demo, {
    ownedItemIds: ['ashen-hood'], equippedItemIds: [],
  });
  assert.deepEqual(ownedOnly.appearance.equipment, []);
  assert.equal(ownedOnly.source, 'verified');
  assert.equal(ownedOnly.canChange, false);
  assert.equal(ownedOnly.beltStage, 'starter');

  const forgedEquip = view.characterGearView('verified', demo, {
    ownedItemIds: [], equippedItemIds: ['ashen-hood'],
  });
  assert.deepEqual(forgedEquip.appearance.equipment, []);
  assert.equal(forgedEquip.canChange, false);

  const earned = { ownedItemIds: ['ashen-hood'], equippedItemIds: ['ashen-hood'] };
  const firstLoad = view.characterGearView('verified', demo, earned);
  const refreshLoad = view.characterGearView('verified', appearance.appearanceFromLoadout({
    equipmentIds: ['walking-staff'],
  }), earned);
  assert.deepEqual(firstLoad.appearance.equipment.map((item) => item.id), ['ashen-hood']);
  assert.deepEqual(refreshLoad.appearance.equipment.map((item) => item.id), ['ashen-hood']);
  assert.equal(firstLoad.canChange, false);
  assert.equal(firstLoad.beltStage, 'starter');
  assert.equal(firstLoad.source, 'verified');
});

test('verified gear fails closed on absent, malformed or unsupported ownership data', async () => {
  const { appearance, view } = await viewModule();
  const demo = appearance.appearanceFromLoadout({ equipmentIds: ['ashen-hood'] });
  for (const invalid of [undefined, null, {}, { ownedItemIds: 'ashen-hood', equippedItemIds: ['ashen-hood'] },
    { ownedItemIds: ['ashen-hood'], equippedItemIds: null }]) {
    const result = view.characterGearView('verified', demo, invalid);
    assert.deepEqual(result.appearance.equipment, []);
    assert.equal(result.source, 'unverified');
    assert.equal(result.canChange, false);
  }
  const unsupported = view.characterGearView('verified', demo, {
    ownedItemIds: ['ember-coat', 'walking-staff'],
    equippedItemIds: ['ember-coat', 'walking-staff'],
  });
  assert.deepEqual(unsupported.appearance.equipment, []);
  assert.equal(unsupported.source, 'verified');
});

test('verified armor is read-only; authenticated route cannot fabricate the snapshot', async () => {
  const route = await readFile(new URL('../app/(app)/character/page.tsx', import.meta.url), 'utf8');
  const screen = await readFile(new URL('../components/preview/CharacterScreen.tsx', import.meta.url), 'utf8');
  assert.match(route, /equipmentMode=\{state\.preview \? 'preview' : 'unverified'\}/);
  assert.match(screen, /gearView\.source === 'verified'/);
  assert.match(screen, /verifiedGear\?: AuthenticatedGearSnapshot/);
  assert.match(screen, /gearView\.canChange && selectedSlot/);
  assert.doesNotMatch(route, /equipmentMode=\{'verified'\}/);
});
