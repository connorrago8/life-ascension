import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyQaPreviewEnvMetadata, PROTECTED_QA_BRANCH } from '../scripts/verify-qa-preview-env-metadata.mjs';

const item = (key, target, gitBranch = null) => ({ key, target, gitBranch, value: 'SECRET_MUST_NEVER_LOG' });
const good = () => ({ result: { envs: [
  item('NEXT_PUBLIC_SUPABASE_URL', ['preview'], PROTECTED_QA_BRANCH),
  item('NEXT_PUBLIC_SUPABASE_ANON_KEY', ['preview'], PROTECTED_QA_BRANCH),
  item('SUPABASE_PUBLIC_KEY_SHA256', ['preview'], PROTECTED_QA_BRANCH),
  item('NEXT_PUBLIC_SUPABASE_URL', ['production', 'preview']),
  item('NEXT_PUBLIC_SUPABASE_ANON_KEY', ['production', 'preview']),
  item('SUPABASE_SERVICE_ROLE_KEY', ['production']),
] } });
const check = s => verifyQaPreviewEnvMetadata(s);

test('allows exact protected QA overrides while identifying result as metadata-only', () => {
  assert.deepEqual(check(good()), { ok: true, metadata_only: true, runtime_verified: false, blockers: [] });
});
test('rejects missing independent public-key fingerprint pin', () => {
  const s = good(); s.result.envs.splice(2, 1); assert.equal(check(s).ok, false);
});
test('rejects duplicated QA branch override', () => {
  const s = good(); s.result.envs.push(item('NEXT_PUBLIC_SUPABASE_URL', ['preview'], PROTECTED_QA_BRANCH));
  assert.equal(check(s).ok, false);
});
test('rejects privileged Preview service-role key on QA branch', () => {
  const s = good(); s.result.envs.push(item('SUPABASE_SERVICE_ROLE_KEY', ['preview'], PROTECTED_QA_BRANCH));
  assert.equal(check(s).ok, false);
});
test('rejects privileged unscoped Preview key', () => {
  const s = good(); s.result.envs.push(item('SUPABASE_SECRET_KEY', ['preview']));
  assert.equal(check(s).ok, false);
});
test('rejects Preview database connection strings', () => {
  const s = good(); s.result.envs.push(item('DATABASE_URL', ['preview']));
  assert.equal(check(s).ok, false);
});
test('rejects protected branch overrides targeting Production', () => {
  const s = good(); s.result.envs[0].target = ['production', 'preview'];
  assert.equal(check(s).ok, false);
});
test('rejects wrong branch even when QA overrides exist', () => {
  assert.equal(verifyQaPreviewEnvMetadata(good(), 'beta/quest-ui-clean-review').ok, false);
});
test('rejects malformed metadata', () => {
  assert.equal(check({ envs: 'not an array' }).ok, false);
  const s = good(); s.result.envs[0].target = 'preview'; assert.equal(check(s).ok, false);
});
test('rejects shared fallback without exact QA overrides', () => {
  const s = good(); s.result.envs = s.result.envs.filter(e => !e.gitBranch);
  assert.equal(check(s).ok, false);
});
test('never returns secret values or treats metadata as runtime proof', () => {
  const result = check(good()); assert.equal(result.runtime_verified, false);
  assert.doesNotMatch(JSON.stringify(result), /SECRET_MUST_NEVER_LOG/);
});
test('does not accept prefix-matched branch as QA override', () => {
  const s = good(); s.result.envs[0].gitBranch += '-other';
  assert.equal(check(s).ok, false);
});
