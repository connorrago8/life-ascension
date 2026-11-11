import test from 'node:test';
import assert from 'node:assert/strict';
import { QUEST_BASE_XP, streakXp, streakHint } from '../lib/questStreak.ts';
import { completionFeedback } from '../lib/preview/questReceipt.mjs';

const id = 'a1111111-1111-4111-8111-111111111111';
const receipt = (xp, fire, first) => ({ schema_version: 1, status: 'completed', quest_instance_id: id,
  quest_completion_confirmed: true, reward_status: 'awarded', reward_confirmed: true,
  reward_awarded_at: '2026-11-06T15:00:00Z', xp_awarded: xp, base_xp: 10, streak_fire: fire, first_of_day: first });

test('founder base-10 formula and integer half-up rounding', () => {
  assert.equal(QUEST_BASE_XP, 10);
  for (const [fire, expected] of [[0,10],[1,11],[5,15],[7,17],[10,20]]) {
    assert.equal(streakXp(10, fire, false), expected);
  }
  assert.equal(streakXp(10, 14, false), 24);
  assert.equal(streakXp(15, 1, false), 17, '15 × 1.1 = 16.5 rounds half up to 17');
  for (const fire of [0, 7, 14]) assert.equal(streakXp(10, fire, true), 10, 'first quest never receives a bonus');
  assert.equal(streakHint({fire: 7, doneToday: true, today: '', timeZone: ''}), '🔥 7 · next quests 17 XP');
});

test('toast renders and validates the server base-10 receipt, with no legacy rounding hint', () => {
  assert.equal(completionFeedback(receipt(10, 7, true), id), 'Quest completed. +10 XP earned. 🔥 7 streak kept.');
  assert.equal(completionFeedback(receipt(17, 7, false), id), 'Quest completed. +17 XP earned (🔥 7 streak bonus +70%).');
  assert.doesNotMatch(completionFeedback(receipt(17, 7, false), id), /rounds to \+1|until 🔥/);
  assert.doesNotMatch(completionFeedback({...receipt(17,7,false), xp_awarded:16}, id), /XP earned/);
  assert.doesNotMatch(completionFeedback({...receipt(10,7,true), xp_awarded:17}, id), /XP earned/);
});
