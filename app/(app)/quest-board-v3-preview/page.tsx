"use client";
import { useMemo, useState } from "react";
import { bonusChoices, completeQuest, isCompleted, isWeeklyRevealed, questDay, questWeek, rerollBonus, selectDailyQuests, weeklyReviewDue, type Quest, type QuestBoardState } from "../../../src/lib/quest-board-v3";

const initialQuests: Quest[] = [
  ["brush","Brush Teeth","daily","hygiene",10],["bed","Make Bed","daily","home",8],["water","Drink Water","daily","physical_health",7],
  ["laundry","Fold Laundry","daily","home",8],["tidy","Tidy for 5 Minutes","daily","home",9],
  ["floss","Floss Teeth","daily","hygiene",6],["read","Read 10 Minutes","daily","personal_growth",5],
  ["walk","Take a Walk","daily","physical_health",5],["shave","Grooming","daily","hygiene",4],
  ["stretch","Stretch","daily","physical_health",4],["clean","Clean Kitchen","weekly","home",8],
  ["review","Sunday Review","weekly","personal_growth",7],["plan","Plan Groceries","weekly","home",5]
].map(([id,title,cadence,category,priority])=>({id:String(id),title:String(title),cadence:cadence as "daily"|"weekly",source:"manual" as const,enabled:true,priority:Number(priority),category:String(category),createdAt:"2026-10-31T00:00:00Z"}));
const initial: QuestBoardState = { quests:initialQuests,completions:[],pendingInputs:[{id:"suggestion:1",question:"Would you like a reminder before your next workout?",createdAt:"2026-10-31T00:00:00Z"}],weeklyReviews:[],goals:[{id:"apartment",title:"Improve My Apartment",milestoneIds:["organize","declutter"],linkedQuestIds:["laundry","tidy","clean"],rewardId:"home-reward"}],rewards:[{id:"home-reward",title:"Emberhaven Decoration",requirement:"Complete apartment milestones",estimatedLabel:"Town decoration",previewStats:{comfort:5}}],bonusRerolls:{} };
export default function QuestBoardV3Preview(){
 const [state,setState]=useState<QuestBoardState>(initial);
 const [now,setNow]=useState(()=>new Date());
 const [showCompleted,setShowCompleted]=useState(false);
 const [showReward,setShowReward]=useState(false);
 const [showBonus,setShowBonus]=useState(false);
 const [message,setMessage]=useState("");
 const [draft,setDraft]=useState("");
 const [nextId,setNextId]=useState(1);
 const daily=useMemo(()=>selectDailyQuests(state.quests,now),[state.quests,now]);
 const weekly=state.quests.filter(q=>q.cadence==="weekly"&&isWeeklyRevealed(q,now));
 const displayed=[...daily,...weekly];
 const active=displayed.filter(q=>!isCompleted(q,state.completions,now));
 const completed=displayed.filter(q=>isCompleted(q,state.completions,now));
 const bonuses=bonusChoices(state,now);
 const review=weeklyReviewDue(state,now);
 function finish(id:string){
  const {state:next,xpAwarded}=completeQuest(state,id,now,"tap");setState(next);setMessage(xpAwarded?"+1 XP · Completion recorded":"Already completed for this period");
 }
 function logText(){
  const match=state.quests.find(q=>q.title.toLowerCase()===draft.trim().toLowerCase());
  if(!match){setMessage("Try an exact quest title in this prototype. Natural-language AI matching requires integration.");return;}
  finish(match.id);setDraft("");
 }
 function addQuest(){
  if(!draft.trim())return;
  const quest:Quest={id:"new:"+nextId,title:draft.trim(),cadence:"daily",source:"ai",enabled:true,priority:5,createdAt:now.toISOString(),isNew:true};
  setState(s=>({...s,quests:[...s.quests,quest]}));setNextId(n=>n+1);setDraft("");setMessage("Added to your habit pool.");
 }
 function questRow(q:Quest){
  const done=isCompleted(q,state.completions,now);
  return <div key={q.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"13px 0",borderBottom:"1px solid #2d3847"}}>
   <div><strong>{q.title}</strong> {q.isNew&&<small style={{color:"#aee0a5"}}>✨ New</small>}<div style={{fontSize:12,color:"#aab5c7"}}>{q.cadence==="weekly"?"Weekly":"Daily"} · +1 XP · Individual streak tracked in production</div></div>
   <button className="btn" disabled={done} onClick={()=>finish(q.id)}>{done?"✓ Done":"Complete"}</button>
  </div>;
 }
 return <main className="wrap" style={{maxWidth:700}}>
  <div className="eyebrow">LIFE ASCENSION · DEVELOPMENT PREVIEW</div><h1>Quest Board 3.0</h1>
  <p className="muted">Interactive local-state prototype only. This page does not write XP, quest completions, or calendar events to your account.</p>
  <section className="panel"><div className="eyebrow">TODAY · {questDay(now)}</div><h2>{completed.length} / {displayed.length} quests completed</h2><p className="muted">Daily selection: {daily.length} · Week of {questWeek(now)} · Demo XP: {state.completions.length}</p><button className="btn ghost" onClick={()=>setNow(new Date())}>Refresh clock</button></section>
  <section className="panel"><h2>Today's Quests</h2>{active.map(questRow)}{!active.length&&<p className="muted">All caught up.</p>}
  <button className="btn ghost" style={{marginTop:14}} onClick={()=>setShowCompleted(x=>!x)} aria-expanded={showCompleted}>{showCompleted?"▾":"▸"} Completed Today ({completed.length})</button>
  {showCompleted&&completed.map(questRow)}</section>
  <section className="panel"><h2>Bonus Quests</h2><p className="muted">Unlock three random options by finishing your displayed daily quests. One reroll per day.</p>
  {bonuses.length>0&&<><button className="btn ghost" onClick={()=>setShowBonus(x=>!x)}>{showBonus?"Hide bonus quests":"Reveal bonus quests"}</button> <button className="btn ghost" disabled={!!state.bonusRerolls[questDay(now)]} onClick={()=>{try{setState(rerollBonus(state,now));setShowBonus(true)}catch(e){setMessage(String(e))}}}>Reroll ({state.bonusRerolls[questDay(now)]?"used":"1 free"})</button></>}
  {showBonus&&bonuses.map(questRow)}</section>
  <section className="panel"><h2>Log an Off-Board Quest</h2><p className="muted">Type the exact name of any habit in the pool, even if it wasn't selected today.</p><input className="field" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="e.g. Floss Teeth"/><div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}><button className="btn" onClick={logText}>Log completion</button><button className="btn ghost" onClick={addQuest}>Add new daily habit</button></div></section>
  <section className="panel"><h2>Goals & Rewards</h2>{state.goals.map(g=><div key={g.id}><strong>{g.title}</strong><p className="muted">Linked habits: {g.linkedQuestIds.length} · Estimated reward: Town decoration</p><button className="btn ghost" onClick={()=>setShowReward(x=>!x)}>{showReward?"Hide":"Preview"} reward stats</button>{showReward&&<p>Comfort +5 <small>(illustrative preview)</small></p>}</div>)}</section>
  {review.length>0&&<section className="panel"><h2>Weekly Check-In</h2><p className="muted">Resolve unfinished weekly quests: completed, pending, or ignored.</p>{review.map(q=><div key={q.id} style={{padding:"10px 0"}}><strong>{q.title}</strong><div className="actions"><button className="btn ghost" onClick={()=>finish(q.id)}>Completed</button><button className="btn ghost" onClick={()=>{setState(s=>({...s,weeklyReviews:[...s.weeklyReviews,{questId:q.id,week:questWeek(now),status:"pending"}]}));setMessage("Pending noted")}}>Pending</button><button className="btn ghost" onClick={()=>setState(s=>({...s,weeklyReviews:[...s.weeklyReviews,{questId:q.id,week:questWeek(now),status:"ignored"}]}))}>Ignored</button></div></div>)}</section>}
  <section className="panel"><h2>Needs Your Input *</h2>{state.pendingInputs.filter(i=>!i.resolvedAt).map(i=><div key={i.id} style={{padding:"12px 0"}}><p>* {i.question}</p><button className="btn ghost" onClick={()=>setState(s=>({...s,pendingInputs:s.pendingInputs.map(p=>p.id===i.id?{...p,resolvedAt:now.toISOString()}:p)}))}>Dismiss</button></div>)}</section>
  <p className="message" role="status" aria-live="polite">{message}</p>
 </main>;
}
