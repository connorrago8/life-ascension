import test from 'node:test';
import assert from 'node:assert/strict';
import { questDetailFacts } from '../lib/preview/questDetailFacts.mjs';
const quest={domain:'home',cadence:'daily',quest_type:'scheduled',target_amount:8,progress_increment:1,progress_unit:'glasses'};
const due = due_date => questDetailFacts(quest,{due_date,status:'available',current_amount:3}).find(x=>x.label==='Due date')?.value;
test('does not show impossible or untrusted date as verified due date',()=>{
 for(const value of ['2026-02-30','2025-02-29','2026-13-01','2026-00-01','2026-10-29T05:00:00Z','bogus'])
  assert.equal(due(value),'Unavailable — refresh to verify',value);
});
test('keeps real ISO calendar days including leap day without timezone conversion',()=>{
 for(const value of ['2024-02-29','2026-10-29','2026-12-31'])assert.equal(due(value),value);
});
