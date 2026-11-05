import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { questDetailFacts } from '../lib/preview/questDetailFacts.mjs';

const tracked = {
  title: 'Drink water', domain: 'physical_health', cadence: 'daily', quest_type: 'scheduled',
  target_amount: 8, progress_increment: 2, progress_unit: 'glasses',
};
const instance = { due_date: '2026-10-29', status: 'available', current_amount: 3 };

test('tracked quest shows actual objective, quick step and persisted partial amount', () => {
  const facts = questDetailFacts(tracked, instance);
  assert.deepEqual(facts, [
    {label:'Category',value:'Physical health'},
    {label:'Schedule',value:'Daily'},
    {label:'Due date',value:'2026-10-29'},
    {label:'Status',value:'Available'},
    {label:'Objective',value:'8 glasses'},
    {label:'Quick-add step',value:'2 glasses'},
    {label:'Recorded progress',value:'3 of 8 glasses'},
  ]);
  assert.equal(facts.some(f => /XP|reward/i.test(f.value)), false);
});

test('completed, deferred and goal details reflect real account row, not assumed rewards', () => {
  const done = questDetailFacts({...tracked, quest_type:'goal'}, {...instance,status:'completed',current_amount:8});
  assert.deepEqual(done.find(f=>f.label==='Status'),{label:'Status',value:'Completed'});
  assert.deepEqual(done.find(f=>f.label==='Goal date'),{label:'Goal date',value:'2026-10-29'});
  assert.deepEqual(done.find(f=>f.label==='Recorded progress'),{label:'Recorded progress',value:'8 of 8 glasses'});
  const deferred = questDetailFacts(tracked,{...instance,status:'deferred'});
  assert.deepEqual(deferred.find(f=>f.label==='Status'),{label:'Status',value:'Deferred'});
});

test('untracked quests explain one-tap objective and do not invent partial progress', () => {
  const facts = questDetailFacts({...tracked,cadence:'once',target_amount:null,progress_increment:null,progress_unit:null},instance);
  assert.deepEqual(facts.find(f=>f.label==='Objective'),{label:'Objective',value:'Complete this quest once'});
  assert.equal(facts.some(f=>f.label==='Recorded progress'),false);
});

test('invalid or missing persisted amount never renders a fabricated progress quantity', () => {
  for (const amount of [undefined, null, -1, 9, 1.5, '3']) {
    const facts = questDetailFacts(tracked,{...instance,current_amount:amount});
    assert.deepEqual(facts.find(f=>f.label==='Recorded progress'),
      {label:'Recorded progress',value:'Unavailable — refresh to verify'});
  }
});

test('component uses native accessible details and labels sourced from the fact helper', () => {
  const ui=readFileSync(new URL('../components/QuestDetails.tsx',import.meta.url),'utf8');
  assert.match(ui, /<details className="quest-card-details">/);
  assert.match(ui, /<summary aria-label=/);
  assert.match(ui, /<dl>/);
  assert.match(ui, /<dt>\{fact\.label\}<\/dt>/);
  assert.match(ui, /<dd>\{fact\.value\}<\/dd>/);
  assert.doesNotMatch(ui, /awardXp|levelFor|set_quest_instance_status/);
});


test('daily untracked objectives do not claim the quest is one-time', () => {
  const facts = questDetailFacts({...tracked,target_amount:null,progress_increment:null,progress_unit:null},instance);
  assert.deepEqual(facts.find(f=>f.label==='Objective'),
    {label:'Objective',value:"Complete today's quest"});
});

test('partially corrupted tracking config fails closed instead of promising one-tap completion', () => {
  for (const partial of [
    {target_amount:8,progress_increment:null,progress_unit:'glasses'},
    {target_amount:null,progress_increment:2,progress_unit:'glasses'},
    {target_amount:8,progress_increment:2,progress_unit:null},
    {target_amount:8,progress_increment:9,progress_unit:'glasses'},
    {target_amount:0,progress_increment:1,progress_unit:'glasses'},
  ]) {
    const facts=questDetailFacts({...tracked,...partial},instance);
    assert.deepEqual(facts.find(f=>f.label==='Objective'),
      {label:'Objective',value:'Tracking configuration unavailable — refresh to verify'});
    assert.equal(facts.some(f=>f.label==='Quick-add step'||f.label==='Recorded progress'),false);
  }
});

test('untracked goal describes a goal, not a one-time quest or daily task', () => {
  const goal = {...tracked,quest_type:'goal',target_amount:null,progress_increment:null,progress_unit:null};
  const facts = questDetailFacts(goal,instance);
  assert.deepEqual(facts.find(f=>f.label==='Objective'),{label:'Objective',value:'Complete this goal'});
});

test('tracked progress at target but server status still available is not displayed as confirmed', () => {
  const facts = questDetailFacts(tracked, {...instance,status:'available',current_amount:8});
  assert.deepEqual(facts.find(f=>f.label==='Recorded progress'),
    {label:'Recorded progress',value:'Unavailable — refresh to verify'});
});

test('completed tracked instance with incomplete amount is not shown as a coherent completed target', () => {
  const facts = questDetailFacts(tracked, {...instance,status:'completed',current_amount:3});
  assert.deepEqual(facts.find(f=>f.label==='Recorded progress'),
    {label:'Recorded progress',value:'Unavailable — refresh to verify'});
});
