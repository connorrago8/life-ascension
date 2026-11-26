import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { prioritizeQuests, questCategory } from '../lib/ascension/board.ts';
import { LIGHTS_OUT_BASE_XP, LIGHTS_OUT_STREAK_BONUS_XP, LIGHTS_OUT_TITLE, PAYDAY_TITLE } from '../lib/ascension/config.ts';
import { claimLightsOut, healthGameDay, healthNightAllowed, healthRecordWindow, lightsOutWeekLabel, lightsOutXp, priorLightsOutStreak, rollingLightsOutCount } from '../lib/ascension/lightsOut.ts';
import { BLANK_MEAL, mealIsLogged } from '../lib/ascension/meals.ts';
import { isFinanceDecision, isPayday, paydayCreditVariesByDecision, paydayDates } from '../lib/ascension/payday.ts';
import { SCHEDULE_QUEST_LABEL, parseQuestPrefill } from '../lib/ascension/prefill.ts';
import { gameDayParts } from '../lib/questStreak.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('lights out uses its own 5 XP config at the 5 AM boundary', () => {
  assert.equal(LIGHTS_OUT_BASE_XP, 5);
  assert.equal(LIGHTS_OUT_STREAK_BONUS_XP, 1);
  assert.equal(lightsOutXp(0), 5);
  assert.equal(lightsOutXp(3), 8);
  const winterMidnight = new Date('2026-11-26T06:00:00Z');
  const winterBefore = new Date('2026-11-26T10:59:00Z');
  const winterAt = new Date('2026-11-26T11:00:00Z');
  assert.equal(healthGameDay(winterMidnight), gameDayParts(winterMidnight).date);
  assert.equal(healthGameDay(winterMidnight), healthGameDay(winterBefore));
  assert.notEqual(healthGameDay(winterBefore), healthGameDay(winterAt));
  assert.deepEqual(healthRecordWindow(healthGameDay(winterBefore)), [
    healthGameDay(winterBefore),
    '2026-11-24',
    '2026-11-23',
  ]);
  assert.equal(healthNightAllowed('2026-11-25', healthGameDay(winterBefore)), true);
  assert.equal(healthNightAllowed('2026-11-22', healthGameDay(winterBefore)), false);
  assert.equal(healthNightAllowed(healthGameDay(winterAt), healthGameDay(winterAt)), true);

  const summerMidnight = new Date('2026-03-14T05:00:00Z');
  const summerBefore = new Date('2026-03-14T09:59:00Z');
  const summerAt = new Date('2026-03-14T10:00:00Z');
  assert.equal(healthGameDay(summerMidnight), healthGameDay(summerBefore));
  assert.equal(healthGameDay(summerAt), '2026-03-14');
  assert.equal(healthNightAllowed('2026-03-13', healthGameDay(summerBefore)), true);
  assert.equal(healthNightAllowed('2026-03-14', healthGameDay(summerBefore)), false);
});

test('a second lights-out create for the same night pays no XP', () => {
  const first = claimLightsOut([], '2026-11-25', 'request-a');
  assert.equal(first.already, false);
  assert.equal(first.xpAwarded, 5);
  const raced = claimLightsOut(first.rows, '2026-11-25', 'request-b');
  assert.equal(raced.already, true);
  assert.equal(raced.xpAwarded, 0);
  assert.equal(raced.rows.length, 1);
  const sameRequest = claimLightsOut(first.rows, '2026-11-24', 'request-a');
  assert.equal(sameRequest.already, true);
  assert.equal(sameRequest.xpAwarded, 0);
  const next = claimLightsOut(first.rows, '2026-11-26', 'request-c');
  assert.equal(next.xpAwarded, 6);
  assert.equal(priorLightsOutStreak(['2026-11-25', '2026-11-24'], '2026-11-26'), 2);
  assert.equal(rollingLightsOutCount(['2026-11-20', '2026-11-25', '2026-11-18'], '2026-11-25'), 2);
  assert.match(lightsOutWeekLabel(2), /2 of 7 nights · Goal 6/);
});

