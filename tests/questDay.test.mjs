import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DAILY_ROLLOVER_HOUR,
  QUEST_TIME_ZONE,
  calendarDate,
  nextQuestDayStart,
  questActionDate,
  questDay,
} from '../lib/questDay.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function shift(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function expectDay(iso, calendar, day, timeZone = QUEST_TIME_ZONE) {
  const instant = new Date(iso);
  assert.equal(calendarDate(instant, timeZone), calendar, `${iso} calendar`);
  assert.equal(questDay(instant, timeZone), day, `${iso} quest day`);
  assert.ok(day >= shift(calendar, -1) && day <= calendar, `${iso} stays inside the server window`);
  assert.equal(questActionDate('daily', instant, timeZone), day);
  assert.equal(questActionDate('once', instant, timeZone), calendar);
}

test('Chicago quest day rolls at 05:00 and not at midnight', () => {
  assert.equal(QUEST_TIME_ZONE, 'America/Chicago');
  assert.equal(DAILY_ROLLOVER_HOUR, 5);

  // Summer, CDT (UTC-5). 05:00 local is 10:00Z. A fixed UTC-6 offset would still say 04:00.
  expectDay('2026-06-15T05:00:00Z', '2026-06-15', '2026-06-14');
  expectDay('2026-06-15T09:59:00Z', '2026-06-15', '2026-06-14');
  expectDay('2026-06-15T09:59:59Z', '2026-06-15', '2026-06-14');
  expectDay('2026-06-15T10:00:00Z', '2026-06-15', '2026-06-15');
  expectDay('2026-07-15T10:00:00Z', '2026-07-15', '2026-07-15');

  // Winter, CST (UTC-6).
  expectDay('2026-01-15T06:00:00Z', '2026-01-15', '2026-01-14');
  expectDay('2026-01-15T10:59:00Z', '2026-01-15', '2026-01-14');
  expectDay('2026-01-15T11:00:00Z', '2026-01-15', '2026-01-15');
});

test('year and month boundaries borrow the previous civil date before 05:00', () => {
  expectDay('2026-01-01T06:00:00Z', '2026-01-01', '2025-12-31');
  expectDay('2026-01-01T10:59:00Z', '2026-01-01', '2025-12-31');
  expectDay('2026-01-01T11:00:00Z', '2026-01-01', '2026-01-01');
  expectDay('2026-12-31T10:59:00Z', '2026-12-31', '2026-12-30');
  expectDay('2026-12-31T11:00:00Z', '2026-12-31', '2026-12-31');
  expectDay('2027-01-01T10:59:00Z', '2027-01-01', '2026-12-31');
  expectDay('2027-01-01T11:00:00Z', '2027-01-01', '2027-01-01');

  // 2026 is not a leap year. March 1 is still CST.
  expectDay('2026-03-01T10:59:00Z', '2026-03-01', '2026-02-28');
  expectDay('2026-03-01T11:00:00Z', '2026-03-01', '2026-03-01');
  // 2024 is a leap year. March 1 is still CST (DST began March 10).
  expectDay('2024-03-01T10:59:00Z', '2024-03-01', '2024-02-29');
  expectDay('2024-03-01T11:00:00Z', '2024-03-01', '2024-03-01');

  // May 1 is CDT.
  expectDay('2026-05-01T09:59:00Z', '2026-05-01', '2026-04-30');
  expectDay('2026-05-01T10:00:00Z', '2026-05-01', '2026-05-01');
});

test('America/Chicago spring-forward morning still rolls at 05:00', () => {
  // 2026-03-08: 02:00 CST becomes 03:00 CDT. 05:00 CDT is 10:00Z.
  // Subtracting five absolute hours from that instant lands on March 7.
  expectDay('2026-03-08T06:00:00Z', '2026-03-08', '2026-03-07');
  expectDay('2026-03-08T07:59:00Z', '2026-03-08', '2026-03-07');
  expectDay('2026-03-08T08:00:00Z', '2026-03-08', '2026-03-07');
  expectDay('2026-03-08T09:59:00Z', '2026-03-08', '2026-03-07');
  expectDay('2026-03-08T10:00:00Z', '2026-03-08', '2026-03-08');
  const absolute = calendarDate(new Date('2026-03-08T05:00:00Z'));
  assert.equal(absolute, '2026-03-07');
  assert.notEqual(questDay(new Date('2026-03-08T10:00:00Z')), absolute);
});

