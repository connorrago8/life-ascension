import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/202611010005_izzy_approved_assignment_links.sql', import.meta.url), 'utf8');

test('approved assignments bind to owner, quest, occurrence, and proposal', () => {
  assert.match(sql, /owner_id uuid not null references auth\.users\(id\)/i);
  assert.match(sql, /quest_instance_id uuid not null unique/i);
  assert.match(sql, /proposal_id uuid not null unique references public\.izzy_submission_proposals\(id\)/i);
  assert.match(sql, /unique \(id, owner_id, quest_id, quest_instance_id\)/i);
});

test('approved assignment records are not client-readable', () => {
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on public\.izzy_approved_assignments from anon, authenticated/i);
});

test('curse association is unique and legacy nulls are not treated as verified', () => {
  assert.match(sql, /add column if not exists assignment_id uuid/i);
  assert.match(sql, /references public\.izzy_approved_assignments\(id\)/i);
  assert.match(sql, /unique[\s\S]*on public\.izzy_secret_curses\(assignment_id\)/i);
  assert.match(sql, /where assignment_id is not null/i);
});
