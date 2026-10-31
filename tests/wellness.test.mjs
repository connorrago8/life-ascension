import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  WELLNESS_LIMITS, chicagoDate, handleWellnessPost, parseWellnessBody, shiftDate,
} from '../lib/wellnessApi.ts';
import {
  WELLNESS_EMPTY, WELLNESS_HELP_HREF, formatSleep, formatSteps, formatWellnessDate, wellnessSnapshot,
} from '../lib/wellness.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const TODAY = '2026-10-30';
const GOOD_KEY = `la_live_${'A'.repeat(43)}`;
const OTHER_KEY = `la_live_${'B'.repeat(43)}`;
const USER = '07861706-72b3-4b26-aa5b-e243ed4e0923';

/** Mirrors lib/apiKeyAuth for the three cases: no key, unknown key, known key. */
function fakeAuth(keys = { [GOOD_KEY]: ['quests:read', 'quests:write'] }) {
  return async (req) => {
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '');
    if (!match) return { ok: false, status: 401, error: 'Bearer token required' };
    const scopes = keys[match[1]];
    if (!scopes) return { ok: false, status: 401, error: 'Invalid or revoked API key' };
    return { ok: true, userId: USER, method: 'api_key', scopes };
  };
}

/** In-memory stand-in for record_wellness_reading_as_user: upsert by (user, date), keep omitted values. */
function memoryStore() {
  const rows = new Map();
  const calls = [];
  return {
    rows,
    calls,
    record: async (auth, input) => {
      calls.push({ auth, input });
      const key = `${auth.userId}|${input.date}`;
      const prev = rows.get(key);
      const row = {
        date: input.date,
        sleep_hours: input.sleepHours ?? prev?.sleep_hours ?? null,
        steps: input.steps ?? prev?.steps ?? null,
        source: input.source,
        updated_at: '2026-10-30T13:00:00.000Z',
      };
      rows.set(key, row);
      return { ok: true, reading: row };
    },
  };
}

function post(body, key = GOOD_KEY, extra = {}) {
  const headers = { 'content-type': 'application/json', ...extra };
  if (key) headers.authorization = `Bearer ${key}`;
  return new Request('http://local/api/wellness', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

const deps = (store, auth = fakeAuth()) => ({ authenticate: auth, record: store.record, today: () => TODAY });

test('auth: no key and a bad key get 401 with Bearer realm; nothing is written', async () => {
  const store = memoryStore();
  for (const [key, message] of [[null, 'Bearer token required'], [OTHER_KEY, 'Invalid or revoked API key']]) {
    const res = await handleWellnessPost(post({ date: TODAY, steps: 10 }, key), deps(store));
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer realm="life-ascension"');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const text = await res.text();
    assert.deepEqual(JSON.parse(text), { error: message });
    assert.doesNotMatch(text, /la_live_/);
  }
  assert.equal(store.calls.length, 0);
});

test('auth: a good key saves for its own user; a key without write scope gets 403', async () => {
  const store = memoryStore();
  const res = await handleWellnessPost(post({ date: '2026-10-29', sleep_hours: 7.25, steps: 9100 }), deps(store));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { ok: true, reading: { date: '2026-10-29', sleep_hours: 7.25, steps: 9100, source: 'apple_health_shortcut', updated_at: '2026-10-30T13:00:00.000Z' } });
  assert.equal(store.calls[0].auth.userId, USER);
  assert.doesNotMatch(JSON.stringify(body), /la_live_/);

  const readOnly = memoryStore();
  const denied = await handleWellnessPost(post({ steps: 5 }), deps(readOnly, fakeAuth({ [GOOD_KEY]: ['quests:read'] })));
  assert.equal(denied.status, 403);
  assert.equal(readOnly.calls.length, 0);
});

test('auth failure 503 (not configured) passes through without WWW-Authenticate', async () => {
  const res = await handleWellnessPost(post({ steps: 1 }), {
    authenticate: async () => ({ ok: false, status: 503, error: 'API key authentication is not configured' }),
    record: async () => { throw new Error('must not write'); },
    today: () => TODAY,
  });
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('www-authenticate'), null);
});

