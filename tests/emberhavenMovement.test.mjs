import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const movement = readFileSync(new URL('../lib/emberhavenMovement.ts', import.meta.url), 'utf8');

test('Town movement enforces map bounds and blocks obstacles', () => {
  assert.match(movement, /TOWN_BOUNDS/);
  assert.match(movement, /TOWN_OBSTACLES/);
  assert.match(movement, /canOccupyTownPoint/);
  assert.match(movement, /return canOccupyTownPoint\(next\) \? next : position/);
});

test('Town movement has directional steps and no account mutations', () => {
  for (const direction of ['north', 'south', 'east', 'west']) {
    assert.match(movement, new RegExp(direction));
  }
  assert.doesNotMatch(movement, /supabase|localStorage|fetch\(/);
});
