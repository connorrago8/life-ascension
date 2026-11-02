import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const link = readFileSync(new URL('../supabase/migrations/202611010009_izzy_companion_identity.sql', import.meta.url), 'utf8');
const award = readFileSync(new URL('../supabase/migrations/202611010010_izzy_companion_xp_gate.sql', import.meta.url), 'utf8');

test('approved Izzy record must match existing companion assignment owner and quest', () => {
  assert.match(link, /foreign key \(companion_assignment_id, owner_id, quest_id\)/i);
  assert.match(link, /references public\.quest_companion_assignments\(id, owner_id, quest_id\)/i);
});

test('bonus XP requires active existing companion assignment and confirmed consent', () => {
  assert.match(award, /a\.companion_assignment_id/i);
  assert.match(award, /ca\.active = true/i);
  assert.match(award, /c\.consent_confirmed_at is not null/i);
  assert.match(award, /a\.consent_revoked_at is null/i);
  assert.match(award, /v_amount := 2/i);
});

test('ordinary XP and exactly-once ledger insertion remain unchanged', () => {
  assert.match(award, /v_amount integer := 1/i);
  assert.match(award, /on conflict \(instance_id\) do nothing/i);
});
