import test from 'node:test';
import assert from 'node:assert/strict';
import { nextProgressDelta, confirmedProgressResult } from '../lib/preview/progressDelta.mjs';
import { readFileSync } from 'node:fs';

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


test('progress RPC success requires exactly one valid result row', () => {
  const row = { current_amount: 7, status: 'available', completed_now: false };
  assert.deepEqual(confirmedProgressResult([row]),
    { currentAmount: 7, status: 'available', completedNow: false });
  assert.deepEqual(confirmedProgressResult([{ ...row, current_amount: 8, status: 'completed', completed_now: true }]),
    { currentAmount: 8, status: 'completed', completedNow: true });
  assert.deepEqual(confirmedProgressResult([{ ...row, status: 'completed' }]),
    { currentAmount: 7, status: 'completed', completedNow: false },
    'An idempotent completed replay must remain confirmable without new XP');
  for (const invalid of [null, undefined, [], {}, [row, row], [null],
    [{ ...row, current_amount: -1 }], [{ ...row, current_amount: 0.5 }],
    [{ ...row, current_amount: '7' }], [{ ...row, status: 'deferred' }],
    [{ ...row, completed_now: 'true' }], [{ ...row, completed_now: true }]]) {
    assert.equal(confirmedProgressResult(invalid), null,
      'Unexpected RPC payload must preserve the original retry journal');
  }
});

test('Home retains original progress request on unverified RPC response', () => {
  const home = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /const confirmation=confirmedProgressResult\(data\)/);
  assert.match(home, /if\(!confirmation\)\{[^}]*return 'retry';\s*\}/);
  assert.match(home, /confirmation\.status === 'completed'/);
  assert.doesNotMatch(home, /Quest completed\. \+1 XP/,
    'Tracked progress cannot claim a new XP award without a v2 ledger receipt');
});

test('authenticated reload restores persisted progress from owner-scoped quest rows', () => {
  const home = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
  assert.match(home,
    /s\.from\('quest_instances'\)\.select\('id,quest_id,due_date,status,current_amount'\)\.eq\('owner_id',user\.id\)/,
    'Reload must fetch current_amount from the signed-in user\'s persisted quest instances');
  assert.match(home, /setInstances\(\[\.\.\.rows\.values\(\)\]\)/,
    'The refreshed database rows must become the displayed quest instance state');
  assert.match(home, /supabase\(\)\.rpc\('log_quest_progress'/,
    'Progress writes must use the server-authoritative progress RPC');
  assert.match(home, /if\(!\(await load\(id\)\)\)\{[\s\S]*?return 'retry';[\s\S]*?\}/,
    'A failed refresh must preserve the original retry journal');
  assert.match(home, /return !expectedProgressInstanceId\|\|rows\.has\(expectedProgressInstanceId\)/,
    'Refresh must include the just-saved instance before clearing its retry journal');
  assert.match(home, /if\(accountRef\.current!==operationAccount\|\|loadEpoch\.current!==operationEpoch\+1\)return 'retry'/,
    'A successful refresh must still belong to the original account and operation epoch');
});
