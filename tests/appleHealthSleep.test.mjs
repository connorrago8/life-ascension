import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import {
  LIGHTS_OUT_DEADLINE,
  LIGHTS_OUT_NIGHT_START,
} from '../lib/ascension/config.ts';
import {
  applyAutoSleep,
  applyNutrition,
  chooseSleepSamples,
  isIgnoredSleepStage,
  isIngestToken,
  lightsOutReceipt,
  nutritionGameDay,
  parseHealthIngest,
  parseNutrition,
  sleepDecision,
} from '../lib/ascension/appleHealth.ts';
import { claimLightsOut } from '../lib/ascension/lightsOut.ts';
import { handleHealthIngestPost } from '../lib/healthIngestApi.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const TODAY = '2026-11-26';
const REQUEST = '00000000-0000-4000-8000-00000000c701';
const REQUEST_2 = '00000000-0000-4000-8000-00000000c702';
const token = `la_sleep_${'a'.repeat(43)}`;

function sleepBody(start, end, extra = {}) {
  return {
    sleep_start: start,
    sleep_end: end,
    source: 'apple_health',
    request_id: REQUEST,
    ...extra,
  };
}

test('10:45 PM credits and 11:30 PM does not', () => {
  assert.equal(LIGHTS_OUT_DEADLINE, '23:00');
  assert.equal(LIGHTS_OUT_NIGHT_START, '17:00');
  const early = sleepDecision(new Date('2026-11-25T22:45:00-06:00'));
  assert.equal(early.gameDay, '2026-11-25');
  assert.equal(early.inNight, true);
  assert.equal(early.credit, true);
  const late = sleepDecision(new Date('2026-11-25T23:30:00-06:00'));
  assert.equal(late.gameDay, '2026-11-25');
  assert.equal(late.credit, false);
  const onTime = sleepDecision(new Date('2026-11-25T23:00:00-06:00'));
  assert.equal(onTime.credit, true);
});

test('midnight, 4:59 AM, and 5:00 AM are the game-day edges', () => {
  const midnight = sleepDecision(new Date('2026-11-26T00:00:00-06:00'));
  const before = sleepDecision(new Date('2026-11-26T04:59:00-06:00'));
  const at = sleepDecision(new Date('2026-11-26T05:00:00-06:00'));
  assert.equal(midnight.gameDay, '2026-11-25');
  assert.equal(before.gameDay, '2026-11-25');
  assert.equal(at.gameDay, '2026-11-26');
  assert.equal(midnight.credit, false);
  assert.equal(before.credit, false);
  assert.equal(at.inNight, false);
  assert.equal(at.credit, false);
  assert.equal(nutritionGameDay(new Date('2026-11-26T04:59:00-06:00')), '2026-11-25');
  assert.equal(nutritionGameDay(new Date('2026-11-26T05:00:00-06:00')), '2026-11-26');
  assert.equal(nutritionGameDay(new Date('2026-07-15T04:59:00-05:00')), '2026-07-14');
  assert.equal(nutritionGameDay(new Date('2026-07-15T05:00:00-05:00')), '2026-07-15');
});

test('overlapping Oura, Whoop, and Apple Watch samples award XP once', () => {
  assert.equal(isIgnoredSleepStage('In Bed'), true);
  assert.equal(isIgnoredSleepStage('Awake'), true);
  assert.equal(isIgnoredSleepStage('AsleepCore'), false);
  const chosen = chooseSleepSamples([
    { start: '2026-11-25T22:30:00-06:00', end: '2026-11-26T06:20:00-06:00', source_name: 'Apple Watch', value: 'In Bed' },
    { start: '2026-11-25T22:50:00-06:00', end: '2026-11-26T06:10:00-06:00', source_name: 'Whoop', value: 'Asleep' },
    { start: '2026-11-25T22:40:00-06:00', end: '2026-11-26T06:00:00-06:00', source_name: 'Oura', value: 'AsleepCore' },
    { start: '2026-11-26T03:00:00-06:00', end: '2026-11-26T03:12:00-06:00', source_name: 'Apple Watch', value: 'Awake' },
  ]);
  assert.equal(chosen.ok, true);
  assert.equal(chosen.value.sourceName, 'Oura');
  assert.equal(chosen.value.gameDay, '2026-11-25');
  assert.equal(chosen.value.credit, true);
  assert.equal(chosen.value.start.toISOString(), '2026-11-26T04:40:00.000Z');
  const parsed = parseHealthIngest({
    source: 'apple_health',
    request_id: REQUEST,
    samples: [
      { start: '2026-11-25T22:50:00-06:00', end: '2026-11-26T06:10:00-06:00', source_name: 'Whoop', value: 'Asleep' },
      { start: '2026-11-25T22:40:00-06:00', end: '2026-11-26T06:00:00-06:00', source_name: 'Oura', value: 'Asleep' },
    ],
    sleep_start: '2026-11-25T22:50:00-06:00',
    sleep_end: '2026-11-26T06:10:00-06:00',
  }, new Date('2026-11-26T13:00:00Z'));
  assert.equal(parsed.value.sleep.sourceName, 'Oura');
  const first = applyAutoSleep([], [], parsed.value.sleep, REQUEST, TODAY, claimLightsOut);
  assert.equal(first.xpAwarded, 5);
  assert.equal(lightsOutReceipt(parsed.value.sleep.sourceName), 'Auto from Apple Health (Oura)');
  const again = applyAutoSleep(first.sleepRows, first.lightsOut, parsed.value.sleep, REQUEST_2, TODAY, claimLightsOut);
  assert.equal(again.xpAwarded, 0);
  assert.equal(again.already, true);
  assert.equal(again.lightsOut.length, 1);
  assert.equal(again.lightsOut[0].xp, 5);
});