test('validation: ranges, dates, types and body limits give clear 400/413 errors', async () => {
  const bad = [
    [{ date: TODAY, sleep_hours: 24.01 }, /sleep_hours must be a number from 0 to 24/],
    [{ date: TODAY, sleep_hours: -1 }, /sleep_hours/],
    [{ date: TODAY, sleep_hours: 'lots' }, /sleep_hours/],
    [{ date: TODAY, steps: 200001 }, /steps must be a number from 0 to 200000/],
    [{ date: TODAY, steps: -3 }, /steps/],
    [{ date: TODAY, steps: true }, /steps/],
    [{ date: TODAY }, /Send sleep_hours, steps, or both/],
    [{ date: TODAY, sleep_hours: '', steps: null }, /Send sleep_hours, steps, or both/],
    [{ date: '2026-02-30', steps: 1 }, /YYYY-MM-DD/],
    [{ date: '10/30/2026', steps: 1 }, /YYYY-MM-DD/],
    [{ date: shiftDate(TODAY, 2), steps: 1 }, /between 2026-09-30 and 2026-10-31/],
    [{ date: shiftDate(TODAY, -31), steps: 1 }, /between/],
    [{ date: TODAY, steps: 1, source: 'Bad Source!' }, /source/],
    [[1, 2], /JSON object/],
  ];
  for (const [body, message] of bad) {
    const parsed = parseWellnessBody(body, TODAY);
    assert.equal(parsed.ok, false, JSON.stringify(body));
    assert.match(parsed.error, message);
  }
  const store = memoryStore();
  const invalid = await handleWellnessPost(post('{"steps":'), deps(store));
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { error: 'Invalid JSON' });
  const huge = await handleWellnessPost(post(JSON.stringify({ steps: 1, pad: 'x'.repeat(WELLNESS_LIMITS.maxBodyBytes) })), deps(store));
  assert.equal(huge.status, 413);
  const range = await handleWellnessPost(post({ steps: 999999 }), deps(store));
  assert.equal(range.status, 400);
  assert.equal(store.calls.length, 0);
});

test('validation: edges, Shortcut-style strings, rounding and default date are accepted', () => {
  assert.deepEqual(parseWellnessBody({ date: TODAY, sleep_hours: 0, steps: 0 }, TODAY),
    { ok: true, value: { date: TODAY, sleepHours: 0, steps: 0, source: 'apple_health_shortcut' } });
  assert.deepEqual(parseWellnessBody({ date: shiftDate(TODAY, 1), sleep_hours: 24, steps: 200000 }, TODAY).value,
    { date: '2026-10-31', sleepHours: 24, steps: 200000, source: 'apple_health_shortcut' });
  assert.deepEqual(parseWellnessBody({ date: ' 2026-09-30 ', sleep_hours: '7.256', steps: '9,100.6' }, TODAY).value,
    { date: '2026-09-30', sleepHours: 7.26, steps: 9101, source: 'apple_health_shortcut' });
  assert.equal(parseWellnessBody({ steps: 50 }, TODAY).value.date, TODAY);
  assert.equal(parseWellnessBody({ steps: 50, source: 'manual_test' }, TODAY).value.source, 'manual_test');
  assert.match(chicagoDate(new Date('2026-10-31T04:30:00Z')), /^2026-10-30$/);
});

test('upsert: the same date updates one reading and omitted values are kept', async () => {
  const store = memoryStore();
  await handleWellnessPost(post({ date: '2026-10-29', sleep_hours: 7.5, steps: 8000 }), deps(store));
  const second = await handleWellnessPost(post({ date: '2026-10-29', steps: 9100 }), deps(store));
  assert.equal(second.status, 200);
  assert.equal(store.rows.size, 1);
  assert.deepEqual({ ...store.rows.get(`${USER}|2026-10-29`), updated_at: undefined },
    { date: '2026-10-29', sleep_hours: 7.5, steps: 9100, source: 'apple_health_shortcut', updated_at: undefined });
  await handleWellnessPost(post({ date: '2026-10-30', sleep_hours: 6 }), deps(store));
  assert.equal(store.rows.size, 2);
  // The database does the same: one row per (user, date), coalesce keeps earlier values.
  const sql = read('supabase/migrations/202610300002_wellness_readings.sql');
  assert.match(sql, /constraint wellness_readings_user_date_key unique \(user_id, reading_date\)/);
  assert.match(sql, /on conflict on constraint wellness_readings_user_date_key do update/);
  assert.match(sql, /sleep_hours = coalesce\(excluded\.sleep_hours, w\.sleep_hours\)/);
  assert.match(sql, /steps = coalesce\(excluded\.steps, w\.steps\)/);
});

