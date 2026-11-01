import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/202611010006_izzy_assignment_integrity.sql', import.meta.url), 'utf8');

test('migration refuses missing quest ownership schema', () => {
  assert.match(sql, /to_regclass\('public\.quest_instances'\)/i);
  assert.match(sql, /column_name='owner_id'/i);
  assert.match(sql, /column_name='quest_id'/i);
  assert.match(sql, /raise exception/i);
});

test('assignment must match the real owner and quest occurrence', () => {
  assert.match(sql, /on public\.quest_instances\(id, owner_id, quest_id\)/i);
  assert.match(sql, /foreign key \(quest_instance_id, owner_id, quest_id\)/i);
  assert.match(sql, /references public\.quest_instances\(id, owner_id, quest_id\)/i);
});

test('curse cannot claim a different quest than its approved assignment', () => {
  assert.match(sql, /foreign key \(assignment_id, quest_id\)/i);
  assert.match(sql, /references public\.izzy_approved_assignments\(id, quest_id\)/i);
});
