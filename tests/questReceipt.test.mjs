import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { completionFeedback } from '../lib/preview/questReceipt.mjs';

const instanceId = 'b1111111-1111-4111-8111-111111111111';
const awarded = {
  schema_version: 1, status: 'completed', quest_instance_id: instanceId,
  quest_completion_confirmed: true, reward_status: 'awarded',
  xp_awarded: 1, reward_confirmed: true,
  reward_awarded_at: '2026-10-28T07:00:00Z'
};

test('new XP feedback requires the matching quest-scoped ledger receipt', () => {
  assert.equal(completionFeedback(awarded, instanceId), 'Quest completed. +1 XP earned.');
  for (const invalid of [
    null, undefined, {}, [], { ...awarded, schema_version: 2 },
    { ...awarded, quest_instance_id: 'another-instance' },
    { ...awarded, quest_completion_confirmed: false },
    { ...awarded, status: 'available' },
    { ...awarded, reward_confirmed: false },
    { ...awarded, reward_awarded_at: null },
    { ...awarded, reward_status: 'not_awarded' },
    { ...awarded, xp_awarded: 0 },
    { ...awarded, xp_awarded: 2 }
  ]) {
    assert.doesNotMatch(completionFeedback(invalid, instanceId), /\+1 XP/);
  }
});

test('malformed or timezone-free ledger timestamps never justify XP feedback', () => {
  const invalidTimes = ['not-a-timestamp', '2026-10-28', '2026-10-28T07:00:00',
    '2026-10-28T07:00:00+99:99', '2026-02-30T07:00:00Z',
    '2026-04-31T07:00:00Z', '2026-02-29T07:00:00Z',
    '2026-00-10T07:00:00Z', '2026-13-10T07:00:00Z',
    '2026-10-28T24:00:00Z', '2026-10-28T07:60:00Z',
    '2026-10-28T07:00:60Z', '', 123];
  for (const reward_awarded_at of invalidTimes) {
    assert.doesNotMatch(completionFeedback({ ...awarded, reward_awarded_at }, instanceId), /\+1 XP/,
      'Malformed ledger timestamp cannot substantiate a new reward');
    assert.equal(completionFeedback({ ...awarded, reward_status: 'already_awarded',
      xp_awarded: 0, reward_awarded_at }, instanceId),
      'Quest completion confirmed, but XP award could not be verified.');
  }
  assert.equal(completionFeedback({ ...awarded,
    reward_awarded_at: '2026-10-28T07:00:00.123456+00:00' }, instanceId),
    'Quest completed. +1 XP earned.',
    'PostgreSQL timestamptz with fractional seconds and explicit offset is valid');
  assert.equal(completionFeedback({ ...awarded,
    reward_awarded_at: '2028-02-29T07:00:00.123456+00:00' }, instanceId),
    'Quest completed. +1 XP earned.',
    'Valid leap-day with PostgreSQL fractional seconds must remain accepted');
});

test('duplicate completion confirms previous reward without claiming a new award', () => {
  const duplicate = { ...awarded, reward_status: 'already_awarded', xp_awarded: 0 };
  assert.equal(completionFeedback(duplicate, instanceId),
    'Quest already completed. XP was awarded previously.');
  assert.doesNotMatch(completionFeedback({ ...duplicate, reward_confirmed: false }, instanceId), /\+1 XP/);
});

test('Home calls v2 only for completion and never infers XP from lifetime delta', () => {
  const home = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /if\(action==='complete'\)\{/);
  assert.match(home, /\.rpc\('set_quest_instance_status_v2',\{p_instance_id:id,p_action:action\}\)/);
  assert.match(home, /completionFeedback\(data,id\)/);
  assert.match(home, /\.rpc\('set_quest_instance_status',\{p_instance_id:id,p_action:action\}\)/);
  assert.doesNotMatch(home, /lifetimeXpDelta|xpDelta\s*>\s*0/);
});
