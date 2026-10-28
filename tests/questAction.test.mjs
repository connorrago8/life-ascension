import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {questReceipt} from '../lib/questReceipt.ts';
function harness({owner='owner',data,error=null}={}){
 const entries=new Map();let calls=0;
 const client={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},rpc:async(name)=>{assert.equal(name,'set_quest_instance_status_v2');calls++;return {data,error}}};
 const source=ts.transpileModule(fs.readFileSync(new URL('../lib/questAction.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const exports={};vm.runInNewContext(source,{exports,require:name=>name==='./supabase'?{supabase:()=>client}:{questReceipt},localStorage:{getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)},Error});
 return {exports,entries,calls:()=>calls};
}
const receipt={schema_version:1,quest_instance_id:'instance',status:'completed',quest_completion_confirmed:true,reward_confirmed:true,xp_awarded:1,reward_status:'awarded',reward_awarded_at:'2026-10-27T12:00:00Z'};
test('shared action path validates owner before submitting',async()=>{
 const h=harness({owner:'other'});await assert.rejects(h.exports.executeQuestAction('owner','instance','complete','detail'));assert.equal(h.calls(),0);assert.equal(h.entries.size,0);
});
test('valid receipt clears exact pending operation; duplicate feedback never adds XP',async()=>{
 const h=harness({data:receipt});const r=await h.exports.executeQuestAction('owner','instance','complete','detail');assert.equal(r.xp_awarded,1);assert.equal(h.entries.size,0);
 assert.equal(h.exports.receiptFeedback({...receipt,xp_awarded:0,reward_status:'already_awarded'}),'Completion already saved · no additional XP');
});
test('unknown response retains occurrence/action and origin for safe recovery',async()=>{
 const h=harness({data:'completed'});await assert.rejects(h.exports.executeQuestAction('owner','instance','complete','highlight'));
 const saved=JSON.parse(h.entries.get('life-ascension:pending:owner'));assert.deepEqual(saved,{id:'instance',action:'complete',origin:'highlight'});
 await assert.rejects(h.exports.executeQuestAction('owner','another','complete','board'));assert.equal(h.calls(),1);
});
test('explicit transaction rejection clears pending state and reports error',async()=>{
 const h=harness({error:{code:'P0001',message:'Quest archived'}});await assert.rejects(h.exports.executeQuestAction('owner','instance','complete','board'),h.exports.ActionRejected);assert.equal(h.entries.size,0);
});
