import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/202611010004_izzy_curse_resolution_rpc.sql', import.meta.url), 'utf8');

test('curse resolution RPC is service-role-only', () => {
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.resolve_izzy_secret_curse[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.resolve_izzy_secret_curse[\s\S]*to service_role/i);
});

test('resolution RPC never updates sealed curses or XP', () => {
  assert.match(sql, /where id = p_curse_id[\s\S]*state = 'revealed'/i);
  assert.match(sql, /revealed_at is not null/i);
  assert.doesNotMatch(sql, /\bupdate\s+public\.quest_completions\b/i);
  assert.doesNotMatch(sql, /\bupdate\s+public\.player_progress\b/i);
});

test('resolution RPC uses a conditional seen-at comparison', () => {
  assert.match(sql, /seen_at is not distinct from p_expected_seen_at/i);
  assert.match(sql, /return found;/i);
});
