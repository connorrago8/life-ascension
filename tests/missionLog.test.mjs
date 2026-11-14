import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatResetCountdown, minutesUntilGameDayReset } from '../lib/gameDayReset.ts';
import { assignTargetName, markPartnerSeen, unseenPartnerCount } from '../lib/partnerQueue.ts';
import { LIVE_PROGRESS_EFFECTS } from '../lib/liveProgress.ts';
import { questRowStreak, rowAccent } from '../lib/questRowStreak.ts';

test('countdown uses the 5:00 America/Chicago boundary in both standard and daylight time', () => {
  assert.equal(minutesUntilGameDayReset(new Date('2026-01-15T10:00:00Z')), 60);
  assert.equal(minutesUntilGameDayReset(new Date('2026-07-15T09:00:00Z')), 60);
  assert.equal(minutesUntilGameDayReset(new Date('2026-01-15T10:59:00Z')), 1);
  assert.equal(minutesUntilGameDayReset(new Date('2026-07-15T09:59:00Z')), 1);
  assert.equal(minutesUntilGameDayReset(new Date('2026-01-15T11:00:00Z')), 24 * 60);
  assert.equal(minutesUntilGameDayReset(new Date('2026-07-15T10:00:00Z')), 24 * 60);
  assert.equal(minutesUntilGameDayReset(new Date('2026-11-01T09:30:00Z')), 90);
  assert.equal(formatResetCountdown(372), '6h 12m');
  assert.equal(formatResetCountdown(24 * 60), '24h 0m');
});

test('unseen partner count ignores ids already opened', () => {
  assert.equal(unseenPartnerCount(['a', 'b', 'a'], new Set()), 2);
  assert.equal(unseenPartnerCount(['a', 'b'], new Set(['a'])), 1);
  assert.equal(unseenPartnerCount(['a'], markPartnerSeen(['a', 'b'], new Set())), 0);
  assert.equal(unseenPartnerCount(['', 'c'], new Set()), 1);
});

test('assign sheet names Me or the partner and sparks stay off', () => {
  assert.equal(assignTargetName(true, false), 'Me');
  assert.equal(assignTargetName(false, false), 'Izzy');
  assert.equal(assignTargetName(false, true), 'Connor');
  assert.equal(LIVE_PROGRESS_EFFECTS, false);
  const board = readFileSync(new URL('../components/quests/PersonalQuestBoard.tsx', import.meta.url), 'utf8');
  assert.match(board, /Who is this quest for/);
  assert.match(board, /assignTargetName\(false, companion\)/);
  assert.match(board, /companion_send_quest/);
  assert.match(board, /FROM IZZY|partnerOwnershipTag/);
  assert.match(board, /Sent to partner/);
  assert.match(board, /questRowStreak/);
  assert.match(board, /log-flame/);
});

test('a quest streak counts that quest’s own completed periods and ignores the global day rule', () => {
  assert.equal(questRowStreak('daily', ['2026-11-12', '2026-11-13', '2026-11-14'], '2026-11-14'), 3);
  assert.equal(questRowStreak('daily', ['2026-11-12', '2026-11-13'], '2026-11-14'), 2);
  assert.equal(questRowStreak('daily', ['2026-11-12'], '2026-11-14'), 0);
  assert.equal(questRowStreak('daily', ['2026-11-14'], '2026-11-14'), 1);
  assert.equal(questRowStreak('weekly', ['2026-11-02', '2026-11-09'], '2026-11-16'), 2);
  assert.equal(questRowStreak('weekly', ['2026-10-26', '2026-11-09'], '2026-11-16'), 1);
  assert.equal(questRowStreak('once', ['2026-11-14'], '2026-11-14'), 0);
  assert.equal(rowAccent({ partner: true, cadence: 'weekly' }), 'cyan');
  assert.equal(rowAccent({ together: true, cadence: 'daily' }), 'cyan');
  assert.equal(rowAccent({ cadence: 'weekly' }), 'gold');
  assert.equal(rowAccent({ cadence: 'daily' }), 'magenta');
  assert.equal(rowAccent({ cadence: 'once', dueToday: true }), 'magenta');
  assert.equal(rowAccent({ cadence: 'once' }), 'muted');
});
