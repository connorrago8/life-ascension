import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/202611020001_izzy_six_quest_batch.sql',import.meta.url),'utf8');
const api=readFileSync(new URL('../app/api/izzy/proposals/route.ts',import.meta.url),'utf8');
const ui=readFileSync(new URL('../components/izzy/review-inbox.tsx',import.meta.url),'utf8');
test('six-quest batch requires all six owner-linked proposals and uses atomic approval',()=>{
 assert.match(sql,/array_length\(v_ids,1\),0\)<>6/);
 assert.match(sql,/o\.owner_id=p_owner_id/);
 assert.match(sql,/approve_owned_izzy_proposal/);
 assert.match(sql,/grant execute on function public\.approve_izzy_weekly_batch/);
});
test('approval route derives owner from authenticated identity and offers consented companions',()=>{
 assert.match(api,/p_owner_id: data\.user\.id/);
 assert.match(api,/approve_izzy_weekly_batch/);
 assert.match(api,/consent_confirmed_at/);
});
test('founder can select companion by name and approve all six',()=>{
 assert.match(ui,/<select id="izzy-companion-id"/);
 assert.match(ui,/Approve all six Izzy quests/);
 assert.match(ui,/approve\('all'\)/);
});
