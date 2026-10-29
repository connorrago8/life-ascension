/** Real QuestProgressControls callbacks with mocked storage and RPC.
 * Confirms a second tap cannot overwrite the first idempotent request ID
 * before React commits saving state. No hosted database is accessed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const component = readFileSync(new URL('../components/QuestProgressControls.tsx', import.meta.url), 'utf8');
const start = component.indexOf('  const submit = (delta: number) => {');
const retry = component.indexOf('  const retryPending = () => {', start);
const end = component.indexOf('  return <div className="quest-progress-controls">', retry);
assert.ok(start >= 0 && retry > start && end > retry, 'progress callback boundaries changed');
const source = component.slice(start, retry)
  .replace('const submit = (delta: number) => {', 'const submit = (delta) => {')
  .replace('let pending: { id: string; delta: number } | null = null;', 'let pending = null;')
  + component.slice(retry, end)
  .replace('let pending: { id: string; delta: number } | null;', 'let pending;');
const make = new Function('env',
  'const {instance,disabled,saving,storageError,retrying,amount,target,storageKey,parsePendingProgress,localStorage,setStorageError,setRetrying,crypto,setSaveState,setSaving,onLog,setCustom,onJournalResolved,operationInFlight} = env;\n'
  + source + '\nreturn {submit,retryPending};');

function scenario({denyWrites = false} = {}) {
  const journal = new Map();
  const calls = [];
  const flags = {storageError:false, saving:false, retrying:false, resolved:0};
  const lock = {current:false};
  let uuidCount = 0;
  const storage = {
    getItem: key => journal.get(key) ?? null,
    setItem: (key, value) => { if (denyWrites) throw new Error('storage denied'); journal.set(key,value); },
    removeItem: key => journal.delete(key),
  };
  const env = {
    instance:{id:'instance-1',status:'available'}, disabled:false, saving:false,
    storageError:false, retrying:false, amount:2, target:10,
    storageKey:'life-progress-pending:instance-1', localStorage:storage,
    parsePendingProgress: raw => raw === null ? null : JSON.parse(raw),
    crypto:{randomUUID:()=> 'operation-' + (++uuidCount)},
    operationInFlight:lock,
    setStorageError: value => { flags.storageError = value; },
    setRetrying: value => { flags.retrying = value; },
    setSaveState:()=>{},
    setSaving: value => { flags.saving = value; },
    setCustom:()=>{},
    onJournalResolved:()=>{ flags.resolved++; },
    onLog:(id,requestId,delta)=>new Promise(resolve=>calls.push({id,requestId,delta,resolve})),
  };
  return {handlers:make(env),journal,storage,calls,flags,lock,get uuidCount(){return uuidCount;}};
}
async function flush() { for(let i=0;i<8;i++) await Promise.resolve(); }

test('two same-tick progress taps write one journal UUID and send one RPC',async()=>{
  const x=scenario();
  x.handlers.submit(1);
  x.handlers.submit(1);
  assert.equal(x.calls.length,1);
  assert.equal(x.uuidCount,1);
  assert.equal(x.lock.current,true);
  assert.equal(JSON.parse(x.storage.getItem('life-progress-pending:instance-1')).id,'operation-1');
  x.calls[0].resolve('saved');
  await flush();
  assert.equal(x.lock.current,false);
  assert.equal(x.storage.getItem('life-progress-pending:instance-1'),null);
  assert.equal(x.flags.resolved,1);
});
test('same-tick retry taps reuse the original request ID once',async()=>{
  const x=scenario();
  x.handlers.submit(2);
  x.calls[0].resolve('retry');
  await flush();
  assert.equal(x.lock.current,false);
  x.handlers.retryPending();
  x.handlers.retryPending();
  assert.equal(x.calls.length,2);
  assert.equal(x.uuidCount,1);
  assert.equal(x.calls[1].requestId,x.calls[0].requestId);
  assert.equal(x.calls[1].delta,2);
  x.calls[1].resolve('saved');
  await flush();
  assert.equal(x.lock.current,false);
  assert.equal(x.storage.getItem('life-progress-pending:instance-1'),null);
});
test('storage write failure releases the lock without sending RPC',()=>{
  const x=scenario({denyWrites:true});
  x.handlers.submit(1);
  assert.equal(x.calls.length,0);
  assert.equal(x.lock.current,false);
  assert.equal(x.flags.storageError,true);
});