test('America/Chicago fall-back morning keeps both 01:30 occurrences on the prior quest day', () => {
  // 2026-11-01: 02:00 CDT repeats as 01:00 CST. Both 01:30s are before 05:00.
  expectDay('2026-11-01T05:00:00Z', '2026-11-01', '2026-10-31');
  expectDay('2026-11-01T06:30:00Z', '2026-11-01', '2026-10-31');
  expectDay('2026-11-01T07:30:00Z', '2026-11-01', '2026-10-31');
  expectDay('2026-11-01T10:59:00Z', '2026-11-01', '2026-10-31');
  expectDay('2026-11-01T11:00:00Z', '2026-11-01', '2026-11-01');
});

test('the same instant can be a different quest day in another IANA zone', () => {
  const instant = new Date('2026-06-15T09:30:00Z');
  assert.equal(questDay(instant, 'America/Chicago'), '2026-06-14');
  assert.equal(calendarDate(instant, 'America/Chicago'), '2026-06-15');
  assert.equal(questDay(instant, 'America/New_York'), '2026-06-15');
  assert.equal(calendarDate(instant, 'America/New_York'), '2026-06-15');
  assert.equal(questDay(instant, 'America/Los_Angeles'), '2026-06-14');
  assert.equal(calendarDate(instant, 'America/Los_Angeles'), '2026-06-15');
});

test('next quest-day start is the following 05:00 civil time, including both DST transitions', () => {
  const at = (iso) => nextQuestDayStart(new Date(iso)).toISOString();
  assert.equal(at('2026-06-15T09:59:00Z'), '2026-06-15T10:00:00.000Z');
  assert.equal(at('2026-06-15T10:00:00Z'), '2026-06-16T10:00:00.000Z');
  assert.equal(at('2026-01-15T06:00:00Z'), '2026-01-15T11:00:00.000Z');
  assert.equal(at('2026-01-15T11:00:00Z'), '2026-01-16T11:00:00.000Z');
  assert.equal(at('2026-01-01T10:59:00Z'), '2026-01-01T11:00:00.000Z');
  assert.equal(at('2025-12-31T11:00:00Z'), '2026-01-01T11:00:00.000Z');
  assert.equal(at('2026-03-07T11:00:00Z'), '2026-03-08T10:00:00.000Z');
  assert.equal(at('2026-03-08T09:59:00Z'), '2026-03-08T10:00:00.000Z');
  assert.equal(at('2026-03-08T10:00:00Z'), '2026-03-09T10:00:00.000Z');
  assert.equal(at('2026-11-01T06:30:00Z'), '2026-11-01T11:00:00.000Z');
  assert.equal(at('2026-11-01T07:30:00Z'), '2026-11-01T11:00:00.000Z');
  assert.equal(at('2026-11-01T10:59:00Z'), '2026-11-01T11:00:00.000Z');
  assert.equal(at('2026-11-01T11:00:00Z'), '2026-11-02T11:00:00.000Z');
});

test('a quest day sent to the server is yesterday or today, never outside the 2-day window', () => {
  for (const startIso of ['2025-12-31T00:00:00Z', '2026-03-07T00:00:00Z', '2026-10-31T00:00:00Z']) {
    const start = Date.parse(startIso);
    for (let step = 0; step < 72 * 2; step += 1) {
      const instant = new Date(start + step * 30 * 60 * 1000);
      const serverToday = calendarDate(instant);
      const day = questDay(instant);
      assert.ok(day === serverToday || day === shift(serverToday, -1), `${instant.toISOString()} ${day} vs ${serverToday}`);
      assert.ok(day >= shift(serverToday, -2) && day <= serverToday);
    }
  }
});

