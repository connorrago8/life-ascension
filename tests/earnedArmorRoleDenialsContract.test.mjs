import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('./sql/earned_armor_role_denials.sql', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/build.yml', import.meta.url), 'utf8');

test('role-denial SQL is explicitly disposable and verifies the nonempty two-owner fixture', () => {
  assert.match(sql, /Disposable PostgreSQL only/);
  assert.match(sql, /Armor role-denial fixture not ready/);
  assert.match(sql, /Denied role operations altered equipment fixture/);
  assert.match(sql, /ea01/);
  assert.match(sql, /ea02/);
});

test('anonymous gear read and equip RPC calls must fail with insufficient_privilege', () => {
  assert.match(sql, /SET ROLE anon;[\s\S]*?PERFORM public\.get_earned_gear\(\)/);
  assert.match(sql, /PERFORM public\.equip_earned_armor\('ashen-hood', true\)/);
  assert.equal((sql.match(/EXCEPTION WHEN insufficient_privilege THEN denied := true;/g) || []).length, 8);
});

test('authenticated direct INSERT/UPDATE/DELETE on both armor tables must be denied', () => {
  assert.match(sql, /SET ROLE authenticated;[\s\S]*?UPDATE public\.owned_equipment/);
  assert.match(sql, /DELETE FROM public\.equipped_equipment/);
  assert.match(sql, /INSERT INTO public\.owned_equipment/);
  assert.match(sql, /DELETE FROM public\.owned_equipment/);
  assert.match(sql, /UPDATE public\.equipped_equipment/);
  assert.match(sql, /INSERT INTO public\.equipped_equipment/);
  assert.equal((sql.match(/IF NOT denied THEN RAISE EXCEPTION/g) || []).length, 8);
});

test('CI invokes denials on disposable armor clone only after the existing smoke', () => {
  const smoke = workflow.indexOf('psql -v ON_ERROR_STOP=1 -d life_ascension_armor_test -f tests/sql/earned_armor_smoke.sql');
  const denial = workflow.indexOf('psql -v ON_ERROR_STOP=1 -d life_ascension_armor_test -f tests/sql/earned_armor_role_denials.sql');
  assert.ok(smoke >= 0 && denial > smoke, 'missing or misordered disposable armor tests');
  assert.equal(workflow.match(/tests\/sql\/earned_armor_role_denials\.sql/g)?.length, 1);
});
