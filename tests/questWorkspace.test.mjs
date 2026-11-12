import test from 'node:test';
import assert from 'node:assert/strict';
import {QUEST_AREAS,parseQuestArea,parseQuestView,taskArea,prioritizePending,questWorkspaceHref} from '../lib/questWorkspace.ts';
test('four clear categories with a safe default and stable direct links',()=>{
 assert.deepEqual(QUEST_AREAS.map(a=>a.id),['life','izzy','work','together']);
 for(const value of [null,'other','//outside.example','<script>'])assert.equal(parseQuestArea(value),'life');
 assert.equal(parseQuestView('done'),'done');assert.equal(parseQuestView('all'),'today');
 assert.equal(questWorkspaceHref('work','week'),'/quests?area=work&view=week');
});
test('source membership wins over domain, and every personal task belongs to exactly one category',()=>{
 const fromIzzy=new Set(['assigned-career','assigned-home']);
 const cases=[['home','home','life'],['health','physical_health','life'],['finances','finance','life'],['weekly','career','work'],['assigned-career','career','izzy'],['assigned-home','home','izzy']];
 for(const [id,domain,expected]of cases)assert.equal(taskArea({id,domain},fromIzzy),expected);
});
test('pagination keeps every pending save reachable without mutating the original list',()=>{
 const rows=Array.from({length:15},(_,i)=>({instance:{id:String(i)}}));
 const page=prioritizePending(rows,['12','14'],6);
 assert.deepEqual(page.map(r=>r.instance.id),['12','14','0','1','2','3','4','5']);
 assert.equal(rows[0].instance.id,'0');
});
