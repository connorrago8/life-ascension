import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const api=readFileSync(new URL('../app/api/izzy/setup/route.ts',import.meta.url),'utf8');
const ui=readFileSync(new URL('../components/izzy/review-inbox.tsx',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/202611020002_izzy_companion_registration.sql',import.meta.url),'utf8');
test('setup requires affirmative consent and authenticated user',()=>{
 assert.match(api,/confirmedConsent!==true/);
 assert.match(api,/auth\.getUser\(\)/);
 assert.match(api,/p_owner_id:data\.user\.id/);
});
test('setup links verified submission and companion through trusted RPCs',()=>{
 assert.match(api,/register_consented_izzy_companion/);
 assert.match(api,/link_verified_izzy_weekly_submission/);
 assert.match(sql,/consent_confirmed_at/);
 assert.match(sql,/revoke all on function public\.register_consented_izzy_companion/);
});
test('user must check consent before setup button is enabled',()=>{
 assert.match(ui,/checked=\{consentConfirmed\}/);
 assert.match(ui,/disabled=\{!consentConfirmed\|\|setupBusy\}/);
});
