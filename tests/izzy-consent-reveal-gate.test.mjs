import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const reveal = readFileSync(new URL('../supabase/migrations/202611010011_izzy_companion_curse_gate.sql', import.meta.url), 'utf8');
const consent = readFileSync(new URL('../supabase/migrations/202611010012_izzy_consent_timing_fix.sql', import.meta.url), 'utf8');

test('curse reveal requires active existing companion identity and consent', () => {
  assert.match(reveal, /ca\.id = a\.companion_assignment_id/i);
  assert.match(reveal, /ca\.active = true/i);
  assert.match(reveal, /c\.consent_confirmed_at is not null/i);
  assert.match(reveal, /a\.consent_revoked_at is null/i);
  assert.match(reveal, /v_instance\.status = 'available'/i);
});
test('privileged reveal stays inaccessible to browser roles', () => {
  assert.match(reveal, /revoke all on function public\.reveal_due_izzy_secret_curse\(uuid,uuid\)[\s\S]*from public, anon, authenticated/i);
});
test('approval then consent is permitted; revocation cannot precede consent', () => {
  assert.match(consent, /drop constraint if exists izzy_assignment_consent_time/i);
  assert.match(consent, /consent_revoked_at >= consent_at/i);
});