test('migration: additive, RLS own-rows read only, service-role wrapper, reversible', () => {
  const sql = read('supabase/migrations/202610300002_wellness_readings.sql');
  assert.match(sql, /TEST-ONLY/);
  assert.doesNotMatch(sql, /\b(drop|alter table public\.(?!wellness_readings)|truncate)\b/i);
  assert.match(sql, /alter table public\.wellness_readings enable row level security;/);
  assert.match(sql, /for select to authenticated using \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.match(sql, /revoke all on public\.wellness_readings from public, anon, authenticated;/);
  assert.match(sql, /grant select on public\.wellness_readings to authenticated;/);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all)[^;]*to authenticated/i);
  assert.match(sql, /check \(sleep_hours between 0 and 24\)/);
  assert.match(sql, /check \(steps between 0 and 200000\)/);
  assert.match(sql, /perform public\._bind_service_role_user\(p_user_id\);/);
  assert.match(sql, /revoke all on function public\.record_wellness_reading_as_user\(uuid, date, numeric, integer, text\) from public, anon, authenticated;/);
  assert.match(sql, /set search_path = ''/);
  const down = read('supabase/rollbacks/202610300002_wellness_readings_down.sql');
  assert.match(down, /drop table if exists public\.wellness_readings;/);
  assert.match(down, /drop function if exists public\.record_wellness_reading_as_user/);
  const smoke = read('tests/sql/wellness_readings_smoke.sql');
  assert.match(smoke, /^begin;$/m);
  assert.match(smoke, /^rollback;$/m);
  assert.match(smoke, /RLS leak/);
});

test('route: uses the existing API-key auth, never logs keys, and is POST only', () => {
  const route = read('app/api/wellness/route.ts');
  assert.match(route, /import \{ authenticateRequest \} from '\.\.\/\.\.\/\.\.\/lib\/apiKeyAuth';/);
  assert.match(route, /authenticate: authenticateRequest/);
  assert.match(route, /record_wellness_reading_as_user', \{ p_user_id: auth\.userId/);
  assert.match(route, /createServiceRoleClient\(\)/);
  assert.match(route, /export async function GET\(\) \{\n\s*return wellnessJson\([^;]*405, \{ Allow: 'POST' \}\);/);
  for (const line of route.split('\n').filter((l) => /console\./.test(l))) {
    assert.doesNotMatch(line, /authorization|token|key|request\.headers/i, line);
  }
  const core = read('lib/wellnessApi.ts');
  assert.doesNotMatch(core, /console\./);
  assert.doesNotMatch(core, /^import /m);
});

test('display: latest reading with date, otherwise Not connected yet with How to connect', () => {
  assert.deepEqual(wellnessSnapshot(null), { connected: false });
  assert.deepEqual(wellnessSnapshot([]), { connected: false });
  assert.deepEqual(wellnessSnapshot([{ reading_date: '2026-10-29', sleep_hours: null, steps: null }]), { connected: false });
  assert.deepEqual(
    wellnessSnapshot([
      { reading_date: '2026-10-28', sleep_hours: 6, steps: 4000 },
      { reading_date: '2026-10-29', sleep_hours: '7.25', steps: 9100 },
    ]),
    { connected: true, date: '2026-10-29', sleepHours: 7.25, steps: 9100 },
  );
  assert.equal(formatSleep(7.25), '7 h 15 min');
  assert.equal(formatSleep(8), '8 h');
  assert.equal(formatSteps(9100), '9,100');
  assert.equal(formatWellnessDate('2026-10-29'), 'Thu, Oct 29');
  assert.equal(WELLNESS_EMPTY, 'Not connected yet');
  assert.equal(WELLNESS_HELP_HREF, '/settings/wellness');

  const page = read('app/(app)/character/page.tsx');
  assert.match(page, /client\.from\('wellness_readings'\)\.select\(WELLNESS_READING_COLUMNS\)\.order\('reading_date', \{ ascending: false \}\)\.limit\(1\)/);
  assert.match(page, /wellnessSnapshot\(wellnessResult\.data\)/);
  assert.doesNotMatch(page, /wellnessSnapshot\(state\.profile\)/);
  assert.match(page, /\{WELLNESS_EMPTY\} · <a className="wellness-help" href=\{WELLNESS_HELP_HREF\}>How to connect<\/a>/);
  assert.match(page, /formatSleep\(wellness\.sleepHours\)/);
  assert.match(page, /formatWellnessDate\(wellness\.date\)/);

  const guide = read('app/(app)/settings/wellness/page.tsx');
  for (const step of ['Find Health Samples', 'Steps', 'Sleep Analysis', 'Get Contents of URL', '/api/wellness', 'Time of Day, 8:00 AM, Daily', 'Run Immediately', '/settings/api-keys']) {
    assert.ok(guide.includes(step), step);
  }
  const doc = read('docs/apple-health-shortcut.md');
  for (const step of ['Find Health Samples', 'Sleep Analysis', 'Get Contents of URL', 'Authorization', 'Personal Automation', 'Run Immediately', 'Settings → API keys', 'Deployment Protection']) {
    assert.ok(doc.includes(step), step);
  }
});
