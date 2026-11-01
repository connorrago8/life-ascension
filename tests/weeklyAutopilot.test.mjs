import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localToday } from '../lib/playerTimeZone.ts';
import { PHARMACY_WEEKLY_DOMAIN, PHARMACY_WEEKLY_TITLES, PHARMACY_WEEKLY_WEEKDAY, questsDueForInstance } from '../lib/questAutopilot.ts';
import { localParts, weekStart, weeklyAppearOffset, weeklyVisible } from '../lib/questStreak.ts';
import { todayGlance } from '../lib/homeToday.ts';
import { questDay } from '../src/lib/quest-board-v3.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const USER = '00000000-0000-0000-0000-00000000f101';
const RANDOM = '00000000-0000-0000-0000-00000000d0a1';

test('fixed Monday reveal is open at local midnight and the 05:00 quest day is a different date', () => {
  const sundayLate = new Date('2026-11-02T05:59:00Z');
  const mondayMidnight = new Date('2026-11-02T06:00:00Z');
  const sun = localParts(sundayLate, 'America/Chicago');
  const mon = localParts(mondayMidnight, 'America/Chicago');
  assert.equal(sun.date, '2026-11-01');
  assert.equal(sun.minutes, 23 * 60 + 59);
  assert.equal(mon.date, '2026-11-02');
  assert.equal(mon.minutes, 0);
  assert.equal(weekStart(sun.date), '2026-10-26');
  assert.equal(weekStart(mon.date), '2026-11-02');
  assert.equal(localToday(mondayMidnight, 'America/Chicago'), '2026-11-02');
  assert.equal(questDay(mondayMidnight), '2026-11-01');
  assert.equal(weeklyAppearOffset(USER, RANDOM, '2026-11-02', { fixedReveal: true, weekday: 1 }), 0);
  assert.equal(weeklyVisible(USER, RANDOM, mon.date, mon.minutes, { fixedReveal: true, weekday: 1 }), true);
  assert.equal(weeklyVisible(USER, RANDOM, '2026-11-02', 0), false, 'unflagged weekly keeps its seeded reveal');
  assert.equal(weeklyAppearOffset('00000000-0000-0000-0000-00000000d001', RANDOM, '2026-10-26'), 3587);
});

test('Home glance shows this week’s fixed Monday quests and does not carry them into next week', () => {
  const quests = PHARMACY_WEEKLY_TITLES.map((title, index) => ({
    id: `pack-${index}`,
    cadence: 'weekly',
    quest_type: 'scheduled',
    scheduled_for: '2026-11-02',
    fixed_reveal: true,
    weekly_weekday: PHARMACY_WEEKLY_WEEKDAY,
    title,
  }));
  const board = { userId: USER, minutesOfDay: 0 };
  const nextWeek = quests.map((quest) => ({ quest_id: quest.id, due_date: '2026-11-02', status: 'available' }));
  const thisWeek = quests.map((quest) => ({ quest_id: quest.id, due_date: '2026-10-26', status: 'available' }));
  assert.deepEqual(todayGlance(quests, nextWeek, '2026-11-01', { userId: USER, minutesOfDay: 23 * 60 + 59 }), { left: 0, done: 0 });
  assert.deepEqual(todayGlance(quests, thisWeek, '2026-11-01', { userId: USER, minutesOfDay: 23 * 60 + 59 }), { left: 6, done: 0 });
  assert.deepEqual(todayGlance(quests, nextWeek, '2026-11-02', board), { left: 6, done: 0 });
  assert.deepEqual(todayGlance(quests, thisWeek, '2026-11-02', board), { left: 0, done: 0 });
  assert.equal(PHARMACY_WEEKLY_DOMAIN, 'career');
  assert.deepEqual(questsDueForInstance(quests, '2026-11-02').length, 6);
  assert.deepEqual(questsDueForInstance([{ quest_type: 'goal', scheduled_for: null }, { quest_type: 'scheduled', scheduled_for: '2026-11-03' }], '2026-11-02').length, 0);
});

test('Home and Quests ensure instances on the player’s local date and do not use the 05:00 bulk path', () => {
  const home = read('app/(app)/page.tsx');
  const board = read('app/(app)/quests/page.tsx');
  const manage = read('app/(app)/quests/manage/page.tsx');
  assert.match(home, /ensure_quest_instance/);
  assert.match(home, /questsDueForInstance/);
  assert.match(home, /localToday/);
  assert.doesNotMatch(home, /quest_board_v3_ensure_instances|questDay\(/);
  assert.doesNotMatch(home, /set_quest_instance_status|equip_earned_armor|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  assert.match(board, /ensure_quest_instance/);
  assert.match(board, /quest\.quest_type!=='goal'&&\(!quest\.scheduled_for\|\|quest\.scheduled_for<=todayLocal\(\)\)/);
  assert.doesNotMatch(board, /quest_board_v3_ensure_instances/);
  assert.match(board, /Quest packs/);
  assert.match(board, /Add Pharmacy weekly/);
  assert.match(board, /apply_pharmacy_weekly_pack/);
  assert.match(board, /create_weekly_autopilot_quest/);
  assert.match(board, /No XP penalty for missed days/);
  assert.doesNotMatch(board, /weekly penalty|penalty for a missed week|missed weekly/i);
  assert.match(manage, /rename_quest/);
  assert.match(manage, /archive_quest/);
  assert.match(board, /PHARMACY_WEEKLY_TITLES\.map/);
  const pack = read('lib/questAutopilot.ts');
  for (const title of PHARMACY_WEEKLY_TITLES) {
    assert.match(pack, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('migration is additive, keeps random reveal, and excludes pack quests from companion dedupe', () => {
  const sql = read('supabase/migrations/20261101170000_weekly_autopilot.sql');
  const smoke = read('tests/sql/weekly_autopilot_smoke.sql');
  assert.match(sql, /add column if not exists fixed_reveal boolean/);
  assert.match(sql, /add column if not exists weekly_weekday smallint/);
  assert.match(sql, /create or replace function public\.ensure_quest_instance/);
  assert.match(sql, /create or replace function public\.quest_weekly_appears_at/);
  assert.match(sql, /create or replace function public\.quest_companion_assign_to_owner/);
  assert.match(sql, /fixed_reveal is not true/);
  assert.match(sql, /cadence='weekly' and domain='career'/);
  assert.match(sql, /grant execute on function public\.apply_pharmacy_weekly_pack_for_user\(uuid\) to service_role/);
  assert.doesNotMatch(sql, /quest_board_v3_ensure_instances|interval '5 hours'/);
  assert.doesNotMatch(sql, /drop table|disable row level security/i);
  assert.doesNotMatch(sql, /\b(patient|mrn|diagnosis|prescription|hipaa)\b/i);
  assert.doesNotMatch(smoke, /\b(patient name|mrn|diagnosis|hipaa)\b/i);
  for (const title of PHARMACY_WEEKLY_TITLES) assert.match(sql, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(sql, /'career', 1/);
  assert.match(smoke, /weekly autopilot smoke passed/);
  assert.match(smoke, /one row per quest per week/);
  assert.match(smoke, /second complete awards 0/);
  assert.match(smoke, /Sunday 23:59 is the previous week/);
  assert.match(smoke, /Monday 00:00 starts the new week/);
  assert.match(smoke, /remove keeps the \+1 XP/);
  assert.match(smoke, /companion does not attach to the weekly work quest/);
});