test('a blank meal stays unlogged and explicit flags may be null', () => {
  assert.equal(mealIsLogged(BLANK_MEAL), false);
  assert.equal(mealIsLogged({ balanced: null, protein: null, produce: null, delivery: null }), false);
  assert.equal(mealIsLogged({ balanced: false, protein: null, produce: null, delivery: null }), true);
  assert.equal(mealIsLogged({ balanced: null, protein: true, produce: null, delivery: null }), true);
});

test('payday checks are the biweekly list and every decision shares one credit path', () => {
  const dates = paydayDates();
  assert.equal(dates[0], '2026-12-03');
  assert.equal(dates.at(-1), '2027-05-20');
  assert.equal(dates.length, 13);
  assert.equal(isPayday('2027-04-08'), true);
  assert.equal(isPayday('2026-12-04'), false);
  assert.equal(isFinanceDecision('minimum_only'), true);
  assert.equal(isFinanceDecision('extra_payment'), true);
  assert.equal(isFinanceDecision('partial'), false);
  assert.equal(paydayCreditVariesByDecision(), false);
});

test('prefilled quest links schedule on home and the quest board', () => {
  const home = read('app/(app)/page.tsx');
  const quests = read('app/(app)/quests/page.tsx');
  const banner = read('components/ascension/QuestScheduleBanner.tsx');
  assert.match(home, /QuestScheduleBanner/);
  assert.match(quests, /QuestScheduleBanner/);
  assert.match(banner, /SCHEDULE_QUEST_LABEL/);
  assert.equal(SCHEDULE_QUEST_LABEL, 'Schedule quest');
  assert.equal(parseQuestPrefill(new URLSearchParams('quest=Fold%20laundry&domain=home&cadence=once'), '2026-11-26')?.title, 'Fold laundry');
  assert.equal(parseQuestPrefill(new URLSearchParams('quest='), '2026-11-26'), null);
  assert.match(banner, /create_scheduled_quest/);
  assert.doesNotMatch(banner, /set_quest_instance_status/);
});

test('the board keeps overdue and due-today quests first, two per section', () => {
  const rows = [
    { title: 'Later', due: '2026-12-01', status: 'available', domain: 'home' },
    { title: 'Today', due: '2026-11-26', status: 'available', domain: 'home' },
    { title: 'Overdue', due: '2026-11-20', status: 'available', domain: 'home' },
    { title: 'Done', due: '2026-11-19', status: 'completed', domain: 'home' },
  ];
  assert.deepEqual(prioritizeQuests(rows, '2026-11-26', 2).map((row) => row.title), ['Overdue', 'Today']);
  assert.equal(questCategory({ title: LIGHTS_OUT_TITLE, domain: 'home' }), 'health');
  assert.equal(questCategory({ title: PAYDAY_TITLE, domain: 'personal_growth' }), 'finance');
  assert.equal(questCategory({ title: 'Tech schedule', domain: 'career' }), 'pharmacy');
  assert.equal(questCategory({ title: 'A walk', domain: 'home', couple: true }), 'companionship');
  assert.equal(questCategory({ title: 'Read', domain: 'personal_growth' }), 'personal');
});

test('finance schema, API, and UI have no money or amount fields', () => {
  const sql = read('supabase/migrations/202611260010_health_finance.sql');
  const financeUi = [
    read('components/ascension/FinancePanel.tsx'),
    read('app/(app)/finance/page.tsx'),
    read('lib/ascension/payday.ts'),
    read('lib/ascension/config.ts'),
  ].join('\n');
  for (const table of ['finance_payday_checks', 'finance_followups']) {
    const block = sql.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\);`));
    assert.ok(block, table);
    assert.doesNotMatch(block[0], /\b(numeric|money|decimal|amount|balance|cents|dollar|currency)\b/i);
  }
  assert.match(sql, /decision in \('minimum_only', 'review_needed', 'extra_payment'\)/);
  assert.doesNotMatch(financeUi, /\b(amount|amounts|balance|balances|cents|dollar|dollars|usd|currency|account_number|account_name|routing)\b/i);
  assert.doesNotMatch(financeUi, /\$\d/);
  assert.match(sql, /select 5 \+ 1 \* greatest\(p_prior, 0\)/);
  assert.match(read('docs/health-finance.md'), /LIGHTS_OUT_BASE_XP = 5/);
});
