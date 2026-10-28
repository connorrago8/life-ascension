import {supabase} from './supabase';
import {questReceipt} from './questReceipt';
export type QuestAction = 'complete'|'defer'|'resume';
export type ActionOrigin = 'board'|'highlight'|'detail';
export type ActionFeedback = {owner:string;id:string;origin:ActionOrigin;phase:'pending'|'confirmed'|'uncertain'|'error';text:string};
export class ActionRejected extends Error {}
/** Shared submission path for Board, Highlights and Detail. No client XP mutations. */
export async function executeQuestAction(owner:string,id:string,action:QuestAction,origin:ActionOrigin){
 const client=supabase();
 const auth=await client.auth.getUser();
 if(auth.error)throw auth.error;
 if(auth.data.user?.id!==owner)throw new ActionRejected('Account changed. Reload before trying again.');
 const key='life-ascension:pending:'+owner;
 const previous=localStorage.getItem(key);
 if(previous){const pending=JSON.parse(previous);if(pending.id!==id||pending.action!==action)throw new ActionRejected('Resolve the pending action first.');}
 localStorage.setItem(key,JSON.stringify({id,action,origin}));
 const {data,error}=await client.rpc('set_quest_instance_status_v2',{p_instance_id:id,p_action:action});
 if(error){
  if(error.code==='P0001'||error.code==='42501'){localStorage.removeItem(key);throw new ActionRejected('Action rejected. No new XP confirmed. '+error.message);}
  throw error;
 }
 const receipt=questReceipt(data,id);if(!receipt)throw Error('Receipt not confirmed');
 localStorage.removeItem(key);
 return receipt;
}
export function receiptFeedback(receipt:NonNullable<ReturnType<typeof questReceipt>>){
 return receipt.xp_awarded===1?'Quest completed · +1 XP':receipt.status==='completed'?
  receipt.reward_confirmed?'Completion already saved · no additional XP':'Completion saved · reward not verified':
  receipt.status==='deferred'?'Quest deferred without penalty.':'Quest returned to your board.';
}