test('the live clock uses America/Chicago and stays on the server calendar date or the day before', () => {
  const now = new Date();
  const serverToday = calendarDate(now);
  const day = questDay(now);
  assert.match(serverToday, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(day === serverToday || day === shift(serverToday, -1));
  assert.equal(questActionDate('daily', now), day);
  assert.equal(questActionDate('once', now), serverToday);
});

test('daily date call sites use the helper and do not keep a midnight formatter', () => {
  const sources = [];
  for (const dir of ['app', 'lib']) {
    walk(join(root, dir), sources);
  }
  const forbidden = [
    /Intl\.DateTimeFormat/,
    /timeZone\s*:/,
    /en-CA/,
    /\btodayLocal\b/,
    /\bchicagoToday\b/,
  ];
  for (const path of sources) {
    if (path.endsWith(`${join('lib', 'questDay.ts')}`)) continue;
    const source = readFileSync(path, 'utf8');
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${path} matches ${pattern}`);
    }
  }

  const page = readFileSync(join(root, 'app/page.tsx'), 'utf8');
  const manage = readFileSync(join(root, 'app/quests/manage/page.tsx'), 'utf8');
  const route = readFileSync(join(root, 'app/api/mcp/route.ts'), 'utf8');
  const tools = readFileSync(join(root, 'lib/mcpTools.ts'), 'utf8');
  assert.match(page, /from '\.\.\/lib\/questDay'/);
  assert.match(page, /questActionDate\(quest\.cadence,now\)/);
  assert.match(page, /ensure_quest_instance',\{p_quest_id:quest\.id,p_date\}/);
  assert.equal(page.split('ensure_quest_instance').length - 1, 1);
  assert.match(page, /questActionDate\(questType==='goal'\?'once':cadence\)/);
  assert.match(page, /create_scheduled_quest',\{p_title:title\.trim\(\),p_domain:domain,p_cadence:cadence,p_date,p_quest_type:questType\}/);
  assert.match(page, /i\.due_date===day/);
  assert.match(page, /lte\('due_date',calendarToday\)/);
  assert.match(page, /const anchor=quest\.cadence==='daily'\?day:today/);
  assert.match(page, /set_quest_instance_status',\{p_instance_id:id,p_action:action\}/);
  assert.doesNotMatch(page, /set_quest_instance_status'[^)]*p_date/);

  assert.match(manage, /from '\.\.\/\.\.\/\.\.\/lib\/questDay'/);
  assert.match(manage, /questActionDate\(q\.cadence\)/);
  assert.match(manage, /reschedule_quest',\{p_quest_id:q\.id,p_date:date\}/);

  assert.match(route, /from '\.\.\/\.\.\/\.\.\/lib\/questDay'/);
  assert.match(route, /today: calendarDate\(now\)/);
  assert.match(route, /questDay: questDay\(now\)/);

  assert.match(tools, /input\.questDay/);
  assert.match(tools, /args\.cadence === 'daily' \? activeDailyDate\(input\)/);
  assert.match(tools, /questRow\.cadence === 'daily'/);
  assert.match(tools, /ensure_quest_instance', 'ensure_quest_instance_as_user', \{\s*p_quest_id: questRow\.id,\s*p_date: date,/);
});

test('SQL still keys daily windows to Chicago midnight and cannot double an instance or its XP', () => {
  const migrations = readdirSync(join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort();
  assert.deepEqual(migrations, [
    '202610230001_core.sql',
    '202610230002_api_keys_progress.sql',
    '202610230003_future_quest_scheduling.sql',
    '202610230004_lifetime_xp.sql',
    '202610240005_api_key_user_context.sql',
    '202610240006_quest_edit_archive.sql',
    '202610240007_daily_late_window.sql',
  ]);
  const core = readFileSync(join(root, 'supabase/migrations/202610230001_core.sql'), 'utf8');
  const wrappers = readFileSync(join(root, 'supabase/migrations/202610240005_api_key_user_context.sql'), 'utf8');
  const edit = readFileSync(join(root, 'supabase/migrations/202610240006_quest_edit_archive.sql'), 'utf8');
  const late = readFileSync(join(root, 'supabase/migrations/202610240007_daily_late_window.sql'), 'utf8');
  for (const sql of [core, wrappers, edit, late]) {
    assert.doesNotMatch(sql, /interval '5 hours'/);
  }
  assert.match(core, /unique\(quest_id,due_date\)/);
  assert.match(core, /instance_id uuid not null unique/);
  assert.match(late, /ensure_quest_instance\(p_quest_id uuid,p_date date default \(\(now\(\) at time zone 'America\/Chicago'\)::date\)\)/);
  assert.match(late, /if q\.cadence = 'daily' and p_date < v_today - 2 then/);
  assert.match(late, /on conflict\(quest_id,due_date\) do update set due_date=excluded\.due_date returning id into v_id/);
  assert.match(late, /function public\.set_quest_instance_status\(p_instance_id uuid,p_action text\)/);
  assert.match(late, /if inst\.status='completed' then return 'completed'; end if/);
  assert.match(late, /if q\.cadence='daily' and inst\.due_date < v_today - 2 then/);
  assert.match(late, /on conflict\(instance_id\) do nothing/);
  assert.match(wrappers, /return public\.ensure_quest_instance\(p_quest_id, p_date\)/);
  assert.match(wrappers, /ensure_quest_instance_as_user\(\s*p_user_id uuid,\s*p_quest_id uuid,\s*p_date date\s*\)/);
  assert.match(edit, /due_date=v_today and status='available'/);
});

function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) acc.push(path);
  }
  return acc;
}
