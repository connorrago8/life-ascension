import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gate = readFileSync(new URL('../lib/questReward.ts', import.meta.url), 'utf8');
const home = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');

test('reward feedback requires explicit server confirmation scoped to the requested instance', () => {
  assert.match(gate, /v\.reward_confirmed !== true/);
  assert.match(gate, /v\.quest_completion_confirmed !== true/);
  assert.match(gate, /v\.xp_awarded !== 1/);
  assert.match(gate, /v\.quest_instance_id !== expectedInstanceId/);
});

test('quest reward toast does not infer XP from lifetime XP changes', () => {
  assert.doesNotMatch(home, /nextXp\s*>\s*previousXp/);
  assert.match(home, /confirmedQuestReward\(result,instanceId\)/);
  assert.match(home, /if\(verified\)setReward/);
});