test('a duplicate sleep request id and an old night add no XP', () => {
  const night = parseHealthIngest(sleepBody('2026-11-25T22:45:00-06:00', '2026-11-26T06:30:00-06:00'), new Date('2026-11-26T13:00:00Z'));
  const first = applyAutoSleep([], [], night.value.sleep, REQUEST, TODAY, claimLightsOut);
  assert.equal(first.xpAwarded, 5);
  const duplicate = applyAutoSleep(first.sleepRows, first.lightsOut, night.value.sleep, REQUEST, TODAY, claimLightsOut);
  assert.equal(duplicate.xpAwarded, 0);
  assert.equal(duplicate.already, true);
  assert.equal(duplicate.lightsOut.reduce((sum, row) => sum + row.xp, 0), 5);
  const old = parseHealthIngest(sleepBody('2026-11-22T22:45:00-06:00', '2026-11-23T06:00:00-06:00'), new Date('2026-11-26T13:00:00Z'));
  const rejected = applyAutoSleep([], [], old.value.sleep, REQUEST_2, TODAY, claimLightsOut);
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.xpAwarded, 0);
  assert.equal(rejected.sleepRows.length, 0);
  const late = parseHealthIngest(sleepBody('2026-11-25T23:30:00-06:00', '2026-11-26T06:30:00-06:00'), new Date('2026-11-26T13:00:00Z'));
  const noCredit = applyAutoSleep([], [], late.value.sleep, REQUEST, TODAY, claimLightsOut);
  assert.equal(noCredit.xpAwarded, 0);
  assert.equal(noCredit.lightsOut.length, 0);
});

test('manual lights out then auto awards XP once', () => {
  const manual = claimLightsOut([], TODAY, '00000000-0000-4000-8000-00000000c799');
  assert.equal(manual.xpAwarded, 5);
  const night = parseHealthIngest(sleepBody('2026-11-26T22:40:00-06:00', '2026-11-27T06:00:00-06:00', { request_id: REQUEST_2 }), new Date('2026-11-27T13:00:00Z'));
  const auto = applyAutoSleep([], manual.rows, night.value.sleep, REQUEST_2, '2026-11-27', claimLightsOut);
  assert.equal(auto.xpAwarded, 0);
  assert.equal(auto.already, true);
  assert.equal(auto.lightsOut.length, 1);
  assert.equal(auto.sleepRows[0].credited, false);
  assert.equal(lightsOutReceipt(null), 'Auto from Apple Health');
});

test('a bad ingest token is 401 and is not passed to the database', async () => {
  assert.equal(isIngestToken(token), true);
  assert.equal(isIngestToken('la_live_' + 'a'.repeat(43)), false);
  let calls = 0;
  const deps = {
    now: () => new Date('2026-11-26T13:00:00Z'),
    ingest: async () => {
      calls += 1;
      return { ok: false, status: 401, error: 'Invalid or revoked token' };
    },
  };
  for (const authorization of [undefined, 'Bearer nope', `Bearer la_live_${'b'.repeat(43)}`]) {
    const headers = authorization ? { authorization, 'content-type': 'application/json' } : { 'content-type': 'application/json' };
    const response = await handleHealthIngestPost(new Request('http://local/api/health/sleep', {
      method: 'POST', headers, body: JSON.stringify(sleepBody('2026-11-25T22:45:00-06:00', '2026-11-26T06:30:00-06:00')),
    }), deps);
    assert.equal(response.status, 401);
  }
  assert.equal(calls, 0);
  const rejected = await handleHealthIngestPost(new Request('http://local/api/health/sleep', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(sleepBody('2026-11-25T22:45:00-06:00', '2026-11-26T06:30:00-06:00')),
  }), deps);
  assert.equal(rejected.status, 401);
  assert.equal(calls, 1);
  const route = read('app/api/health/sleep/route.ts');
  assert.doesNotMatch(route, /createServiceRoleClient|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(route, /ingest_apple_health/);
  assert.match(route, /p_token_hash/);
  for (const line of route.split('\n').filter((line) => /console\./.test(line))) {
    assert.doesNotMatch(line, /authorization|token|body|kcal/i);
  }
});

