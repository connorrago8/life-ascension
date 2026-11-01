import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const baseline = readFileSync(new URL('./fixtures/qa-log-progress-baseline.sql', import.meta.url), 'utf8');
const patch = readFileSync(new URL('../docs/sql/qa-atomic-clear-function-only-review.sql', import.meta.url), 'utf8');
const original = `if p_delta < 0 and p_delta <> -v_quest.progress_increment then\n    raise exception 'Undo must reverse one default increment';\n  end if;`;
const replacement = `if p_delta < 0\n     and p_delta <> -v_quest.progress_increment\n     and p_delta <> -v_inst.current_amount then\n    raise exception 'Undo must reverse one increment or clear current progress';\n  end if;`;
const functionSql = patch.slice(patch.indexOf('CREATE OR REPLACE FUNCTION'), patch.indexOf('$function$;') + '$function$;'.length);

test('hosted baseline has exactly one original undo guard', () => {
  assert.equal(baseline.split(original).length - 1, 1);
});
test('candidate function differs from read-only QA baseline ONLY by atomic Clear guard', () => {
  assert.equal(functionSql, baseline.replace(original, replacement).trimEnd() + ';');
});
test('Clear is negative current amount; single-step undo is preserved', () => {
  assert.match(functionSql, /p_delta <> -v_inst\.current_amount/);
  assert.match(functionSql, /p_delta <> -v_quest\.progress_increment/);
});
test('owner-scoped lock and request-ID replay stay intact', () => {
  assert.match(functionSql, /pg_advisory_xact_lock\(v_lock\)/);
  assert.match(functionSql, /where owner_id = v_user and request_id = p_request_id/);
  assert.match(functionSql, /Request ID reused with different payload/);
  assert.match(functionSql, /where id = p_instance_id and owner_id = v_user for update/);
});
test('completion and Chicago eligibility remain unchanged', () => {
  assert.match(functionSql, /America\/Chicago/);
  assert.match(functionSql, /public\.set_quest_instance_status\(v_inst\.id, 'complete'\)/);
  assert.doesNotMatch(functionSql, /insert into public\.xp_ledger/i);
});
test('SECURITY DEFINER and empty search_path remain intact', () => {
  assert.match(functionSql, /SECURITY DEFINER/);
  assert.match(functionSql, /SET search_path TO ''/);
});
test('authenticated-only RPC grant remains explicit', () => {
  assert.match(patch, /REVOKE ALL ON FUNCTION public\.log_quest_progress\(uuid,uuid,integer\) FROM public, anon;/);
  assert.match(patch, /GRANT EXECUTE ON FUNCTION public\.log_quest_progress\(uuid,uuid,integer\) TO authenticated;/);
});
test('review-only SQL does not alter tables, policies, indexes or other functions', () => {
  const statements = patch.replace(/^--.*$/gm, '');
  assert.doesNotMatch(statements, /\b(?:ALTER|DROP|TRUNCATE|DELETE|CREATE TABLE|CREATE INDEX|CREATE POLICY)\b/i);
  assert.equal((statements.match(/CREATE OR REPLACE FUNCTION/gi) || []).length, 1);
});
