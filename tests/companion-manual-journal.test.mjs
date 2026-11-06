import test from 'node:test';
import assert from 'node:assert/strict';
import {moveJournalWeek,journalError} from '../lib/companion/manual-journal.ts';
test('manual journal weeks remain Monday-based across Chicago DST and year boundaries',()=>{
 assert.equal(moveJournalWeek('2026-10-26',1),'2026-11-02');
 assert.equal(moveJournalWeek('2026-11-02',-1),'2026-10-26');
 assert.equal(moveJournalWeek('2025-12-29',-1),'2025-12-22');
 assert.throws(()=>moveJournalWeek('2026-02-30',1));assert.throws(()=>moveJournalWeek('2026-11-02',2));
});
test('manual journal never renders raw database exception detail',()=>{
 assert.equal(journalError('P0001','This activity is already logged for that day'),'This activity is already logged for that day');
 assert.ok(!journalError('P0001','private SQL detail').includes('private SQL detail'));
 assert.match(journalError('42P01','private table missing'),/Neither account’s XP was changed/);
});
