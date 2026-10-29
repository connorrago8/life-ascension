import test from 'node:test';
import assert from 'node:assert/strict';
import { questDetailFacts } from '../lib/preview/questDetailFacts.mjs';
const quest = {domain:'home',cadence:'daily',quest_type:'scheduled',target_amount:8,progress_increment:3,progress_unit:'glasses'};
const instance = {due_date:'2026-10-29',status:'available',current_amount:2};
const step = (i={}) => questDetailFacts(quest,{...instance,...i}).find(f=>f.label==='Quick-add step')?.value;
test('available tracked quest shows configured step when within bounds',()=>assert.equal(step(),'3 glasses'));
test('available near goal shows remaining step, never overstates quantity',()=>assert.equal(step({current_amount:7}),'1 glasses'));
test('completed and deferred quests do not suggest actionable quick add',()=>{
 assert.equal(step({status:'completed',current_amount:8}),undefined);
 assert.equal(step({status:'deferred'}),undefined);
});
test('invalid or inconsistent progress cannot suggest a quick-add operation',()=>{
 for(const current_amount of [undefined,null,-1,8,9,1.5])assert.equal(step({current_amount}),undefined,String(current_amount));
 assert.equal(step({status:'unknown'}),undefined);
});
