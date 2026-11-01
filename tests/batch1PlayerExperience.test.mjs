/**
 * Batch 1 player-visible rules: per-quest streaks, flat +1 XP, navigation,
 * Lantern Route, and the titles a player actually reads.
 * Node only. No Production database and no hosted credentials.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { perQuestFire } from '../lib/questStreak.ts';
import { FALLBACK_TIME_ZONE, isValidTimeZone, localToday, playerTimeZone } from '../lib/playerTimeZone.ts';
import { parseLanternProgress, LANTERN_PURPOSE, LANTERN_RESET_COPY } from '../lib/lanternRoute.ts';
import { pendingCompletes, rememberPendingComplete, forgetPendingComplete } from '../lib/pendingQuestComplete.ts';
import { readQuestProgress, writeQuestProgress } from '../lib/questProgressSnapshot.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('per-quest streak counts today, resets on a missed day, and ignores other quests', () => {
  const today = '2026-11-01';
  assert.equal(perQuestFire([], today), 0, 'a daily created today has no streak until it is completed');
  assert.equal(perQuestFire([today], today), 1, 'completing A today shows 1');
  assert.equal(perQuestFire(['2026-10-31', today], today), 2);
  assert.equal(perQuestFire(['2026-10-31'], today), 1, 'yesterday still counts until today is missed');
  assert.equal(perQuestFire(['2026-10-30'], today), 0, 'skipping a day resets this quest');
  assert.equal(perQuestFire(['2026-10-29', '2026-10-31', today], today), 2, 'a gap stops the count; no grace day is granted');
  const questB = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'];
  assert.equal(perQuestFire(['2026-10-30'], today), 0);
  assert.equal(perQuestFire(questB, today), 7, 'another quest keeps its own seven days');
});

test('player time zone falls back to America/Chicago', () => {
  assert.equal(playerTimeZone('Not/AZone'), FALLBACK_TIME_ZONE);
  assert.equal(playerTimeZone(''), FALLBACK_TIME_ZONE);
  assert.equal(playerTimeZone('America/New_York'), 'America/New_York');
  assert.equal(isValidTimeZone('America/Chicago'), true);
  assert.equal(localToday(new Date('2026-11-01T04:30:00Z'), 'America/Chicago'), '2026-10-31');
  assert.equal(localToday(new Date('2026-11-01T05:30:00Z'), 'America/Chicago'), '2026-11-01');
});

test('quest board shows a per-quest fire and no streak-pressure sentence', () => {
  const board = read('app/(app)/quests/page.tsx');
  assert.match(board, /className=\{'streak-badge lit'/);
  assert.match(board, /streak\?\.\[quest\.id\]/);
  assert.match(board, /🔥 \{days\}/);
  assert.doesNotMatch(board, /Complete this quest today to keep its streak/);
  assert.doesNotMatch(board, /Chicago time/);
  assert.match(board, /playerTimeZone\(\)/);
  assert.match(board, />Retry</);
  assert.match(board, /navigator\.onLine===false/);
  assert.doesNotMatch(board, /setXp\(xp\+1\)|setXp\(\(xp\)/);
});

test('a failed complete is Retry and does not change the cached XP', () => {
  const store = new Map();
  const storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
  rememberPendingComplete('account-a', 'instance-1', storage);
  assert.deepEqual(pendingCompletes('account-a', storage), ['instance-1']);
  assert.deepEqual(pendingCompletes('account-b', storage), [], 'another account does not see the retry');
  writeQuestProgress({ owner: 'account-a', xp: 4, quests: [], instances: [], streak: null }, storage);
  assert.equal(readQuestProgress('account-a', storage).xp, 4);
  assert.equal(readQuestProgress('account-b', storage), null);
  forgetPendingComplete('account-a', 'instance-1', storage);
  assert.deepEqual(pendingCompletes('account-a', storage), []);
});

test('flat XP migration awards 1, uses the player zone, and does not weaken RLS', () => {
  const sql = read('supabase/migrations/20261101143000_player_timezone_flat_xp.sql');
  const companion = read('supabase/migrations/202610310004_companion_assignments.sql');
  assert.match(sql, /values \(p_owner, p_instance, 1, 1, null, null\)/);
  assert.match(sql, /on conflict \(instance_id\) do nothing/);
  assert.match(sql, /create or replace function public\.set_player_timezone/);
  assert.match(sql, /return 'America\/Chicago'/);
  assert.match(sql, /public\.quest_timezone\(auth\.uid\(\)\)/);
  assert.doesNotMatch(sql, /quest_streak_xp/);
  assert.doesNotMatch(sql, /disable row level security|drop policy|to anon/i);
  assert.doesNotMatch(companion, /v_amount:=2|amount in \(1,2\)/);
});

test('Home is the selected tab on Home, and Hub back does not skip from the Hearth', () => {
  const nav = read('app/components/AppNav.tsx');
  const home = read('app/(app)/page.tsx');
  const hearth = read('app/(app)/play/emberhaven/hearth/page.tsx');
  const town = read('app/(app)/play/emberhaven/page.tsx');
  const hub = read('components/play/AdventureHub.tsx');
  const css = read('app/style.css');
  assert.match(nav, /if \(href === '\/'\) return pathname === '\/'/);
  assert.match(nav, /aria-current=\{current \? 'page' : undefined\}/);
  assert.match(css, /\.nav-link\[aria-current="page"\]/);
  assert.match(home, /addEventListener\('visibilitychange', refresh\)/);
  assert.doesNotMatch(home, /addEventListener\('focus', refresh\)/);
  assert.match(town, /TownBackLink href="\/play" label="Back to Hub"/);
  assert.match(hearth, /TownBackLink href="\/play\/emberhaven"/);
  assert.doesNotMatch(hearth, /Back to Hub/);
  assert.match(hub, /Locked\. Coming soon\./);
  assert.match(hub, /router\.push\('\/play\/emberhaven'\)/);
  assert.match(hub, /href="\/play\/brain-rot"/);
  assert.doesNotMatch(read('app/(app)/play/emberhaven/page.tsx'), /WalkableTownMap/);
});

test('Lantern Route explains itself, saves, and does not award XP', () => {
  const visit = read('app/(app)/play/emberhaven/TownVisit.tsx');
  assert.equal(LANTERN_PURPOSE, 'A short town story. Find 3 clues, then put them in order.');
  assert.match(visit, /LANTERN_PURPOSE/);
  assert.match(visit, /LANTERN_RESET_COPY/);
  assert.match(LANTERN_RESET_COPY, /Progress is saved on this device/);
  assert.match(LANTERN_RESET_COPY, /do not change/);
  assert.match(visit, /Lantern kept/);
  assert.doesNotMatch(visit, /reloading starts fresh/);
  const saved = parseLanternProgress(JSON.stringify({
    started: true, clues: ['hearth', 'forge', 'market'], placed: ['hearth', 'forge', 'market'], solved: true,
  }));
  assert.equal(saved.solved, true);
  assert.equal(saved.kept, true);
  const reset = { ...saved, started: false, clues: [], placed: [], solved: false, kept: true };
  assert.equal(parseLanternProgress(JSON.stringify(reset)).kept, true);
});

test('rest node and the adventurer title say what they are', () => {
  const floor = read('lib/crypt/delve/floor.ts');
  const labels = read('lib/crypt/delve/pathLabels.ts');
  const delve = read('components/crypt/DelveRun.tsx');
  const content = read('lib/crypt/content.ts');
  assert.match(floor, /rest: 'Rest'/);
  assert.match(floor, /Campfire: heal or remove a card/);
  assert.match(labels, /return 'Rest'/);
  assert.match(delve, /Campfire: heal or remove a card/);
  assert.match(content, /name: 'Adventurer'/);
  assert.doesNotMatch(content, /name: 'Wayfarer'/);
  assert.doesNotMatch(read('lib/preview/catalog.ts'), /Wayfarer/);
});
