import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/202611140002_bidirectional_assign.sql');
const rollback = read('supabase/rollbacks/202611140002_bidirectional_assign_down.sql');
const board = read('components/quests/PersonalQuestBoard.tsx');
const home = read('app/(app)/companion/CompanionHome.tsx');

test('either bond member can assign the other, and sending awards no XP', () => {
  assert.match(migration, /u in \(companion_id, inviter_id\)/);
  assert.match(migration, /when u = b\.companion_id then b\.inviter_id else b\.companion_id/);
  assert.match(migration, /idempotent/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /public\.xp_ledger where owner_id = b\.inviter_id/);
  assert.match(migration, /public\.xp_ledger where owner_id = b\.companion_id/);
  assert.match(migration, /public\.companion_xp_ledger/);
  assert.match(migration, /Sending a quest must not award XP/);
  assert.match(migration, /_place_companion_quest\(v_id\)/);
  assert.match(migration, /revoke all on function public\.companion_send_quest\(text, text, date, text, text\) from public, anon/);
  assert.match(migration, /grant execute on function public\.companion_send_quest\(text, text, date, text, text\) to authenticated/);
  assert.doesNotMatch(migration, /disable row level security|drop policy|grant execute[\s\S]*to anon/i);
  assert.match(rollback, /companion_id = u/);
  assert.doesNotMatch(rollback, /u in \(companion_id, inviter_id\)/);
});

test('the board assigns in both directions and Together is a filter, not a page', () => {
  assert.match(board, /Assign to \{partner\}/);
  assert.match(board, /companion\?'Connor':'Izzy'/);
  assert.match(board, /chip==='all'\|\|chip==='together'/);
  assert.doesNotMatch(board, /href="\/together"/);
  assert.doesNotMatch(home, /href="\/together"/);
  assert.match(home, /href="\/quests\?chip=together"/);
});
