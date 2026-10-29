/** Issue #46: an in-flight progress save belongs to the account that started it.
 * Source-extracted Home callback + mocked RPC, not hosted Supabase or browser QA.
 * A superseded account must not receive 'saved', because the UI then removes
 * the original account's pending idempotency journal.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
const signature = "async function logProgress(id:string,requestId:string,delta:number):Promise<'saved'|'retry'|'rejected'>{";
const start = home.indexOf(signature);
const end = home.indexOf(' // A confirmed retry', start);
assert.ok(start >= 0 && end > start, 'Home progress callback boundaries changed');
const source = home.slice(start, end).replace(signature, 'async function logProgress(id,requestId,delta){');
const factory = new Function('layoutPreview','busy','supabase','setBusy','setMessage',
  'load','confirmedProgressResult','accountRef','loadEpoch','return (' + source + ');');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function setup(loadOverride) {
  const rpc = deferred();
  const accountRef = { current: 'account-a' };
  const loadEpoch = { current: 7 };
  const messages = [], calls = [];
  let loadCalls = 0;
  // Real Home.load increments the epoch before each authenticated refresh.
  const load = async () => {
    loadEpoch.current++;
    if (loadOverride) return loadOverride();
    loadCalls++;
    return {current_amount:3,status:'available'};
  };
  const action = factory(false, false, () => ({ rpc: async (name, args) => {
    calls.push({ name, ...args });
    await rpc.promise;
    return { data: [{ current_amount: 3, status: 'available', completed_now: false }], error: null };
  }}), () => {}, m => messages.push(m), load,
  data => Array.isArray(data) && data.length === 1 ? { status: data[0].status, currentAmount: data[0].current_amount } : null,
  accountRef, loadEpoch);
  return { action, rpc, accountRef, loadEpoch, messages, calls, getLoadCalls: () => loadCalls };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

test('same-account confirmed RPC and verified refresh may return saved', async () => {
  const h = setup();
  const pending = h.action('instance-a', 'stable-request-a', 2);
  await tick(); h.rpc.resolve();
  assert.equal(await pending, 'saved');
  assert.equal(h.getLoadCalls(), 1);
  assert.deepEqual(h.calls.map(c => c.p_request_id), ['stable-request-a']);
});

test('account A to B during RPC cannot confirm A journal using B refresh', async () => {
  const h = setup();
  const pending = h.action('instance-a', 'stable-request-a', 2);
  await tick(); h.accountRef.current = 'account-b'; h.loadEpoch.current++;
  h.rpc.resolve();
  assert.equal(await pending, 'retry', 'Keep original A request ID when current account changed');
  assert.doesNotMatch(h.messages.join(' '), /Progress saved\./,
    'Never show account A save success to account B');
  assert.deepEqual(h.calls.map(c => c.p_request_id), ['stable-request-a']);
});

test('sign-out while RPC is pending cannot confirm old account journal', async () => {
  const h = setup();
  const pending = h.action('instance-a', 'stable-request-a', -1);
  await tick(); h.accountRef.current = null; h.loadEpoch.current++;
  h.rpc.resolve();
  assert.equal(await pending, 'retry');
  assert.doesNotMatch(h.messages.join(' '), /Progress saved\./);
});

test('account change while refresh is pending cannot resolve old operation', async () => {
  const loadGate = deferred();
  const entered = deferred();
  const h = setup(async () => { entered.resolve(); await loadGate.promise; return true; });
  const pending = h.action('instance-a', 'stable-request-a', 2);
  await tick(); h.rpc.resolve();
  await entered.promise;
  h.accountRef.current = 'account-b'; h.loadEpoch.current++;
  loadGate.resolve();
  assert.equal(await pending, 'retry');
  assert.deepEqual(h.calls.map(c => c.p_request_id), ['stable-request-a']);
});

test('overlapping same-account reload cannot confirm an older progress request', async () => {
  const h = setup();
  const pending = h.action('instance-a', 'stable-request-a', 2);
  await tick(); h.loadEpoch.current++;
  h.rpc.resolve();
  assert.equal(await pending, 'retry');
  assert.deepEqual(h.calls.map(c => c.p_request_id), ['stable-request-a']);
});
