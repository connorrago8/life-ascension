import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/emberhavenMovement.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics?.length ?? 0, 0);
const exports = {};
const module = { exports };
new Function('module', 'exports', compiled.outputText)(module, exports);
const { walkTown, canOccupyTownPoint, townDistance, TOWN_OBSTACLES } = module.exports;

test('movement advances one step in each cardinal direction', () => {
  const origin = { x: 47, y: 43 };
  assert.deepEqual(walkTown(origin, 'north'), { x: 47, y: 35 });
  assert.deepEqual(walkTown(origin, 'south'), { x: 47, y: 51 });
  assert.deepEqual(walkTown(origin, 'east'), { x: 55, y: 43 });
  assert.deepEqual(walkTown(origin, 'west'), { x: 39, y: 43 });
});

test('movement clamps to the town perimeter', () => {
  const corner = { x: 8, y: 8 };
  assert.deepEqual(walkTown(corner, 'north'), corner);
  assert.deepEqual(walkTown(corner, 'west'), corner);
  assert.equal(canOccupyTownPoint({ x: 7, y: 50 }), false);
  assert.equal(canOccupyTownPoint({ x: 93, y: 50 }), false);
});

test('solid obstacles prevent walking into occupied positions', () => {
  assert.ok(TOWN_OBSTACLES.length >= 4);
  const obstacle = TOWN_OBSTACLES[0];
  assert.equal(canOccupyTownPoint({ x: obstacle.x, y: obstacle.y }), false);
  const before = { x: obstacle.x, y: obstacle.y + 8 };
  assert.deepEqual(walkTown(before, 'north'), before);
});

test('distance calculations support nearby landmark interactions', () => {
  assert.equal(townDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});
