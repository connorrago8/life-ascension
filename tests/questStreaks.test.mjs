/** Quest & streak rules (t672u): pure TS mirror, receipt feedback, and source guards on the
 * TEST-only migration. The SQL behaviour itself (locks, windows, idempotency) is exercised by
 * tests/sql/quest_streaks_smoke.sql and tests/sql/quest_streaks_concurrency.sh against a real
 * PostgreSQL; this file runs in Node only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DAILY_BOARD_SIZE, WEEKLY_WINDOW_MINUTES, dailyBoardIds, fireFromDays, fnv1a32, localParts,
  minutesIntoWeek, parseStreak, streakBonusPercent, streakHint, streakXp, weekStart,
  weeklyAppearLabel, weeklyAppearOffset, weeklyVisible,
} from '../lib/questStreak.ts';
import { todayGlance } from '../lib/homeToday.ts';
import { completionFeedback } from '../lib/preview/questReceipt.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/202610310001_quest_streaks_weekly.sql');
const rollback = read('supabase/rollbacks/202610310001_quest_streaks_weekly_down.sql');
const USER = '00000000-0000-0000-0000-00000000d001';

test('streak XP: first of the day has no bonus; later ones floor(xp × (1 + 0.1F))', () => {
  assert.equal(streakXp(1, 0, true), 1);
  assert.equal(streakXp(10, 7, true), 10, 'first quest of the day: no bonus even at F=7');
  assert.equal(streakXp(10, 1, false), 11, 'F=1 → ×1.1');
  assert.equal(streakXp(10, 7, false), 17, 'F=7 → ×1.7');
  assert.equal(streakXp(3, 5, false), 4, 'floor(4.5)');
  assert.equal(streakXp(1, 7, false), 1, 'floor(1.7): a 1 XP quest shows no bonus until F=10');
  assert.equal(streakXp(1, 9, false), 1);
  assert.equal(streakXp(1, 10, false), 2);
  assert.equal(streakXp(1, 20, false), 3);
  assert.equal(streakXp(1, 400, false), 41, 'no cap');
  for (let f = 0; f < 200; f++) assert.equal(streakXp(7, f, false), Math.floor((7 * (10 + f)) / 10), 'integer math');
  assert.equal(streakBonusPercent(7), 70);
});

test('fire counts consecutive days ending yesterday; today never counts; a miss resets', () => {
  const days = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'];
  assert.equal(fireFromDays(days, '2026-10-30'), 7);
  assert.equal(fireFromDays([...days, '2026-10-30'], '2026-10-30'), 7, 'today’s completions do not change F');
  assert.equal(fireFromDays(days, '2026-10-31'), 0, 'missed Oct 30 resets');
  assert.equal(fireFromDays(days.filter((d) => d !== '2026-10-27'), '2026-10-30'), 2, 'a gap stops the count');
  assert.equal(fireFromDays([], '2026-10-30'), 0);
  // Month and DST boundaries are calendar days, not 24h steps.
  assert.equal(fireFromDays(['2026-10-31', '2026-11-01'], '2026-11-02'), 2);
  assert.equal(fireFromDays(['2027-03-13', '2027-03-14'], '2027-03-15'), 2);
});

test('local day: Chicago midnight and DST boundaries', () => {
  assert.equal(localParts(new Date('2026-10-29T04:59:59Z')).date, '2026-10-28', '23:59:59 CDT');
  assert.equal(localParts(new Date('2026-10-29T05:00:00Z')).date, '2026-10-29', '00:00 CDT');
  // Fall back (Nov 1 2026, 25h day): 23:30 CST is 05:30Z on Nov 2.
  assert.equal(localParts(new Date('2026-11-02T05:30:00Z')).date, '2026-11-01');
  assert.equal(localParts(new Date('2026-11-02T06:00:00Z')).date, '2026-11-02');
  assert.equal(localParts(new Date('2026-11-01T06:30:00Z')).minutes, 90, '01:30 CDT (first pass)');
  assert.equal(localParts(new Date('2026-11-01T07:30:00Z')).minutes, 90, '01:30 CST again after fall back');
  assert.equal(localParts(new Date('2026-11-01T07:30:00Z')).date, '2026-11-01');
  // Spring forward (Mar 14 2027, 23h day).
  assert.equal(localParts(new Date('2027-03-15T04:59:00Z')).date, '2027-03-14', '23:59 CDT');
  assert.equal(localParts(new Date('2027-03-14T08:00:00Z')).minutes, 3 * 60, '02:00 CST → 03:00 CDT');
  assert.equal(localParts(new Date('2026-10-30T15:00:00Z')).isoDow, 5, 'Friday');
});

test('fnv1a32 matches the SQL quest_fnv1a values asserted in quest_streaks_smoke.sql', () => {
  assert.equal(fnv1a32('a'), 3826002220);
  assert.equal(fnv1a32('héllo'), 1252296000, 'UTF-8 bytes');
  assert.equal(fnv1a32(`${USER}:00000000-0000-0000-0000-00000000d0a1:2026-10-26`), 475018547);
  assert.equal(migration.includes("quest_weekly_appears_at(p_owner uuid, p_quest uuid, p_week date, p_tz text)"), true);
  assert.match(migration, /% 5040/);
  assert.equal(WEEKLY_WINDOW_MINUTES, 5040);
});

test('weekly window: appears Mon 00:00–Thu 12:00, stays through Sunday, resets next week', () => {
  assert.equal(weekStart('2026-10-26'), '2026-10-26');
  assert.equal(weekStart('2026-10-29'), '2026-10-26');
  assert.equal(weekStart('2026-11-01'), '2026-10-26', 'Sunday belongs to the week');
  assert.equal(weekStart('2026-11-02'), '2026-11-02');
  const quest = '00000000-0000-0000-0000-00000000d0a1';
  const offset = weeklyAppearOffset(USER, quest, '2026-10-26');
  assert.equal(offset, 3587);
  assert.equal(weeklyAppearLabel(offset), 'Wed 11:47 AM');
  assert.equal(weeklyVisible(USER, quest, '2026-10-28', 11 * 60 + 46), false, 'hidden one minute before');
  assert.equal(weeklyVisible(USER, quest, '2026-10-28', 11 * 60 + 47), true);
  assert.equal(weeklyVisible(USER, quest, '2026-11-01', 23 * 60 + 59), true, 'still there Sunday 23:59');
  assert.equal(weeklyVisible(USER, quest, '2026-11-02', 0), weeklyAppearOffset(USER, quest, '2026-11-02') === 0, 'new week: new seed');
  assert.equal(minutesIntoWeek('2026-10-29', 12 * 60), 3.5 * 1440);
  // Every seed lands in [Mon 00:00, Thu 12:00), and seeds differ per quest and week.
  const offsets = new Set();
  for (let i = 0; i < 2000; i++) {
    const o = weeklyAppearOffset(USER, `quest-${i}`, '2026-10-26');
    assert.ok(o >= 0 && o < 3.5 * 1440);
    assert.equal(weeklyVisible(USER, `quest-${i}`, '2026-10-29', 12 * 60), true, 'all visible by Thursday noon');
    offsets.add(o);
  }
  assert.ok(offsets.size > 1000, 'appearance times are spread out');
  assert.notEqual(weeklyAppearOffset(USER, quest, '2026-10-26'), weeklyAppearOffset(USER, quest, '2026-11-02'));
});

test('daily board: all quests when 5 or fewer, otherwise a stable seeded 5 per user and day', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `q-${i}`);
  assert.equal(DAILY_BOARD_SIZE, 5);
  assert.deepEqual([...dailyBoardIds(USER, '2026-10-30', ids.slice(0, 5))].sort(), ids.slice(0, 5).sort());
  const a = dailyBoardIds(USER, '2026-10-30', ids);
  assert.equal(a.size, 5);
  assert.deepEqual([...dailyBoardIds(USER, '2026-10-30', [...ids].reverse())].sort(), [...a].sort(), 'order-independent');
  assert.deepEqual([...dailyBoardIds(USER, '2026-10-30', ids)].sort(), [...a].sort(), 'stable across reloads');
  const days = new Set();
  for (let d = 1; d <= 28; d++) days.add([...dailyBoardIds(USER, `2027-02-${String(d).padStart(2, '0')}`, ids)].sort().join());
  assert.ok(days.size > 20, 'rotates day to day');
  assert.notDeepEqual([...dailyBoardIds('other-user', '2026-10-30', ids)].sort(), [...a].sort());
});

test('Home glance mirrors the board: off-board dailies are not "left" but count when done', () => {
  const quests = Array.from({ length: 8 }, (_, i) => ({ id: `q-${i}`, cadence: 'daily', quest_type: 'scheduled', scheduled_for: null }));
  const board = dailyBoardIds(USER, '2026-10-30', quests.map((q) => q.id));
  const off = quests.find((q) => !board.has(q.id));
  const instances = [{ quest_id: off.id, due_date: '2026-10-30', status: 'completed' }];
  assert.deepEqual(todayGlance(quests, instances, '2026-10-30', { userId: USER, minutesOfDay: 600 }), { left: 5, done: 1 });
  assert.deepEqual(todayGlance(quests, instances, '2026-10-30'), { left: 7, done: 1 }, 'legacy callers unchanged');
});

test('parseStreak validates the RPC and the hint is honest about rounding', () => {
  assert.deepEqual(parseStreak({ fire: 7, done_today: true, today: '2026-10-30', time_zone: 'America/Chicago' }),
    { fire: 7, doneToday: true, today: '2026-10-30', timeZone: 'America/Chicago' });
  for (const bad of [null, {}, { fire: -1, done_today: true, today: '2026-10-30' }, { fire: 1.5, done_today: true, today: '2026-10-30' },
    { fire: 1, done_today: 'yes', today: '2026-10-30' }, { fire: 1, done_today: true, today: 'today' }]) assert.equal(parseStreak(bad), null);
  assert.equal(streakHint({ fire: 7, doneToday: true, today: '', timeZone: '' }), 'next quests +70% · 1 XP each');
  assert.equal(streakHint({ fire: 12, doneToday: true, today: '', timeZone: '' }), 'next quests +120% · 2 XP each');
  assert.equal(streakHint({ fire: 7, doneToday: false, today: '', timeZone: '' }), 'First quest today keeps the streak');
  assert.equal(streakHint({ fire: 0, doneToday: false, today: '', timeZone: '' }), 'Finish a quest today to light the fire');
});

test('completion toast shows boosted XP only when the receipt proves the streak rule', () => {
  const id = 'b1111111-1111-4111-8111-111111111111';
  const base = { schema_version: 1, status: 'completed', quest_instance_id: id, quest_completion_confirmed: true,
    reward_status: 'awarded', reward_confirmed: true, reward_awarded_at: '2026-10-30T15:00:00Z' };
  assert.equal(completionFeedback({ ...base, xp_awarded: 2, base_xp: 1, streak_fire: 12, first_of_day: false }, id),
    'Quest completed. +2 XP earned (🔥 12 streak bonus +120%).');
  assert.equal(completionFeedback({ ...base, xp_awarded: 1, base_xp: 1, streak_fire: 7, first_of_day: true }, id),
    'Quest completed. +1 XP earned. 🔥 7 streak kept.');
  assert.match(completionFeedback({ ...base, xp_awarded: 1, base_xp: 1, streak_fire: 7, first_of_day: false }, id), /rounds to \+1 until 🔥 10/);
  for (const forged of [
    { ...base, xp_awarded: 2 },
    { ...base, xp_awarded: 2, base_xp: 1, streak_fire: 12, first_of_day: true },
    { ...base, xp_awarded: 3, base_xp: 1, streak_fire: 12, first_of_day: false },
    { ...base, xp_awarded: 2, base_xp: 2, streak_fire: 12, first_of_day: false },
    { ...base, xp_awarded: 2, base_xp: 1, streak_fire: 7, first_of_day: false },
    { ...base, xp_awarded: 2, base_xp: 1, streak_fire: '12', first_of_day: false },
    { ...base, xp_awarded: 2, base_xp: 1, streak_fire: 12, first_of_day: false, reward_confirmed: false },
  ]) assert.doesNotMatch(completionFeedback(forged, id), /XP earned/);
});

test('migration guards: single locked mint, no client mint, Crypt cap and RLS untouched', () => {
  assert.match(migration, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\('quest-streak:' \|\| p_owner::text, 0\)\)/);
  assert.match(migration, /on conflict \(instance_id\) do nothing/);
  assert.match(migration, /revoke all on function public\._award_quest_xp\(uuid, uuid\) from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.get_quest_streak\(\) to authenticated/);
  assert.doesNotMatch(migration, /row level security|create policy|drop policy|alter policy/i, 'RLS untouched');
  assert.doesNotMatch(migration, /crypt_/i, 'Crypt functions and its XP cap are not redefined');
  assert.doesNotMatch(migration, /earned_armor|get_lifetime_xp|equip_/);
  // Every completion path mints through _award_quest_xp; nothing else inserts into the ledger.
  assert.equal((migration.match(/insert into public\.xp_ledger/g) || []).length, 1);
  assert.equal((migration.match(/public\._award_quest_xp\(auth\.uid\(\), inst\.id\)/g) || []).length, 2);
  assert.match(migration, /check \(base_amount is null or base_amount = 1\)/, 'base XP stays 1 per quest');
  // Rollback restores the old shape.
  assert.match(rollback, /check \(amount = 1\)/);
  assert.match(rollback, /check \(cadence in \('once','daily'\)\)/);
  assert.match(rollback, /drop function if exists public\._award_quest_xp/);
});

test('board UI: fire badge, 5-quest daily board with off-board list, weekly section, 44px targets', () => {
  const board = read('app/(app)/quests/page.tsx');
  const css = read('app/style.css');
  assert.match(board, /className=\{'streak-badge lit'/);
  assert.match(board, /streak\?\.\[quest\.id\]/, 'badge belongs to its quest');
  assert.doesNotMatch(board.slice(board.indexOf('<header className="top board-header"'), board.indexOf('<nav className="tabs')), /streak-badge/, 'no account-wide streak badge');
  assert.match(board, /dailyBoardIds\(user,today,/);
  assert.match(board, /More daily quests \(\{offBoardQuests\.length\}\)/);
  assert.match(board, /still counts: \+1 XP and this quest’s streak/);
  assert.match(board, /weeklyVisible\(user,q\.id,today/);
  assert.match(board, /Weekly · open until Sunday night/);
  assert.match(board, /streakFor&&streakFor\.owner===user/, 'never shows another account’s streak');
  assert.match(css, /\.streak-badge \{[^}]*min-height: 44px/);
  assert.match(css, /\.offboard-toggle \{[^}]*min-height: 44px/);
});
