import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { NAV_ITEMS } from '../lib/nav.ts';
import { todayGlance, todayGlanceLabel } from '../lib/homeToday.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const home = read('app/(app)/page.tsx');
const board = read('app/(app)/quests/page.tsx');
const journal = read('app/(app)/quests/journal/page.tsx');
const css = read('app/style.css');

test('the quest board lives at /quests and the journal at /quests/journal', () => {
  assert.ok(existsSync(new URL('../app/(app)/quests/page.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../app/(app)/quests/journal/page.tsx', import.meta.url)));
  assert.match(board, /export default function QuestBoard\(\)/);
  assert.match(board, /set_quest_instance_status_v2/);
  assert.match(board, /ensure_quest_instance/);
  assert.match(board, /ConfirmCompleteButton/);
  assert.match(board, /completed-board-toggle/);
  assert.match(board, /useState\(false\);const \[recoveryIds/); // Completed stays closed by default.
  assert.match(board, /aria-label="Upcoming"/);
  assert.match(board, /<a href="\/quests\/journal">Quest notes<\/a>/);
  assert.match(journal, /href="\/quests">Quest board<\/a>/);
  assert.doesNotMatch(journal, /on Home/);
});

test('bottom nav: Home is / and the Quests tab points at the board', () => {
  const byId = Object.fromEntries(NAV_ITEMS.map((item) => [item.id, item.href]));
  assert.equal(byId.home, '/');
  assert.equal(byId.quests, '/quests');
});

test('quest board back-links point at /quests, not Home', () => {
  assert.match(read('app/(app)/quests/[id]/ui.tsx'), /<a href="\/quests">Quest board<\/a>/);
  assert.match(read('app/(app)/quests/manage/page.tsx'), /<Link href="\/quests">← Back to Quest Board<\/Link>/);
  assert.match(read('app/(app)/settings/api-keys/page.tsx'), /href="\/quests">Quest board/);
  assert.match(read('app/settings/password/page.tsx'), /<a href="\/quests">Quest board<\/a> · <a href="\/quests\/journal">Quest notes<\/a>/);
});

test('Home is character-first, read-only, and does not duplicate the nav', () => {
  assert.match(home, /export default function Home\(\)/);
  assert.match(home, /<HomeCharacter /);
  assert.match(home, /attributeEntries\(/);
  assert.match(home, /role="progressbar"/);
  assert.match(home, /get_lifetime_xp/);
  assert.match(home, /verifiedLifetimeXp\(/);
  // Exactly one tappable summary card, and it goes to the board.
  assert.equal((home.match(/<Link /g) ?? []).length, 1);
  assert.match(home, /<Link href="\/quests" className="hub-card hub-today"/);
  assert.doesNotMatch(home, /Enter (the )?Crypt|Go to Quest Board|href="\/play/i);
  // Home never writes: no completes, ensures, equips, or inserts.
  assert.doesNotMatch(home, /set_quest_instance_status|ensure_quest_instance|equip_earned_armor|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
});

test('Home and board keep 44px taps and clear the bottom nav and safe areas', () => {
  assert.match(css, /\.hub-today \{[^}]*min-height: 52px/);
  assert.match(css, /\.home-hub \{[^}]*env\(safe-area-inset-top/);
  assert.match(css, /\.quest-board-page \.board-foot a \{[^}]*min-height: 44px/);
  assert.match(css, /\.shell-main \{ padding-bottom: calc\(86px \+ env\(safe-area-inset-bottom\)\); \}/);
  assert.match(css, /\.completed-board-toggle \{ min-height: 44px; \}/);
});

test('today glance counts left and done without creating instances', () => {
  const today = '2026-10-30';
  const quests = [
    { id: 'a', cadence: 'daily', quest_type: 'scheduled', scheduled_for: null },
    { id: 'b', cadence: 'daily', quest_type: 'scheduled', scheduled_for: null },
    { id: 'c', cadence: 'daily', quest_type: 'scheduled', scheduled_for: '2026-11-02' },
    { id: 'd', cadence: 'once', quest_type: 'scheduled', scheduled_for: null },
    { id: 'e', cadence: 'once', quest_type: 'goal', scheduled_for: null },
    { id: 'f', cadence: 'daily', quest_type: 'scheduled', scheduled_for: null },
  ];
  const instances = [
    { quest_id: 'a', due_date: today, status: 'completed' },
    { quest_id: 'd', due_date: '2026-10-28', status: 'available' },
    { quest_id: 'e', due_date: today, status: 'completed' },
    { quest_id: 'f', due_date: today, status: 'deferred' },
  ];
  // b has no instance yet (counts as left); c starts later; f is deferred.
  assert.deepEqual(todayGlance(quests, instances, today), { left: 2, done: 2 });
  assert.equal(todayGlanceLabel({ left: 2, done: 2 }), '2 left · 2 done');
  assert.equal(todayGlanceLabel({ left: 0, done: 3 }), 'All done · 3 completed');
  assert.equal(todayGlanceLabel({ left: 0, done: 0 }), 'No quests due today');
});
