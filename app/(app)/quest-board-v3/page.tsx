"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useQuestBoardV3Selection } from "../../../hooks/useQuestBoardV3Selection";
import { questDay, individualStreak, type Completion, type Quest as EngineQuest } from "../../../src/lib/quest-board-v3";

type DbQuest={id:string;title:string;domain:string;cadence:"once"|"daily";created_at:string;quest_type:"scheduled"|"goal";scheduled_for:string|null};
type DbInstance={id:string;quest_id:string;due_date:string;status:"available"|"completed"|"deferred";completed_at:string|null};
type BoardRow={quest:DbQuest;instance:DbInstance;streak:number};
export default function QuestBoardV3Connected(){
 const [signedIn,setSignedIn]=useState<boolean|null>(null);
 const [quests,setQuests]=useState<DbQuest[]>([]);
 const [instances,setInstances]=useState<DbInstance[]>([]);
 const [xp,setXp]=useState<number|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState<string|null>(null);
 const [assignments,setAssignments]=useState<string[]>([]);
 const [completedOpen,setCompletedOpen]=useState(false);
 const [showAll,setShowAll]=useState(false);
 const today=questDay(new Date());
 const {selection,message:selectionMessage}=useQuestBoardV3Selection();
 const load=useCallback(async()=>{
  try{
   const client=supabase();
   const {data:{user},error:authError}=await client.auth.getUser();
   setSignedIn(!!user&&!authError);
   if(!user||authError)return;
   const {data:questRows,error:qe}=await client.from("quests").select("id,title,domain,cadence,created_at,quest_type,scheduled_for").eq("owner_id",user.id).eq("active",true).order("created_at",{ascending:true}).limit(300);
   if(qe)throw qe;
   const q=(questRows||[]) as DbQuest[];
   setQuests(q);
   const {data:assigned}=await client.from("quest_companion_assignments").select("quest_id").eq("owner_id",user.id).eq("active",true);
   setAssignments((assigned||[]).map((item:{quest_id:string})=>item.quest_id));
   // The existing RPC is authoritative for instance creation and XP.
   // Do not create instances for future scheduled quests or completed one-time quests.
   const eligible=q.filter(item=>item.quest_type!=="goal"&&(!item.scheduled_for||item.scheduled_for<=today));
   const ensured=await Promise.all(eligible.map(item=>client.rpc("ensure_quest_instance",{p_quest_id:item.id,p_date:today})));
   const failed=ensured.find(result=>result.error);
   if(failed?.error)throw failed.error;
   const [{data:history,error:he},{data:ledger,error:le}]=await Promise.all([
    client.from("quest_instances").select("id,quest_id,due_date,status,completed_at").eq("owner_id",user.id).order("due_date",{ascending:false}).limit(2000),
    client.rpc("get_lifetime_xp")
   ]);
   if(he||le)throw he||le;
   setInstances((history||[]) as DbInstance[]);
   setXp(typeof ledger==="number"?ledger:null);
   setError("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load your quests");setSignedIn(v=>v??false)}
 },[today]);
 useEffect(()=>{void load()},[load]);
 const assignedIds=new Set(assignments);
 const rows=useMemo(()=>{
  const completions:Completion[]=instances.filter(i=>i.status==="completed").map(i=>({questId:i.quest_id,period:i.due_date,completedAt:i.completed_at||i.due_date+"T12:00:00Z",source:"tap"}));
  return quests.flatMap(q=>{
   const current=q.cadence==="daily"?instances.find(i=>i.quest_id===q.id&&i.due_date===today):instances.find(i=>i.quest_id===q.id&&i.status!=="completed")||instances.find(i=>i.quest_id===q.id);
   if(!current||q.scheduled_for&&q.scheduled_for>today&&q.quest_type!=="goal")return [];
   const engine:EngineQuest={id:q.id,title:q.title,cadence:q.cadence,source:"manual",enabled:true,priority:5,createdAt:q.created_at};
   return [{quest:q,instance:current,streak:individualStreak(engine,completions,new Date())}];
  });
 },[quests,instances,today]);
 const active=rows.filter(r=>r.instance.status!=="completed");
 const completed=rows.filter(r=>r.instance.status==="completed");
 const daily=active.filter(r=>r.quest.cadence==="daily");
 const selectedIds=new Set(selection?.questIds||[]);
 const selectedDaily=selection?.persisted?daily.filter(r=>selectedIds.has(r.quest.id)):daily;
 const goals=active.filter(r=>r.quest.quest_type==="goal");
 async function complete(row:BoardRow){
  if(busy||!window.confirm(`Confirm you completed "${row.quest.title}"?`))return;
  setBusy(row.instance.id);
  try{
   const {error:e}=await supabase().rpc("set_quest_instance_status",{p_instance_id:row.instance.id,p_action:"complete"});
   if(e)throw e;
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Completion failed")}finally{setBusy(null)}
 }
 if(signedIn===null)return <main className="wrap">Loading Quest Board 3.0…</main>;
 if(!signedIn)return <main className="wrap"><h1>Quest Board 3.0</h1><p className="muted">Sign in to see your real quests.</p><Link className="btn" href="/login?next=%2Fquest-board-v3">Sign in</Link></main>;
 const visible=showAll?active:active.slice(0,10);
 return <main className="wrap">
  <div className="eyebrow">LIFE ASCENSION · CONNECTED DEVELOPMENT BOARD</div>
  <h1>Quest Board 3.0</h1>
  <p className="muted">Your existing quests, completion history and XP. This experimental view uses the current database; new AI/calendar features are not enabled.</p>
  <section className="panel"><div className="eyebrow">{today} · Chicago 5 AM reset</div><h2>{completed.length} completed · {active.length} available</h2><p className="muted">Lifetime XP: {xp??"—"} · Existing XP rules preserved</p></section>
  <section className="panel"><h2>Daily Quests</h2><p className="muted">{selectedDaily.length} selected daily habits · Individual streaks</p>{selectionMessage&&<p className="muted" role="status">{selectionMessage}</p>}
   {visible.filter(r=>r.quest.cadence==="daily"&&r.quest.quest_type!=="goal"&&(!selection?.persisted||selectedIds.has(r.quest.id))).map(row=><div className="quest" key={row.instance.id}><div className="quest-main"><div className="quest-title">{row.quest.title}</div><div className="muted">🔥 {row.streak}-day streak · {assignedIds.has(row.quest.id)?"💜 Izzy · +2 XP":"+1 XP"}</div></div><div className="actions"><button className="btn" disabled={!!busy} onClick={()=>complete(row)}>Complete</button></div></div>)}
   {!showAll&&active.length>10&&<button className="btn ghost" onClick={()=>setShowAll(true)}>Show all active quests</button>}
   <button className="btn ghost" style={{marginTop:14}} aria-expanded={completedOpen} onClick={()=>setCompletedOpen(v=>!v)}>{completedOpen?"▾":"▸"} Completed Today ({completed.length})</button>
   {completedOpen&&completed.map(row=><div className="quest" key={row.instance.id}><div className="quest-main"><div className="quest-title">{row.quest.title}</div><div className="muted">✓ Complete · 🔥 {row.streak} streak</div></div></div>)}
  </section>
  <section className="panel"><h2>Other Habits</h2><p className="muted">Habits outside today’s selection remain eligible for completion. Izzy-assigned quests earn +2 XP.</p>{selection?.persisted&&daily.filter(r=>!selectedIds.has(r.quest.id)).map(row=><div className="quest" key={row.instance.id}><div className="quest-main"><div className="quest-title">{row.quest.title}</div><div className="muted">Off-board · 🔥 {row.streak}-day streak · {assignedIds.has(row.quest.id)?"💜 Izzy · +2 XP":"+1 XP"}</div></div><button className="btn ghost" disabled={!!busy} onClick={()=>complete(row)}>Complete</button></div>)}</section>
  <section className="panel"><h2>💜 Quests from Izzy</h2><p className="muted">Assigned quests appear here even if they are not part of today's daily selection.</p>
   {active.filter(r=>assignedIds.has(r.quest.id)&&r.quest.cadence!=="daily"&&r.quest.quest_type!=="goal").map(row=><div className="quest" key={row.instance.id}><div className="quest-main"><div className="quest-title">{row.quest.title}</div><div className="muted">💜 Izzy · +2 XP when completed</div></div><button className="btn" disabled={!!busy} onClick={()=>complete(row)}>Complete</button></div>)}
   {active.filter(r=>assignedIds.has(r.quest.id)).length===0&&<p className="muted">No outstanding Izzy quests.</p>}
   <Link className="btn ghost" href="/companion">Open Companion Mode</Link></section>
  <section className="panel"><h2>Main Quests & Goals</h2>{goals.length===0&&<p className="muted">No active goals currently.</p>}
   {goals.map(row=><div className="quest" key={row.instance.id}><div className="quest-main"><div className="quest-title">{row.quest.title}</div><div className="muted">Goal · {row.quest.scheduled_for||"No deadline"} · {assignedIds.has(row.quest.id)?"💜 Izzy · +2 XP":"+1 XP"} on completion</div></div><button className="btn" disabled={!!busy} onClick={()=>complete(row)}>Complete</button></div>)}
  </section>
  <section className="panel"><h2>Quest Management</h2><p className="muted">Existing editing and scheduling remain available while Quest Board 3.0 is built.</p><Link className="btn ghost" href="/quests/manage">Manage quests</Link> <Link className="btn ghost" href="/quest-board-v3-preview">Try the full feature prototype</Link></section>
  {error&&<p className="message" role="alert">{error}</p>}
 </main>;
}
