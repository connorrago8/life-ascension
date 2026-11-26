import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { prioritizeQuests, questCategory } from '../lib/ascension/board.ts';
import { LIGHTS_OUT_BASE_XP, LIGHTS_OUT_STREAK_BONUS_MAX_XP, LIGHTS_OUT_STREAK_BONUS_XP, LIGHTS_OUT_TITLE, PAYDAY_TITLE } from '../lib/ascension/config.ts';
import { claimLightsOut, healthGameDay, healthNightAllowed, healthRecordWindow, lightsOutWeekLabel, lightsOutXp, priorLightsOutStreak, rollingLightsOutCount } from '../lib/ascension/lightsOut.ts';
import { BLANK_MEAL, mealIsLogged } from '../lib/ascension/meals.ts';
import { isFinanceDecision, isPayday, paydayCreditVariesByDecision, paydayDates } from '../lib/ascension/payday.ts';
import { SCHEDULE_QUEST_LABEL, parseQuestPrefill } from '../lib/ascension/prefill.ts';
import { TemplateBoard, templateRowModels } from '../lib/ascension/templateView.ts';
import {
  HEALTH_FOLLOW_UP_UNLOCK,
  allTrackTemplates,
  canStartTemplate,
  finishPaysOnce,
  healthFollowUpsUnlocked,
} from '../lib/ascension/templates.ts';
import { shiftDate } from '../lib/ascension/dates.ts';
import { weekStart } from '../lib/questStreak.ts';
import { gameDayParts } from '../lib/questStreak.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('lights out uses its own 5 XP config at the 5 AM boundary', () => {
  assert.equal(LIGHTS_OUT_BASE_XP, 5);
  assert.equal(LIGHTS_OUT_STREAK_BONUS_XP, 1);
  assert.equal(LIGHTS_OUT_STREAK_BONUS_MAX_XP, 5);
  assert.deepEqual([0, 1, 5, 6, 60].map(lightsOutXp), [5, 6, 10, 10, 10]);
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
  const transactions = read('supabase/migrations/202611260040_finance_transactions.sql');
  const financeUi = [
    read('components/ascension/FinancePanel.tsx'),
    read('components/ascension/TrackTemplates.tsx'),
    read('app/(app)/finance/page.tsx'),
    read('lib/ascension/payday.ts'),
    read('lib/ascension/config.ts'),
    read('lib/ascension/templates.ts'),
    read('lib/ascension/templateView.ts'),
    read('supabase/migrations/202611260020_track_templates.sql'),
  ].join('\n');
  for (const table of ['finance_payday_checks', 'finance_followups']) {
    const block = sql.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\);`));
    assert.ok(block, table);
    assert.doesNotMatch(block[0], /\b(numeric|money|decimal|amount|balance|cents|dollar|currency)\b/i);
  }
  const moneyTables = [...transactions.matchAll(/create table public\.(\w+) \([\s\S]*?\);/g)]
    .filter((match) => /\b(numeric|money|amount)\b/i.test(match[0]))
    .map((match) => match[1]);
  assert.deepEqual(moneyTables, ['finance_transactions']);
  assert.match(transactions, /finance_transactions_owner_read/);
  assert.match(transactions, /\(select auth\.uid\(\)\) = owner_id/);
  assert.match(sql, /decision in \('minimum_only', 'review_needed', 'extra_payment'\)/);
  assert.doesNotMatch(financeUi, /\b(amount|amounts|balance|balances|cents|dollar|dollars|usd|currency|account_number|account_name|routing)\b/i);
  assert.doesNotMatch(financeUi, /\$\d/);
  const templates = read('supabase/migrations/202611260020_track_templates.sql');
  const stateTable = templates.match(/create table public\.track_template_states \([\s\S]*?\);/);
  assert.ok(stateTable);
  assert.doesNotMatch(stateTable[0], /\b(numeric|money|decimal|amount|balance|cents|dollar|currency)\b/i);
  const sealed = [
    'app/api/companion/draft/route.ts',
    'app/api/companion/proof/route.ts',
    'app/api/mcp/route.ts',
    'app/api/widget/today/route.ts',
    'lib/mcpTools.ts',
    'components/couple/SundayRecapCard.tsx',
    'lib/status/pill.ts',
    'lib/questStreak.ts',
    'components/quests/PersonalQuestBoard.tsx',
    'components/quests/TogetherQuestPanel.tsx',
  ].map((path) => read(path)).join('\n');
  assert.doesNotMatch(sealed, /finance_transactions|monarch_mcp|finance_week_summary|account_label|la_fin_/);
  assert.match(sql, /select 5 \+ 1 \* greatest\(p_prior, 0\)/);
  const cap = read('supabase/migrations/202611260030_lights_out_bonus_cap.sql');
  assert.match(cap, /least\(1 \* greatest\(p_prior, 0\), 5\)/);
  assert.match(cap, /LIGHTS_OUT_STREAK_BONUS_MAX_XP = 5/);
  assert.match(read('docs/health-finance.md'), /LIGHTS_OUT_BASE_XP = 5/);
  assert.doesNotMatch(read('components/ascension/TrackTemplates.tsx'), /<textarea|<input/);
});

function weekDates(monday, count) {
  return Array.from({ length: count }, (_, index) => shiftDate(monday, index));
}

test('all 20 health and finance templates render without free text', () => {
  assert.equal(allTrackTemplates().length, 20);
  const rows = [
    ...templateRowModels('health', [], false),
    ...templateRowModels('finance', [], true),
  ];
  const html = renderToStaticMarkup(createElement(TemplateBoard, { rows }));
  for (const template of allTrackTemplates()) {
    const escaped = template.title.replaceAll("'", '&#x27;');
    assert.ok(html.includes(template.title) || html.includes(escaped), template.title);
  }
  assert.match(html, /Unlocks later/);
  assert.match(html, /Due/);
  assert.doesNotMatch(html, /<textarea|<input/);
  assert.match(html, /Credit when the session is done, not when it is scheduled/);
  assert.match(html, /Do this in your private finance workflow, then mark it done/);
});

test('health follow-ups unlock after two straight game weeks at the configured goal', () => {
  assert.equal(HEALTH_FOLLOW_UP_UNLOCK.nightsRequired, 6);
  assert.equal(HEALTH_FOLLOW_UP_UNLOCK.nightsInWeek, 7);
  assert.equal(HEALTH_FOLLOW_UP_UNLOCK.straightWeeks, 2);
  const today = '2026-11-25';
  const thisWeek = weekStart(today);
  const previous = shiftDate(thisWeek, -7);
  const before = shiftDate(thisWeek, -14);
  const enough = [...weekDates(previous, 6), ...weekDates(before, 6)];
  assert.equal(healthFollowUpsUnlocked(enough, today), true);
  assert.equal(healthFollowUpsUnlocked(weekDates(previous, 6), today), false);
  assert.equal(healthFollowUpsUnlocked([...weekDates(previous, 5), ...weekDates(before, 7)], today), false);
  assert.equal(canStartTemplate('health', 'easy_walk', [], false), false);
  assert.equal(canStartTemplate('health', 'easy_walk', [], true), true);
  assert.equal(canStartTemplate('health', 'protein_meal', [{ id: 'easy_walk', status: 'in_progress' }], true), false);
  assert.equal(canStartTemplate('finance', 'upcoming_bills', [{ id: 'pay_down_card', status: 'in_progress' }], true), true);
  assert.equal(canStartTemplate('finance', 'payday_check', [], true), false);
});

test('a template pays quest XP once', () => {
  assert.deepEqual(finishPaysOnce('in_progress'), { pay: true, already: false });
  assert.deepEqual(finishPaysOnce('complete'), { pay: false, already: true });
  assert.deepEqual(finishPaysOnce('due'), { pay: false, already: false });
  assert.deepEqual(finishPaysOnce('locked'), { pay: false, already: false });
  const started = templateRowModels('health', [{ id: 'easy_walk', status: 'in_progress' }], true);
  const html = renderToStaticMarkup(createElement(TemplateBoard, { rows: started }));
  assert.match(html, /In progress/);
  assert.match(html, /Mark done/);
  const done = templateRowModels('health', [{ id: 'easy_walk', status: 'complete' }], true);
  assert.match(renderToStaticMarkup(createElement(TemplateBoard, { rows: done })), />Complete</);
  const skipped = templateRowModels('finance', [{ id: 'upcoming_bills', status: 'skipped' }], true);
  assert.match(renderToStaticMarkup(createElement(TemplateBoard, { rows: skipped })), />Skipped</);
});
