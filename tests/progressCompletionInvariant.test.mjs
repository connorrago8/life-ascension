import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedProgressResult } from '../lib/preview/progressDelta.mjs';

test('rejects a newly completed quest with zero tracked progress', () => {
  assert.equal(confirmedProgressResult([{current_amount:0,status:'completed',completed_now:true}]),null);
});
test('accepts a legitimate new completion', () => {
  assert.deepEqual(confirmedProgressResult([{current_amount:10,status:'completed',completed_now:true}]),{currentAmount:10,status:'completed',completedNow:true});
});
test('accepts a completed replay without new completion', () => {
  assert.deepEqual(confirmedProgressResult([{current_amount:10,status:'completed',completed_now:false}]),{currentAmount:10,status:'completed',completedNow:false});
});
test('accepts cleared available state', () => {
  assert.deepEqual(confirmedProgressResult([{current_amount:0,status:'available',completed_now:false}]),{currentAmount:0,status:'available',completedNow:false});
});
test('rejects completion flag with available status', () => {
  assert.equal(confirmedProgressResult([{current_amount:5,status:'available',completed_now:true}]),null);
});
