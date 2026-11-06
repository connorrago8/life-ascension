import test from 'node:test';
import assert from 'node:assert/strict';
import {questDayKey,awardCredits} from '../../lib/quests/companion-credit.ts';
// Pure helper contracts only; these do not establish a database XP exploit.
test('valid leap-day key remains usable',()=>assert.equal(questDayKey('connor','habit','2028-02-29'),'connor:2028-02-29:habit'));
for(const date of ['2026-02-30','2026-02-29','2026-13-01']) test('reject impossible accounting date '+date,()=>{
 assert.throws(()=>awardCredits([{id:'fixture',actor:'connor',questKey:'habit',localDate:date,source:'personal',completed:true}]),/Invalid local date/);
});
