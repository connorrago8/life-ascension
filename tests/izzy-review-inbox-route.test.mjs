import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/izzy/proposals/route.ts', import.meta.url), 'utf8');
const home = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/migrations/202611010013_izzy_submission_ownership.sql', import.meta.url), 'utf8');

test('review endpoint verifies authenticated identity and delegates ownership filtering', () => {
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /list_owned_izzy_proposals/);
  assert.match(route, /p_owner_id: data\.user\.id/);
  assert.match(route, /private, no-store/);
});
test('home board mounts the Izzy review component', () => {
  assert.match(home, /import \{IzzyReviewInbox\}/);
  assert.match(home, /<IzzyReviewInbox\/>/);
});
test('database filters review proposals by explicit submission ownership', () => {
  assert.match(sql, /join public\.izzy_submission_owners o/);
  assert.match(sql, /o\.owner_id = p_owner_id/);
  assert.match(sql, /revoke all on function public\.list_owned_izzy_proposals/);
});
