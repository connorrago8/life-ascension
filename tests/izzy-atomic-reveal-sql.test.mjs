import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/202611010007_izzy_atomic_curse_reveal.sql', import.meta.url), 'utf8');

test('reveal requires service role and never grants direct client execution', () => {
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.reveal_due_izzy_secret_curse\(uuid,uuid\)[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.reveal_due_izzy_secret_curse\(uuid,uuid\)[\s\S]*to service_role/i);
});

test('reveal checks real owner, consent, quest, and occurrence under locks', () => {
  assert.match(sql, /owner_id = p_owner_id/i);
  assert.match(sql, /origin = 'izzy'/i);
  assert.match(sql, /consent_at is not null/i);
  assert.match(sql, /consent_revoked_at is null/i);
  assert.match(sql, /quest_id = v_assignment\.quest_id/i);
  assert.match(sql, /for update/gi);
});

test('reveal is overdue-only, excludes completed or deferred quests and never awards XP', () => {
  assert.match(sql, /pg_catalog\.now\(\) > v_assignment\.deadline_at/i);
  assert.match(sql, /v_instance\.status = 'available'/i);
  assert.match(sql, /v_curse\.deadline_at = v_assignment\.deadline_at/i);
  assert.doesNotMatch(sql, /\bupdate\s+public\.xp_ledger\b/i);
});

test('sealed and resolved consequences never leave the RPC', () => {
  assert.match(sql, /if v_curse\.state <> 'revealed' then return;/i);
  assert.match(sql, /where id = p_curse_id and assignment_id is not null/i);
});
