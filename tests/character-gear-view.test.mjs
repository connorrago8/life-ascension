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
  assert.match(screen, /characterGearView\(equipmentMode, appearance\)/);
  assert.match(screen, /homeCharacterModel\(gearView\.appearance\)/);
  assert.match(screen, /beltPreviewStage=\{gearView\.beltStage\}/);
  assert.match(screen, /gearView\.canChange && selectedSlot/);
  assert.match(screen, /gearView\.canChange && !hideSampleStats/);
});
