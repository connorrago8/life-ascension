'use client';
import {useEffect,useRef,useState} from 'react';
import {executeQuestAction,receiptFeedback,ActionRejected,type ActionFeedback} from '../lib/questAction';
import {chicagoDay} from '../lib/questBoard';
import {calendarDateOffset} from '../lib/questReceipt';
import CompletionFeedback from './CompletionFeedback';
type Occurrence={id:string;due_date:string;status:string};
export default function QuestDetailCompletion({owner,quest,instances,onSaved,preferredInstance}:{owner:string;preferredInstance?:string;quest:{active:boolean;cadence:string;quest_type?:string;target_amount?:number|null};instances:Occurrence[];onSaved:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[pending,setPending]=useState<{id:string;action:'complete'|'defer'|'resume'}|null>(null),[feedback,setFeedback]=useState<ActionFeedback|null>(null);
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 useEffect(()=>{try{const raw=localStorage.getItem('life-ascension:pending:'+owner);if(raw){const saved=JSON.parse(raw);if(typeof saved.id==='string'&&['complete','defer','resume'].includes(saved.action)){setPending(saved);if(instances.some(i=>i.id===saved.id))setFeedback({owner,id:saved.id,origin:'detail',phase:'uncertain',text:'Completion not confirmed yet. Retry the same action to check its receipt.'});}}}catch{setFeedback({owner,id:'',origin:'detail',phase:'error',text:'Could not restore the pending action. Return to the Board to recover it.'});}},[owner,instances]);
 const today=chicagoDay();
 const eligible=quest.active&&quest.target_amount==null?instances.filter(i=>i.status==='available'&&(i.due_date<=today||quest.quest_type==='goal')&&(quest.cadence!=='daily'||i.due_date>=calendarDateOffset(today,-2))).sort((a,b)=>a.due_date.localeCompare(b.due_date)||a.id.localeCompare(b.id)):[];
 const instance=preferredInstance?eligible.find(i=>i.id===preferredInstance):eligible[0];
 async function complete(id:string,action:'complete'|'defer'|'resume'='complete'){
  if(busy)return;setBusy(true);setFeedback({owner,id,origin:'detail',phase:'pending',text:'Saving your completion…'});
  try{const receipt=await executeQuestAction(owner,id,action,'detail');if(!alive.current)return;setPending(null);setFeedback({owner,id,origin:'detail',phase:'confirmed',text:receiptFeedback(receipt)});await onSaved();}
  catch(e){if(!alive.current)return;const rejected=e instanceof ActionRejected;setPending(rejected?null:{id,action});setFeedback({owner,id,origin:'detail',phase:rejected?'error':'uncertain',text:rejected?e.message:'Completion not confirmed yet. No reward confirmed. Retry the same action.'});}
  finally{if(alive.current)setBusy(false)}
 }
 return <section className="panel" aria-label="Quest completion"><h2>Complete this quest</h2>
  <p>Finish the real-world action described above, then confirm completion here. Saving a note does not complete the quest.</p>
  {instance&&<><p>Occurrence due {instance.due_date} · Reward: 1 XP after server confirmation</p><button className="btn" disabled={busy||!!pending} onClick={()=>void complete(instance.id)}>Complete quest</button></>}
  {!instance&&!feedback&&<p>{quest.target_amount!=null?'This tracked quest requires its existing progress flow.':!quest.active?'This quest is archived.':'No eligible unfinished occurrence. View upcoming dates or return to the Quest Board.'}</p>}
  {feedback&&<CompletionFeedback feedback={feedback} disabled={busy} onRetry={pending&&instances.some(i=>i.id===pending.id)?()=>void complete(pending.id,pending.action):undefined}/>}
  {pending&&!instances.some(i=>i.id===pending.id)&&<p>A different quest has a pending action. <a href="/">Return to the Board to resolve it.</a></p>}
 </section>;
}
