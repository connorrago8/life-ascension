import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Source-extracted Home callback; no hosted database or browser.
const home=readFileSync(new URL('../app/(app)/page.tsx',import.meta.url),'utf8');
const signature="async function logProgress(id:string,requestId:string,delta:number):Promise<'saved'|'retry'|'rejected'>{";
const start=home.indexOf(signature),end=home.indexOf(' // A confirmed retry',start);
assert.ok(start>=0&&end>start,'Home progress callback boundaries changed');
const runnable=home.slice(start,end).replace(signature,'async function logProgress(id,requestId,delta){');
const makeAction=(load,rows=[{current_amount:3,status:'available',completed_now:false}])=>{
 const requestIds=[],messages=[];
 const accountRef={current:'account-a'},loadEpoch={current:7};
 const fn=new Function('layoutPreview','busy','supabase','setBusy','setMessage','load',
  'confirmedProgressResult','accountRef','loadEpoch','return ('+runnable+');');
 const verifiedLoad=async()=>{loadEpoch.current++;return load()};
 const action=fn(false,false,()=>({rpc:async(_name,args)=>{
  requestIds.push(args.p_request_id);return {data:rows,error:null};
 }}),()=>{},m=>messages.push(m),verifiedLoad,
 data=>Array.isArray(data)&&data.length===1&&data[0].status==='available'?{status:'available',currentAmount:data[0].current_amount}:null,
 accountRef,loadEpoch);
 return {action,requestIds,messages};
};
test('confirmed RPC but failed reload keeps same-ID retry',async()=>{
 const h=makeAction(async()=>false);
 assert.equal(await h.action('instance-1','original-id',2),'retry');
 assert.deepEqual(h.requestIds,['original-id']);
 assert.match(h.messages.join(' '),/refresh|retry/i);
});
test('confirmed RPC and verified reload returns saved',async()=>{
 const h=makeAction(async()=>({current_amount:3,status:'available'}));
 assert.equal(await h.action('instance-1','original-id',2),'saved');
 assert.deepEqual(h.requestIds,['original-id']);
});
test('undefined reload cannot clear pending request journal',async()=>{
 const h=makeAction(async()=>undefined);
 assert.equal(await h.action('instance-1','original-id',2),'retry');
});
test('stale refreshed amount preserves the original retry ID',async()=>{
 const h=makeAction(async()=>({current_amount:2,status:'available'}));
 assert.equal(await h.action('instance-1','original-id',2),'retry');
 assert.deepEqual(h.requestIds,['original-id']);
});
test('mismatched refreshed status cannot falsely confirm progress',async()=>{
 const h=makeAction(async()=>({current_amount:3,status:'completed'}));
 assert.equal(await h.action('instance-1','original-id',2),'retry');
});
test('truthy reload without an instance row cannot confirm progress',async()=>{
 const h=makeAction(async()=>true);
 assert.equal(await h.action('instance-1','original-id',2),'retry');
});
test('malformed server confirmation does not report saved',async()=>{
 const h=makeAction(async()=>true,[]);
 assert.equal(await h.action('instance-1','original-id',2),'retry');
});
test('account-scoped loads invalidate stale requests and fail closed on auth errors',()=>{
 assert.match(home,/const epoch=\+\+loadEpoch\.current/);
 assert.match(home,/if\(epoch!==loadEpoch\.current\)return false/);
 assert.match(home,/const nextAccount=authError\?null:\(user\?\.id\|\|null\)/);
 assert.match(home,/setQuests\(\[\]\);setInstances\(\[\]\);setRecoveryQuests\(\[\]\);setRecoveryIds\(\[\]\);setXp\(0\)/);
 assert.match(home,/return !expectedProgressInstanceId\|\|rows\.get\(expectedProgressInstanceId\)\|\|false/);
});