function nutritionBody(extra = {}) {
  return {
    schema_version: 1,
    game_date: TODAY,
    timezone: 'America/Chicago',
    basis: 'game_window',
    source: 'cronometer',
    observed_at: '2026-11-26T07:00:00-06:00',
    request_id: REQUEST,
    read_status: 'complete',
    energy_kcal: 1800,
    protein_g: 90,
    carbs_g: 200,
    fat_g: 60,
    ...extra,
  };
}

test('dietary_energy_kcal is an alias and fiber and water are discarded', () => {
  const alias = parseNutrition(nutritionBody({ energy_kcal: undefined, dietary_energy_kcal: 1750, fiber_g: 40, water_ml: 900 }));
  assert.equal(alias.ok, true);
  assert.equal(alias.value.energyKcal, 1750);
  assert.equal(alias.value.proteinG, 90);
  assert.equal('fiberG' in alias.value, false);
  assert.equal('waterMl' in alias.value, false);
  const named = parseNutrition(nutritionBody({ energy_kcal: 1800, dietary_energy_kcal: 1800 }));
  assert.equal(named.value.energyKcal, 1800);
  assert.equal(parseNutrition(nutritionBody({ energy_kcal: 1, dietary_energy_kcal: 2 })).ok, false);
  assert.equal(parseNutrition(nutritionBody({ energy_kcal: -1 })).ok, false);
  assert.equal(parseNutrition(nutritionBody({ protein_g: Number.NaN })).ok, false);
  assert.equal(parseNutrition(nutritionBody({ energy_kcal: '1800' })).ok, false);
  assert.equal(nutritionGameDay(new Date('2026-11-26T04:59:00-06:00')), '2026-11-25');
  assert.equal(nutritionGameDay(new Date('2026-11-26T05:00:00-06:00')), '2026-11-26');
});

test('null is missing, zero is real, and a null does not erase a stored number', () => {
  const first = parseNutrition(nutritionBody());
  const saved = applyNutrition(new Map(), new Set(), first.value, REQUEST, TODAY);
  assert.equal(saved.xpAwarded, 0);
  assert.equal(saved.days.get(TODAY).energyKcal, 1800);
  const zero = parseNutrition(nutritionBody({
    request_id: REQUEST_2,
    observed_at: '2026-11-26T08:00:00-06:00',
    energy_kcal: 0,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    read_status: 'partial',
  }));
  const withZero = applyNutrition(saved.days, saved.requests, zero.value, REQUEST_2, TODAY);
  assert.equal(withZero.days.get(TODAY).energyKcal, 0);
  assert.equal(withZero.days.get(TODAY).proteinG, 90);
  assert.equal(withZero.days.size, 1);
  const blank = parseNutrition(nutritionBody({
    request_id: '00000000-0000-4000-8000-00000000c703',
    observed_at: '2026-11-26T09:00:00-06:00',
    energy_kcal: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    read_status: 'failed',
    fiber_g: 12,
    water_ml: 1,
  }));
  assert.equal(blank.value.energyKcal, null);
  const kept = applyNutrition(withZero.days, withZero.requests, blank.value, '00000000-0000-4000-8000-00000000c703', TODAY);
  assert.equal(kept.days.get(TODAY).energyKcal, 0);
  assert.equal(kept.days.get(TODAY).proteinG, 90);
  assert.equal(kept.days.get(TODAY).readStatus, 'failed');
  const stale = parseNutrition(nutritionBody({
    request_id: '00000000-0000-4000-8000-00000000c704',
    observed_at: '2026-11-26T06:00:00-06:00',
    energy_kcal: 9999,
  }));
  const ignored = applyNutrition(kept.days, kept.requests, stale.value, '00000000-0000-4000-8000-00000000c704', TODAY);
  assert.equal(ignored.status, 'stale');
  assert.equal(ignored.days.get(TODAY).energyKcal, 0);
  const duplicate = applyNutrition(saved.days, saved.requests, first.value, REQUEST, TODAY);
  assert.equal(duplicate.status, 'duplicate_request_id');
  assert.equal(duplicate.days.get(TODAY).energyKcal, 1800);
});

