import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('../supabase/migrations/202611010008_izzy_exactly_once_xp.sql', import.meta.url), 'utf8');

test('retains existing completion helper signature and base XP semantics', () => {
  assert.match(sql, /function public\._award_quest_xp\(p_owner uuid, p_instance uuid\)/i);
  assert.match(sql, /v_amount integer := 1/i);
  assert.match(sql, /values \(p_owner, p_instance, v_amount, 1, null, null\)/i);
});

test('only consented approved Izzy instance gets +2', () => {
  assert.match(sql, /a\.quest_instance_id = p_instance/i);
  assert.match(sql, /a\.owner_id = p_owner/i);
  assert.match(sql, /a\.origin = 'izzy'/i);
  assert.match(sql, /a\.consent_at is not null/i);
  assert.match(sql, /a\.consent_revoked_at is null/i);
  assert.match(sql, /v_amount := 2/i);
});

test('ledger uniqueness prevents duplicate award', () => {
  assert.match(sql, /on conflict \(instance_id\) do nothing/i);
  assert.match(sql, /'amount', case when v_id is null then 0 else v_amount end/i);
});
