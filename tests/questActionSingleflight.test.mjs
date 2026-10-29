import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Executes the exact Home action callback in isolation, without a hosted database.
const home=readFileSync(new URL('../app/(app)/page.tsx',import.meta.url),'utf8');
const start=home.indexOf("async function act(id:string,action:'complete'|'defer'|'resume'){");
const end=home.indexOf('async function logProgress(',start);
assert.ok(start>=0&&end>start,'Quest action callback boundaries changed');
const source=home.slice(start,end).replace(
 "async function act(id:string,action:'complete'|'defer'|'resume'){",
 'async function act(id,action){'
);
const make=new Function('layoutPreview','busy','questActionInFlight','accountRef',
 'setMessage','setBusy','window','supabase','completionFeedback','load',
 'return ('+source+');');
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
function scenario(pending=deferred()){
 const state={busy:false,messages:[],calls:0,loads:0,confirms:0,account:'A'};
 const lock={current:false};
 const account={get current(){return state.account}};
 const action=make(false,false,lock,account,m=>state.messages.push(m),
  b=>{state.busy=b},{confirm:()=>{state.confirms++;return true}},
  ()=>({rpc:()=>{state.calls++;return pending.promise}}),
  ()=> 'Verified completion',async()=>{state.loads++});
 return {action,pending,state,lock};
}
test('rapid complete taps send only one RPC and release the lock',async()=>{
 const x=scenario();
 const first=x.action('instance-1','complete');
 const second=x.action('instance-1','complete');
 assert.equal(x.state.calls,1);
 assert.equal(x.state.confirms,1);
 x.pending.resolve({data:{},error:null});
 await Promise.all([first,second]);
 assert.equal(x.state.loads,1);
 assert.equal(x.lock.current,false);
 assert.equal(x.state.busy,false);
});
test('failed request releases lock so a later retry is allowed',async()=>{
 const x=scenario();
 const first=x.action('instance-1','defer');
 const second=x.action('instance-1','defer');
 assert.equal(x.state.calls,1);
 x.pending.reject(new Error('offline'));
 await Promise.all([first,second]);
 assert.match(x.state.messages.join(' '),/not confirmed/);
 assert.equal(x.lock.current,false);
 const retry=x.action('instance-1','defer');
 assert.equal(x.state.calls,2);
 x.pending.resolve({error:null});
 await retry;
});
test('old account completion cannot update new account message or reload',async()=>{
 const x=scenario();
 const pending=x.action('instance-1','complete');
 x.state.account='B';
 x.pending.resolve({data:{},error:null});
 await pending;
 assert.deepEqual(x.state.messages,[]);
 assert.equal(x.state.loads,0);
 assert.equal(x.lock.current,false);
});
