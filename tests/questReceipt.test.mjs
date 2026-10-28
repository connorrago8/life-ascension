import assert from 'node:assert/strict';
import test from 'node:test';
import {questReceipt,calendarDateOffset} from '../lib/questReceipt.ts';
const base={schema_version:1,quest_instance_id:'i',status:'completed',quest_completion_confirmed:true,reward_confirmed:true,xp_awarded:1,reward_status:'awarded',reward_awarded_at:'2026-10-27T20:00:00Z'};
test('receipt binds completion and new XP to the exact occurrence',()=>{
 assert.ok(questReceipt(base,'i'));assert.equal(questReceipt(base,'other'),null);
 for(const patch of [{schema_version:2},{xp_awarded:2},{reward_confirmed:false},{quest_completion_confirmed:false},{status:'available'},{reward_awarded_at:null},{reward_status:'already_awarded'}])assert.equal(questReceipt({...base,...patch},'i'),null);
 assert.equal(questReceipt('completed','i'),null);
});
test('lost-response retry confirms previous reward with zero new XP',()=>{
 const duplicate={...base,xp_awarded:0,reward_status:'already_awarded'};
 assert.ok(questReceipt(duplicate,'i'));
 assert.equal(questReceipt({...duplicate,reward_confirmed:false},'i'),null);
 assert.ok(questReceipt({...base,xp_awarded:0,reward_status:'not_awarded',reward_confirmed:false,reward_awarded_at:null},'i'));
});
test('calendar additions preserve Chicago date anchors across DST, months and years',()=>{
 assert.equal(calendarDateOffset('2026-03-01',7),'2026-03-08');
 assert.equal(calendarDateOffset('2026-10-25',14),'2026-11-08');
 assert.equal(calendarDateOffset('2026-12-28',7),'2027-01-04');
});
