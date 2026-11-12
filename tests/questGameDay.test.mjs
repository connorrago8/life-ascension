/** Game day starts at 05:00 local. SQL behavior is in tests/sql/quest_game_day_smoke.sql. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fireFromDays, gameDayParts } from '../lib/questStreak.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const CHICAGO = 'America/Chicago';

test('04:59 belongs to the previous game day and 05:00 starts the new one', () => {
  assert.equal(gameDayParts(new Date('2026-06-15T09:59:00Z'), CHICAGO).date, '2026-06-14');
  assert.equal(gameDayParts(new Date('2026-06-15T10:00:00Z'), CHICAGO).date, '2026-06-15');
  assert.equal(gameDayParts(new Date('2026-06-15T10:00:00Z'), CHICAGO).minutes, 0);
  assert.equal(gameDayParts(new Date('2026-01-15T10:59:00Z'), CHICAGO).date, '2026-01-14');
  assert.equal(gameDayParts(new Date('2026-01-15T11:00:00Z'), CHICAGO).date, '2026-01-15');
});

test('both America/Chicago DST transitions keep 05:00 as the game-day boundary', () => {
  // Spring forward 2026-03-08 (02:00 CST → 03:00 CDT). 05:00 CDT is 10:00Z.
  assert.equal(gameDayParts(new Date('2026-03-08T09:59:00Z'), CHICAGO).date, '2026-03-07', '04:59 CDT');
  assert.equal(gameDayParts(new Date('2026-03-08T10:00:00Z'), CHICAGO).date, '2026-03-08', '05:00 CDT');
  // Fall back 2026-11-01. Both 01:30 passes are before 05:00 CST (11:00Z).
  assert.equal(gameDayParts(new Date('2026-11-01T06:30:00Z'), CHICAGO).date, '2026-10-31', '01:30 CDT');
  assert.equal(gameDayParts(new Date('2026-11-01T07:30:00Z'), CHICAGO).date, '2026-10-31', '01:30 CST');
  assert.equal(gameDayParts(new Date('2026-11-01T10:59:00Z'), CHICAGO).date, '2026-10-31', '04:59 CST');
  assert.equal(gameDayParts(new Date('2026-11-01T11:00:00Z'), CHICAGO).date, '2026-11-01', '05:00 CST');
  assert.equal(gameDayParts(new Date('2026-11-01T11:00:00Z'), CHICAGO).isoDow, 7);
});

test('streak fire follows game days across the 05:00 boundary', () => {
  const early = gameDayParts(new Date('2026-11-06T10:59:00Z'), CHICAGO).date;
  const opened = gameDayParts(new Date('2026-11-06T11:00:00Z'), CHICAGO).date;
  assert.equal(early, '2026-11-05');
  assert.equal(opened, '2026-11-06');
  assert.equal(fireFromDays([early], opened), 1, 'a 04:59 completion is yesterday once 05:00 arrives');
  assert.equal(fireFromDays([early, opened], opened), 1, 'the 05:00 completion does not increase F');
  assert.equal(fireFromDays([early, opened], '2026-11-07'), 2);
  assert.equal(fireFromDays([opened], '2026-11-07'), 1, 'a missed previous game day resets');
});

test('Monday 05:00 opens the week; Monday 04:59 stays in the previous week', () => {
  const before = gameDayParts(new Date('2026-11-02T10:59:00Z'), CHICAGO);
  const after = gameDayParts(new Date('2026-11-02T11:00:00Z'), CHICAGO);
  assert.equal(before.date, '2026-11-01');
  assert.equal(before.isoDow, 7);
  assert.equal(after.date, '2026-11-02');
  assert.equal(after.minutes, 0);
  assert.equal(after.isoDow, 1);
});

test('migration keys quests and streaks on the 05:00 game day and rolls back to midnight', () => {
  const up = read('supabase/migrations/202611080001_quest_game_day_5am.sql');
  const down = read('supabase/rollbacks/202611080001_quest_game_day_5am_down.sql');
  assert.match(up, /quest_game_day\(pg_catalog\.now\(\), public\.quest_timezone/);
  assert.match(up, /grant execute on function public\.quest_today\(\) to authenticated/);
  assert.match(down, /drop function if exists public\.quest_today\(\)/);
  assert.match(up, /interval '5 hours'/);
  assert.match(up, /% 4740/);
  assert.match(up, /quest_streak_xp\(10, v_fire, v_first\)/);
  assert.match(up, /pg_advisory_xact_lock/);
  assert.match(up, /on conflict \(instance_id\) do nothing/);
  assert.doesNotMatch(up, /create policy|drop policy|row level security/i);
  assert.doesNotMatch(up, /crypt_/i);
  assert.match(down, /% 5040/);
  assert.match(down, /drop function if exists public\.quest_game_day\(timestamptz, text\)/);
  assert.match(read('components/quests/PersonalQuestBoard.tsx'), /gameDayParts\(new Date\(\)\)/);
  assert.match(read('app/(app)/page.tsx'), /gameDayParts\(new Date\(\)\)/);
  assert.match(read('app/api/mcp/route.ts'), /gameDayParts\(new Date\(\)\)/);
});
