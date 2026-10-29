import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('QA index migration includes all six expected FK covering indexes', () => {
  const sql = read('../docs/sql/qa-foreign-key-indexes-2026-10-27.sql');
  const expected = [
    'quest_events(instance_id, owner_id)',
    'quest_instances(quest_id, owner_id)',
    'quest_progress(instance_id)',
    'quest_progress(quest_id, user_id)',
    'quest_progress_operations(instance_id, owner_id)',
    'xp_ledger(instance_id, owner_id)',
  ];
  for (const clause of expected) assert.ok(sql.includes(clause), `missing index: ${clause}`);
  assert.equal((sql.match(/CREATE INDEX IF NOT EXISTS/g) || []).length, expected.length);
});

test('QA release gate explicitly protects production and requires XP verification', () => {
  const audit = read('../docs/qa-isolation-and-reliability-audit-2026-10-27.md');
  assert.match(audit, /production only/i);
  assert.match(audit, /preview-only/i);
  assert.match(audit, /exactly-once XP/i);
  assert.match(audit, /two-user isolation/i);
});
