/** Issue #46 / Beta candidate 815bd4bf: failed reload must not mix snapshots.
 * Runs the real Home load callback in Node with isolated Supabase mocks.
 * No hosted database, React rendering, browser, or iPhone acceptance.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function extractLoad() {
 const home=readFileSync(new URL('../app/(app)/page.tsx',import.meta.url),'utf8');
 const marker='const load=useCallback(async(expectedProgressInstanceId?:string)=>{',start=home.indexOf(marker),end=home.indexOf('},[]);',start);
 assert.ok(start>=0&&end>start,'Home load callback boundaries changed');
 const code=('async(expectedProgressInstanceId)=>{'+home.slice(start+marker.length,end)+'}')
   .replace('let pendingIds:string[]=[]','let pendingIds=[]')
   .replace(/\[\] as \w+\[\]/g,'[]').replace('new Map<string,Instance>()','new Map()');
 return new Function('supabase','setUser','setReady','setQuests','setRecoveryQuests',
  'setInstances','setXp','setMessage','setRecoveryIds','setLayoutPreview',
  'todayLocal','coerceXp','pendingProgressInstanceIds','localStorage','process',
  'loadEpoch','accountRef','return ('+code+');');
}

function setup(failure) {
 const state={user:'account-1',quests:[{id:'old'}],instances:[{id:'old-instance',current_amount:2}],xp:2,message:''};
 const quest={id:'new',quest_type:'scheduled',cadence:'daily',scheduled_for:null};
 const instance={id:'new-instance',quest_id:'new',due_date:'2026-10-29',status:'available',current_amount:7};
 const from=table=>{const q={select(){return q},eq(){return q},in(){return q},lte(){return q},neq(){return q},limit(){return q},order(){return q},
  then(ok,bad){return Promise.resolve(table==='quests'?{data:[quest],error:null}:{data:[instance],error:failure==='instances'?{message:'instances unavailable'}:null}).then(ok,bad)}};return q};
 const supabase=()=>({auth:{getUser:async()=>({data:{user:{id:'account-1'}},error:null})},from,
  rpc:async name=>name==='get_lifetime_xp'?{data:9,error:failure==='xp'?{message:'XP unavailable'}:null}:{data:null,error:null}});
 const load=extractLoad()(supabase,v=>{state.user=v},()=>{},v=>{state.quests=v},()=>{},
  v=>{state.instances=v},v=>{state.xp=v},v=>{state.message=v},()=>{},()=>{},
  ()=>'2026-10-29',v=>v,()=>[],{length:0,key:()=>null},{env:{NODE_ENV:'test'}},
  {current:0},{current:'account-1'});
 return {load,state};
}
for(const failure of ['instances','xp'])test('failed '+failure+' read keeps prior consistent quest/progress/XP snapshot',async()=>{
 const {load,state}=setup(failure);
 assert.equal(await load(),false);
 assert.ok(state.message);
 assert.deepEqual(state.quests.map(q=>q.id),['old']);
 assert.deepEqual(state.instances.map(i=>i.id),['old-instance']);
 assert.equal(state.xp,2);
});
test('successful reload commits all three refreshed values',async()=>{
 const {load,state}=setup(null);
 assert.equal(await load(),true);
 assert.deepEqual(state.quests.map(q=>q.id),['new']);
 assert.deepEqual(state.instances.map(i=>i.id),['new-instance']);
 assert.equal(state.xp,9);
});


test('owner-scoped refresh missing the just-saved instance preserves its pending retry',async()=>{
 const {load,state}=setup(null);
 assert.equal(await load('missing-instance'),false);
 assert.deepEqual(state.instances.map(i=>i.id),['new-instance'],
  'The refreshed snapshot still renders, but does not confirm an omitted save');
});
test('owner-scoped refresh containing the saved instance can confirm persistence',async()=>{
 const {load}=setup(null);
 const refreshed=await load('new-instance');
 assert.equal(refreshed.id,'new-instance');
 assert.equal(refreshed.current_amount,7);
 assert.equal(refreshed.status,'available');
});
