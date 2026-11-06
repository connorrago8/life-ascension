import test from 'node:test';
import assert from 'node:assert/strict';
import { homeFixtureSql } from './browser/home-fixture-sql.mjs';
const url = path => new URL(path, 'http://127.0.0.1:54329');
test('Home fixture executes bounded RLS SELECTs and known RPCs only', () => {
 assert.match(homeFixtureSql('GET', url('/rest/v1/quests?select=id,title&active=eq.true&order=created_at.asc')), /from public.quests where active = true order by created_at asc limit 1000/);
 assert.equal(homeFixtureSql('POST', url('/rest/v1/rpc/get_lifetime_xp')), 'select to_jsonb(public.get_lifetime_xp());');
 assert.match(homeFixtureSql('POST', url('/rest/v1/rpc/create_scheduled_quest'), {p_title:"Walk; 'not SQL'",p_domain:'home',p_cadence:'once',p_date:'2026-11-05',p_quest_type:'goal'}), /'Walk; ''not SQL'''/);
});
test('Home fixture rejects arbitrary tables, SQL fragments, mutations and forged arguments', () => {
 for (const path of ['/rest/v1/xp_ledger?select=amount', '/rest/v1/quests?select=title%3Bdelete', '/rest/v1/quests?select=id&order=id.desc', '/rest/v1/quest_instances?select=id&owner_id=eq.anything', '/rest/v1/quest_instances?select=id&quest_id=in.(abc)', '/rest/v1/quests?select=id&limit=1001']) assert.throws(() => homeFixtureSql('GET', url(path)));
 assert.throws(() => homeFixtureSql('DELETE', url('/rest/v1/quests?select=id')));
 assert.throws(() => homeFixtureSql('POST', url('/rest/v1/rpc/get_lifetime_xp'), {owner_id:'forged'}));
 assert.throws(() => homeFixtureSql('POST', url('/rest/v1/rpc/arbitrary_sql')));
});
