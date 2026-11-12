import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/202611120001_couple_features.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../supabase/rollbacks/202611120001_couple_features_down.sql', import.meta.url), 'utf8');

test('couple features migration is additive, RLS-scoped, and reversible', () => {
  assert.match(migration, /companion_xp integer not null default 10/);
  assert.match(migration, /values \(true, 10\)/);
  assert.match(migration, /_award_personal_quest_xp/);
  assert.match(migration, /source_key text not null unique/);
  assert.match(migration, /primary key \(owner_id, month_key\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /b\.status = 'active'/);
  assert.match(rollback, /drop table if exists public\.couple_quests/);
  assert.match(rollback, /drop table if exists public\.companion_xp_ledger/);
  assert.match(rollback, /drop table if exists public\.streak_shields/);
  assert.match(rollback, /while public\.quest_has_completion_on/);
  assert.doesNotMatch(rollback, /streak_shields s/);
});