test('a bad nutrition block does not fail the sleep upload', () => {
  const parsed = parseHealthIngest(sleepBody('2026-11-25T22:45:00-06:00', '2026-11-26T06:30:00-06:00', {
    energy_kcal: 'nope',
    fiber_g: -1,
    water_ml: 'x',
    read_status: 'nope',
    schema_version: 99,
  }), new Date('2026-11-26T13:00:00Z'));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.sleep.credit, true);
  assert.equal(parsed.value.sleepAttempted, true);
  const sleepRoute = read('app/api/health/sleep/route.ts');
  const nutritionRoute = read('app/api/health/nutrition/route.ts');
  assert.doesNotMatch(sleepRoute, /ingest_cronometer_nutrition|energy_kcal/);
  assert.doesNotMatch(nutritionRoute, /record_lights_out|ingest_apple_health/);
  assert.match(nutritionRoute, /ingest_cronometer_nutrition/);
  for (const line of nutritionRoute.split('\n').filter((line) => /console\./.test(line))) {
    assert.doesNotMatch(line, /authorization|token|body|kcal/i);
  }
});

test('nutrition numbers stay off Izzy, shared cards, badges, and MCP', () => {
  const forbidden = [
    'lib/mcpTools.ts',
    'app/api/mcp/route.ts',
    'components/StatusPill.tsx',
    'lib/recapTemplate.ts',
    'components/ascension/RecentQuestStrip.tsx',
  ];
  for (const path of forbidden) {
    assert.doesNotMatch(read(path), /health_nutrition_days|dietary_energy_kcal/);
  }
  for (const folder of ['components/companion', 'components/couple', 'lib/status']) {
    for (const file of readdirSync(new URL(`../${folder}`, import.meta.url))) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      assert.doesNotMatch(read(`${folder}/${file}`), /health_nutrition_days|dietary_energy_kcal/, file);
    }
  }
  const sql = read('supabase/migrations/202611260210_apple_health_sleep.sql');
  assert.doesNotMatch(sql, /fiber_g|water_ml|food_logged|save_health_meal/);
  assert.match(sql, /energy_kcal = coalesce\(v_energy, energy_kcal\)/);
  assert.match(sql, /p_read_status = 'failed'/);
  assert.match(sql, /source = 'cronometer'/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /health_nutrition_days_owner_read/);
  assert.match(sql, /\(select auth\.uid\(\)\) = owner_id/);
  assert.doesNotMatch(sql, /grant select on public\.health_nutrition_days to anon/);
  assert.match(sql, /revoke all on public\.health_ingest_tokens, public\.health_ingest_hits, public\.health_sleep_ingest/);
  assert.match(sql, /token_hash/);
  assert.match(sql, /public\.record_lights_out/);
  assert.match(sql, /v_hits > 30/);
  assert.match(sql, /time '23:00'/);
  assert.match(sql, /time '17:00'/);
  assert.match(sql, /time '05:00'/);
  assert.match(sql, /ingest_cronometer_nutrition/);
  assert.doesNotMatch(sql, /meal_count|calorie_count/);
  assert.match(read('supabase/rollbacks/202611260210_apple_health_sleep_down.sql'), /drop table if exists public\.health_nutrition_days/);
  assert.doesNotMatch(read('components/ascension/RecentQuestStrip.tsx'), /health_nutrition/);
});

test('the Apple Health page and doc tell you how to build the Shortcut', () => {
  const html = [
    read('app/(app)/settings/apple-health/page.tsx'),
    read('components/ascension/AppleHealthToken.tsx'),
  ].join('\n');
  const doc = read('docs/apple-health-sleep.md');
  for (const step of [
    'Find Health Samples',
    'DietaryEnergyConsumed',
    'DietaryProtein',
    'DietaryCarbohydrates',
    'DietaryFatTotal',
    'Fiber',
    'Water',
    'Get Contents of URL',
    '/api/health/sleep',
    '/api/health/nutrition',
    'Bearer',
    'request_id',
    '7:00 AM',
    'Run Immediately',
    'Oura',
    'Whoop',
    'Cronometer',
    'free',
    'locked',
    '5:00 AM',
    '11:00 PM',
    'la_sleep_',
  ]) {
    assert.ok(html.includes(step), `page missing ${step}`);
    assert.ok(doc.includes(step), `doc missing ${step}`);
  }
  assert.match(html, /Generate token|Rotate|Revoke/);
  assert.match(read('app/(app)/more/page.tsx'), /\/settings\/apple-health/);
  assert.match(read('components/ascension/HealthPanel.tsx'), /lightsOutReceipt/);
  assert.match(read('components/ascension/HealthPanel.tsx'), /health_nutrition_days/);
});
