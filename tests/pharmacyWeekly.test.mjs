/** Weekday weekly quests open at 05:00 local. SQL behavior is in tests/sql/pharmacy_weekly_smoke.sql. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PHARMACY_WEEKLY_DESCRIPTIONS, PHARMACY_WEEKLY_DOMAIN, PHARMACY_WEEKLY_TITLES, PHARMACY_WEEKLY_WEEKDAY, questTitleKey } from '../lib/questAutopilot.ts';
import { gameDayParts, weekStart, weeklyAppearOffset, weeklyVisible } from '../lib/questStreak.ts';
import { todayGlance } from '../lib/homeToday.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const USER = '00000000-0000-0000-0000-00000000f701';
const QUEST = '00000000-0000-0000-0000-00000000f7aa';
const monday = { fixedReveal: true, weekday: 1 };
const wednesday = { fixedReveal: true, weekday: 3 };

test('Monday 04:59 stays in the previous week and 05:00 opens a Monday quest', () => {
  const before = gameDayParts(new Date('2026-11-02T10:59:00Z'), 'America/Chicago');
  const after = gameDayParts(new Date('2026-11-02T11:00:00Z'), 'America/Chicago');
  assert.equal(before.date, '2026-11-01');
  assert.equal(before.isoDow, 7);
  assert.equal(weekStart(before.date), '2026-10-26');
  assert.equal(after.date, '2026-11-02');
  assert.equal(after.minutes, 0);
  assert.equal(after.isoDow, 1);
  assert.equal(weekStart(after.date), '2026-11-02');
  assert.equal(weeklyAppearOffset(USER, QUEST, after.date, monday), 0);
  assert.equal(weeklyVisible(USER, QUEST, after.date, after.minutes, false, monday), true);
  assert.equal(weeklyVisible(USER, QUEST, after.date, after.minutes, false, wednesday), false);
  // Monday 04:59 is still Sunday's game day, after Sunday 05:00, so that weekday stays open.
  assert.equal(weeklyVisible(USER, QUEST, before.date, before.minutes, false, { fixedReveal: true, weekday: 7 }), true);
});

test('Wednesday and both DST Mondays open at 05:00 local, not 04:59', () => {
  const wedBefore = gameDayParts(new Date('2026-11-04T10:59:00Z'), 'America/Chicago');
  const wedAfter = gameDayParts(new Date('2026-11-04T11:00:00Z'), 'America/Chicago');
  assert.equal(weeklyVisible(USER, QUEST, wedBefore.date, wedBefore.minutes, false, wednesday), false, 'Wednesday 04:59 CST');
  assert.equal(weeklyVisible(USER, QUEST, wedAfter.date, wedAfter.minutes, false, wednesday), true, 'Wednesday 05:00 CST');

  const springBefore = gameDayParts(new Date('2026-03-09T09:59:00Z'), 'America/Chicago');
  const springAfter = gameDayParts(new Date('2026-03-09T10:00:00Z'), 'America/Chicago');
  assert.equal(springBefore.date, '2026-03-08');
  assert.equal(springAfter.date, '2026-03-09');
  assert.equal(springAfter.minutes, 0);
  assert.equal(weeklyVisible(USER, QUEST, springAfter.date, springAfter.minutes, false, monday), true, 'spring-forward Monday 05:00 CDT');
  assert.equal(weekStart(springBefore.date), '2026-03-02');
  assert.equal(weekStart(springAfter.date), '2026-03-09');

  const fallBefore = gameDayParts(new Date('2026-11-01T10:59:00Z'), 'America/Chicago');
  const fallAfter = gameDayParts(new Date('2026-11-01T11:00:00Z'), 'America/Chicago');
  assert.equal(weeklyVisible(USER, QUEST, fallBefore.date, fallBefore.minutes, false, { fixedReveal: true, weekday: 7 }), false, 'fall-back Sunday 04:59');
  assert.equal(weeklyVisible(USER, QUEST, fallAfter.date, fallAfter.minutes, false, { fixedReveal: true, weekday: 7 }), true, 'fall-back Sunday 05:00');
  assert.equal(weeklyAppearOffset(USER, QUEST, '2026-10-26'), weeklyAppearOffset(USER, QUEST, '2026-10-26', undefined));
  assert.notEqual(weeklyAppearOffset(USER, QUEST, '2026-11-02', monday), weeklyAppearOffset(USER, QUEST, '2026-11-02'));
});

test('Today glance counts a Monday quest at 05:00 and not in the previous game week', () => {
  const quests = PHARMACY_WEEKLY_TITLES.map((title, index) => ({
    id: `pack-${index}`,
    cadence: 'weekly',
    quest_type: 'scheduled',
    scheduled_for: '2026-11-02',
    fixed_reveal: true,
    weekly_weekday: PHARMACY_WEEKLY_WEEKDAY,
    title,
  }));
  const opened = quests.map((quest) => ({ quest_id: quest.id, due_date: '2026-11-02', status: 'available' }));
  const previous = quests.map((quest) => ({ quest_id: quest.id, due_date: '2026-10-26', status: 'available' }));
  assert.deepEqual(todayGlance(quests, opened, '2026-11-01', { userId: USER, minutesOfDay: 18 * 60 + 59 }), { left: 0, done: 0 });
  assert.deepEqual(todayGlance(quests, previous, '2026-11-01', { userId: USER, minutesOfDay: 18 * 60 + 59 }), { left: 6, done: 0 });
  assert.deepEqual(todayGlance(quests, opened, '2026-11-02', { userId: USER, minutesOfDay: 0 }), { left: 6, done: 0 });
  assert.deepEqual(todayGlance(quests, previous, '2026-11-02', { userId: USER, minutesOfDay: 0 }), { left: 0, done: 0 });
  assert.equal(PHARMACY_WEEKLY_DOMAIN, 'career');
  assert.equal(PHARMACY_WEEKLY_WEEKDAY, 1);
});

test('pack titles are unique by the same key the database uses, so a second add skips them', () => {
  const keys = PHARMACY_WEEKLY_TITLES.map(questTitleKey);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(questTitleKey('  pto   CHECK '), questTitleKey('PTO check'));
  assert.equal(questTitleKey('Supplies   order'), 'supplies order');
  const sql = read('supabase/migrations/20261112011949_pharmacy_weekly_autopilot.sql');
  for (const title of PHARMACY_WEEKLY_TITLES) {
    assert.match(sql, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(sql, /public\.quest_title_key\(title\) = public\.quest_title_key\(v_title\)/);
  assert.match(sql, /where owner_id = p_owner\s+and public\.quest_title_key\(title\)/);
  const copy = read('supabase/migrations/20261112013258_pharmacy_weekly_descriptions.sql');
  const down = read('supabase/rollbacks/20261112013258_pharmacy_weekly_descriptions_down.sql');
  for (const sentence of Object.values(PHARMACY_WEEKLY_DESCRIPTIONS)) {
    assert.match(copy, new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "''")));
  }
  assert.match(copy, /set description = public\.pharmacy_weekly_description\(q\.title\)/);
  assert.match(copy, /description is distinct from public\.pharmacy_weekly_description\(q\.title\)/);
  assert.doesNotMatch(copy, /set title|set id|set domain|set cadence|set xp/i);
  assert.match(down, /drop column if exists description/);
  assert.match(read('app/(app)/quests/page.tsx'), /quest\.description/);
});

test('migration is additive, keeps the 05:00 streak award, and the board exposes one pack button', () => {
  const sql = read('supabase/migrations/20261112011949_pharmacy_weekly_autopilot.sql');
  const down = read('supabase/rollbacks/20261112011949_pharmacy_weekly_autopilot_down.sql');
  const smoke = read('tests/sql/pharmacy_weekly_smoke.sql');
  const board = read('app/(app)/quests/page.tsx');
  const home = read('app/(app)/page.tsx');
  assert.match(sql, /add column if not exists fixed_reveal boolean/);
  assert.match(sql, /add column if not exists weekly_weekday smallint/);
  assert.match(sql, /interval '5 hours'/);
  assert.match(sql, /% 4740/);
  assert.match(sql, /create or replace function public\.ensure_quest_instance/);
  assert.match(sql, /companion_one_shot/);
  assert.match(sql, /fixed_reveal is not true/);
  assert.match(sql, /grant execute on function public\.apply_pharmacy_weekly_pack\(\) to authenticated/);
  assert.match(sql, /grant execute on function public\.apply_pharmacy_weekly_pack_for_user\(uuid\) to service_role/);
  assert.doesNotMatch(sql, /create or replace function public\._award|function public\.quest_streak_xp/);
  assert.doesNotMatch(sql, /\bxp\b/i);
  assert.doesNotMatch(sql, /drop table|disable row level security/i);
  assert.doesNotMatch(sql, /\b(patient|mrn|diagnosis|prescription|hipaa)\b/i);
  assert.match(down, /% 4740/);
  assert.match(down, /drop column if exists fixed_reveal/);
  assert.match(down, /drop column if exists weekly_weekday/);
  assert.match(down, /companion_one_shot/);
  assert.doesNotMatch(down, /fixed_reveal is not true/);
  assert.match(smoke, /pharmacy weekly smoke passed/);
  assert.match(smoke, /Monday 04:59 does not open this week/);
  assert.match(smoke, /Monday 05:00 CST opens/);
  assert.match(smoke, /one row per quest per week/);
  assert.match(smoke, /second pack adds nothing/);
  assert.match(smoke, /second complete awards 0/);
  assert.match(smoke, /no companion bonus/);
  assert.doesNotMatch(smoke, /\b(patient name|mrn|diagnosis|hipaa)\b/i);
  assert.match(board, /Pharmacy weekly pack/);
  assert.match(board, /apply_pharmacy_weekly_pack/);
  assert.match(board, /PHARMACY_WEEKLY_TITLES\.join/);
  assert.match(board, /Weekly · open until Monday 5:00 AM/);
  assert.match(board, /fixed_reveal,weekly_weekday/);
  assert.doesNotMatch(board, /quest_board_v3_ensure_instances/);
  assert.match(home, /fixed_reveal,weekly_weekday/);
  assert.doesNotMatch(home, /ensure_quest_instance|apply_pharmacy_weekly_pack/);
});
