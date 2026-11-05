import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { QA_BASELINE_FUNCTION_SHA256, QA_PROJECT_REF, verifyQaAtomicClearPreflight } from '../scripts/verify-qa-atomic-clear-preflight.mjs';

const ownerPolicy = { name: 'read', cmd: 'SELECT', roles: ['authenticated'], qual: '(owner_id = ( SELECT auth.uid() AS uid))' };
function snapshot() {
  return {
    function_sha256: QA_BASELINE_FUNCTION_SHA256,
    atomic_clear_present: false,
    authenticated_exec: true,
    anon_exec: false,
    tables: ['quests', 'quest_instances', 'quest_progress_operations'].map(table_name => ({
      table_name, rls_enabled: true, policies: [{ ...ownerPolicy }],
    })),
  };
}
function denied(modify, expected) {
  const state = snapshot();
  modify(state);
  const result = verifyQaAtomicClearPreflight(QA_PROJECT_REF, state);
  assert.equal(result.ok, false);
  assert.match(result.blockers.join(' '), expected);
}

test('exact reviewed QA catalog passes as a preflight, not authorization', () => {
  assert.deepEqual(verifyQaAtomicClearPreflight(QA_PROJECT_REF, snapshot()), { ok: true, blockers: [] });
});
test('wrong project cannot reuse QA preflight', () => {
  assert.match(verifyQaAtomicClearPreflight('ugcvhmrriazbbymjxvch', snapshot()).blockers.join(' '), /not the approved QA project/);
});
test('hosted function drift fails closed', () => denied(s => { s.function_sha256 = '0'.repeat(64); }, /differs/));
test('already-applied or unknown Clear state fails closed', () => {
  denied(s => { s.atomic_clear_present = true; }, /already present/);
  denied(s => { delete s.atomic_clear_present; }, /already present/);
});
test('privileged anonymous execute grant fails closed', () => denied(s => { s.anon_exec = true; }, /execute grants/));
test('missing authenticated execute grant fails closed', () => denied(s => { s.authenticated_exec = false; }, /execute grants/));
test('missing table and disabled RLS fail closed', () => {
  denied(s => { s.tables.pop(); }, /missing table/);
  denied(s => { s.tables[0].rls_enabled = false; }, /RLS disabled/);
});
test('extra permissive owner-bypass policy fails closed', () => denied(s => {
  s.tables[0].policies.push({ name: 'bad', cmd: 'SELECT', roles: ['public'], qual: 'true' });
}, /not the reviewed owner filter/));
test('missing authenticated owner policy fails closed', () => denied(s => { s.tables[0].policies = []; }, /missing authenticated owner policy/));
test('unreviewed policy expression fails closed', () => denied(s => { s.tables[0].policies[0].qual = '(owner_id IS NOT NULL)'; }, /not the reviewed owner filter/));
test('missing or malformed catalog evidence fails closed', () => {
  assert.equal(verifyQaAtomicClearPreflight(QA_PROJECT_REF, null).ok, false);
  denied(s => { delete s.tables; }, /catalog evidence missing/);
});
test('CLI reads stdin and never echoes an injected credential', () => {
  const cmd = new URL('../scripts/verify-qa-atomic-clear-preflight.mjs', import.meta.url);
  const ok = spawnSync(process.execPath, [cmd.pathname, QA_PROJECT_REF], { input: JSON.stringify(snapshot()), encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /^PASS:/);
  const state = { ...snapshot(), function_sha256: 'secret_DO_NOT_PRINT' };
  const bad = spawnSync(process.execPath, [cmd.pathname, QA_PROJECT_REF], { input: JSON.stringify(state), encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /^BLOCKED:/);
  assert.doesNotMatch(bad.stderr, /secret_DO_NOT_PRINT/);
});
