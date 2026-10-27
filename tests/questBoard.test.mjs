import assert from 'node:assert/strict';
import test from 'node:test';
import { chicagoDay, dailyHighlights, groupJournal } from '../lib/questBoard.ts';

const day = '2026-10-27';
function storage() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }; }
function candidate(id, overrides = {}) {
  return { id, dueDate: day, createdAt: '2026-10-01T00:00:00Z', classification: 'side', status: 'available', eligible: true, ...overrides };
}
test('due date outranks Main; equal dates use classification, creation, ID', () => {
  const rows = [candidate('z'), candidate('main', { classification: 'main' }),
    candidate('old', { dueDate: '2026-10-26' }), candidate('a')];
  assert.deepEqual(dailyHighlights(storage(), 'u', day, rows).ids, ['old', 'main', 'a']);
  assert.deepEqual(dailyHighlights(storage(), 'u', day, [candidate('a'), candidate('z', { createdAt: '2026-09-01' })]).ids, ['z', 'a']);
});
test('no filler, duplicates, future, deferred, completed or ineligible occurrences', () => {
  const rows = [candidate('ok'), candidate('ok'), candidate('future', { dueDate: '2026-10-28' }),
    candidate('done', { status: 'completed' }), candidate('later', { status: 'deferred' }), candidate('expired', { eligible: false })];
  assert.deepEqual(dailyHighlights(storage(), 'u', day, rows).ids, ['ok']);
});
test('completion, refresh, new quests and classification changes never refill today', () => {
  const saved = storage();
  dailyHighlights(saved, 'u', day, [candidate('one')]);
  assert.deepEqual(dailyHighlights(saved, 'u', day, [candidate('one', { status: 'completed' }), candidate('two')]).ids, ['one']);
  assert.deepEqual(dailyHighlights(saved, 'u', day, []).ids, ['one']);
  assert.deepEqual(dailyHighlights(saved, 'u', '2026-10-28', [candidate('two')]).ids, ['two']);
  assert.deepEqual(dailyHighlights(saved, 'other', day, [candidate('two')]).ids, ['two']);
});
test('empty selection remains empty across refresh; unavailable storage fails closed', () => {
  const saved = storage(); dailyHighlights(saved, 'u', day, []);
  assert.deepEqual(dailyHighlights(saved, 'u', day, [candidate('new')]).ids, []);
  assert.throws(() => dailyHighlights({ getItem: () => '{', setItem() {} }, 'u', day, []));
  assert.throws(() => dailyHighlights({ getItem: () => null, setItem() { throw Error('quota'); } }, 'u', day, []));
});
test('Chicago day respects midnight and both DST transitions', () => {
  assert.equal(chicagoDay(new Date('2026-10-28T04:59:59Z')), '2026-10-27');
  assert.equal(chicagoDay(new Date('2026-10-28T05:00:00Z')), '2026-10-28');
  assert.equal(chicagoDay(new Date('2026-11-01T07:30:00Z')), '2026-11-01');
  assert.equal(chicagoDay(new Date('2026-03-08T08:30:00Z')), '2026-03-08');
});
test('Journal uses completion date, preserves missing reward evidence and deduplicates occurrences', () => {
  const entry = { id: 'one', completed_at: '2026-10-28T04:59:59Z', title: 'Archived quest', xp: null };
  const groups = groupJournal([entry, entry, { ...entry, id: 'two', completed_at: '2026-10-28T05:00:00Z', xp: 1 }]);
  assert.deepEqual(groups.map(g => [g.day, g.entries.length]), [['2026-10-28', 1], ['2026-10-27', 1]]);
  assert.equal(groups[1].entries[0].xp, null);
});
