import test from 'node:test';
import assert from 'node:assert/strict';
import { nextProgressDelta } from '../lib/preview/progressDelta.mjs';

test('quick increment stops at the target without over-logging', () => {
  assert.equal(nextProgressDelta({target:8,amount:5,increment:5},'add'),3);
  assert.equal(nextProgressDelta({target:8,amount:8,increment:5},'add'),null);
  assert.equal(nextProgressDelta({target:8,amount:0,increment:5},'add'),5);
});

test('undo remains one increment; clear atomically reverses the entire positive amount', () => {
  assert.equal(nextProgressDelta({target:8,amount:5,increment:5},'undo'),-5);
  assert.equal(nextProgressDelta({target:8,amount:5,increment:5},'clear'),-5);
  assert.equal(nextProgressDelta({target:8,amount:6,increment:5},'clear'),-6);
  assert.equal(nextProgressDelta({target:8,amount:3,increment:5},'undo'),null);
  assert.equal(nextProgressDelta({target:8,amount:3,increment:5},'clear'),-3);
  assert.equal(nextProgressDelta({target:10,amount:7,increment:2},'clear'),-7);
  assert.equal(nextProgressDelta({target:10,amount:1,increment:2},'clear'),-1);
  assert.equal(nextProgressDelta({target:10,amount:0,increment:2},'clear'),null);
  assert.equal(nextProgressDelta({target:10,amount:7,increment:2},'undo'),-2);
});

test('invalid, fractional and unsafe progress never generate an operation', () => {
  for (const amount of [-1, 9, 0.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(nextProgressDelta({target:8,amount,increment:1},'add'),null);
  }
  assert.equal(nextProgressDelta({target:8,amount:2,increment:0},'undo'),null);
  assert.equal(nextProgressDelta({target:8,amount:2,increment:1},'other'),null);
});
