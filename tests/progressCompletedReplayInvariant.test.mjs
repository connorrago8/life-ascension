import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedProgressResult } from '../lib/preview/progressDelta.mjs';

test('completed zero amount replay fails closed even when completed_now is false', () => {
  assert.equal(confirmedProgressResult([{current_amount:0,status:'completed',completed_now:false}]), null);
});
test('replayed completed positive amount is still accepted without new XP claim', () => {
  assert.deepEqual(confirmedProgressResult([{current_amount:5,status:'completed',completed_now:false}]), {currentAmount:5,status:'completed',completedNow:false});
});
test('legitimate available zero after clear remains accepted', () => {
  assert.deepEqual(confirmedProgressResult([{current_amount:0,status:'available',completed_now:false}]), {currentAmount:0,status:'available',completedNow:false});
});
test('a new completion with positive recorded progress remains accepted', () => {
  assert.deepEqual(confirmedProgressResult([{current_amount:5,status:'completed',completed_now:true}]), {currentAmount:5,status:'completed',completedNow:true});
});
