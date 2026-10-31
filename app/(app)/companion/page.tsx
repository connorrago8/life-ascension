"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {supabase} from "../../../lib/supabase";
import {questDay,questWeek} from "../../../src/lib/quest-board-v3";
type Companion={id:string;display_name:string;consent_confirmed_at:string|null};
type Habit={id:string;title:string;cadence:"daily"|"weekly"|"once";active:boolean};
type Log={id:string;habit_id:string;period_start:string;recorded_at:string};
type Assignment={id:string;quest_id:string;requested_title:string;active:boolean};
export default function CompanionMode(){
 const [profile,setProfile]=useState<Companion|null>(null),[habits,setHabits]=useState<Habit[]>([]),[logs,setLogs]=useState<Log[]>([]);
 const [assignments,setAssignments]=useState<Assignment[]>([]);
 const [lifetimeXp,setLifetimeXp]=useState(0);
 const [ready,setReady]=useState(false),[signedIn,setSignedIn]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [name,setName]=useState("Izzy"),[title,setTitle]=useState(""),[cadence,setCadence]=useState<Habit["cadence"]>("daily");
 const [consent,setConsent]=useState(false);
 const [assignment,setAssignment]=useState("");
 const today=questDay(new Date()),week=questWeek(new Date());
 const load=useCallback(async()=>{
  const client=supabase();const {data:{user}}=await client.auth.getUser();
  setSignedIn(!!user);setReady(true);if(!user)return;
  const {data:profiles,error:pe}=await client.from("quest_companions").select("id,display_name,consent_confirmed_at").eq("owner_id",user.id).order("created_at",{ascending:true}).limit(1);
  if(pe){setMessage("Companion storage is not enabled yet. Migration required.");return}
  const p=(profiles||[])[0] as Companion|undefined;setProfile(p||null);
  if(!p)return;
  const [{data:h,error:he},{data:l,error:le}]=await Promise.all([
   client.from("quest_companion_habits").select("id,title,cadence,active").eq("companion_id",p.id).eq("active",true).order("created_at",{ascending:true}),
   client.from("quest_companion_completions").select("id,habit_id,period_start,recorded_at").eq("companion_id",p.id).order("recorded_at",{ascending:false}).limit(2000)
  ]);
  if(he||le){setMessage("Unable to load companion habits or logs.");return}
  setHabits((h||[]) as Habit[]);setLogs((l||[]) as Log[]);
  const {count:total,error:countError}=await client.from("quest_companion_completions").select("id",{count:"exact",head:true}).eq("companion_id",p.id);
  if(countError)setMessage("Companion XP count is temporarily unavailable.");
  else setLifetimeXp(total||0);
  const {data:a}=await client.from("quest_companion_assignments").select("id,quest_id,requested_title,active").eq("companion_id",p.id).eq("active",true).order("created_at",{ascending:false});
  setAssignments((a||[]) as Assignment[]);
 },[]);
 useEffect(()=>{void load()},[load]);
 const current=useMemo(()=>logs.filter(l=>l.recorded_at>=new Date(Date.now()-7*86400000).toISOString()),[logs]);
 async function createProfile(){
  if(!consent){setMessage("Please confirm Izzy agreed to this tracking first.");return}
  if(!name.trim())return;setBusy(true);
  const client=supabase();const {data:{user}}=await client.auth.getUser();
  if(user){const {error}=await client.from("quest_companions").insert({owner_id:user.id,display_name:name.trim(),consent_confirmed_at:new Date().toISOString()});setMessage(error?.message||"Companion profile created.");}
  await load();setBusy(false);
 }
 async function addHabit(){
  if(!profile||!title.trim()||busy)return;setBusy(true);
  const client=supabase();const {data:{user}}=await client.auth.getUser();
  if(user){const {error}=await client.from("quest_companion_habits").insert({owner_id:user.id,companion_id:profile.id,title:title.trim(),cadence});setMessage(error?.message||"Habit added.");if(!error)setTitle("");}
  await load();setBusy(false);
 }
 async function assignToConnor(){
  if(!profile||!assignment.trim()||busy)return;
  setBusy(true);
  const {data,error}=await supabase().rpc("quest_companion_assign_to_owner",{p_companion_id:profile.id,p_title:assignment.trim()});
  setMessage(error?.message||(data?"💜 Quest assigned to Connor · +2 XP when completed.":"Unable to assign quest."));
  if(!error)setAssignment("");
  await load();setBusy(false);
 }
 async function retireAssignment(id:string){
  if(busy||!window.confirm("Retire this assignment? Future completions return to normal XP."))return;
  setBusy(true);
  const {error}=await supabase().rpc("quest_companion_retire_assignment",{p_assignment_id:id});
  setMessage(error?.message||"Assignment retired. Existing XP remains unchanged.");
  await load();setBusy(false);
 }
 async function log(h:Habit){
  if(!profile||busy)return;setBusy(true);
  const period=h.cadence==="weekly"?week:h.cadence==="daily"?today:"1970-01-01";
  const client=supabase();const {data:{user}}=await client.auth.getUser();
  if(user){const {error}=await client.from("quest_companion_completions").upsert({owner_id:user.id,companion_id:profile.id,habit_id:h.id,period_start:period},{onConflict:"habit_id,period_start",ignoreDuplicates:true});setMessage(error?.message||"Manual completion recorded. +1 companion XP if new.");}
  await load();setBusy(false);
 }
 if(!ready)return <main className="wrap">Loading Companion Mode…</main>;
 if(!signedIn)return <main className="wrap"><h1>Companion Mode</h1><Link className="btn" href="/login?next=%2Fcompanion">Sign in</Link></main>;
 return <main className="wrap"><div className="eyebrow">LIFE ASCENSION · PRIVATE COMPANION MODE</div><h1>💜 {profile?.display_name||"Companion Mode"}</h1><nav aria-label="Companion navigation" style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}><Link className="btn ghost" href="/quest-board-v3">← Quest Board</Link><Link className="btn ghost" href="/play">Hub</Link><Link className="btn ghost" href="/character">Character</Link></nav>
 <p className="muted">You manually log activities. No companion account, automatic monitoring, or penalties for missing logs. Companion XP is separate from your own.</p>
 {!profile?<section className="panel"><h2>Create a companion profile</h2><label>Display name<input className="field" maxLength={40} value={name} onChange={e=>setName(e.target.value)}/></label><label style={{display:"block",margin:"16px 0"}}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I confirm this person agreed to have their habits tracked.</label><button className="btn" disabled={busy||!consent} onClick={createProfile}>Create private profile</button></section>:<>
 <section className="panel"><div className="eyebrow">COMPANION PROGRESSION</div><h2>{lifetimeXp} XP <small>from recorded completions</small></h2><p className="muted">{current.length} completions logged in the last 7 days · Missing entries are unknown, not failures.</p><Link className="btn ghost" href="/quest-board-v3">← My Quest Board</Link></section>
 <section className="panel"><h2>Log {profile.display_name}'s quests</h2>{habits.map(h=>{const period=h.cadence==="weekly"?week:h.cadence==="daily"?today:"1970-01-01";const done=logs.some(l=>l.habit_id===h.id&&l.period_start===period);return <div className="quest" key={h.id}><div className="quest-main"><div className="quest-title">{h.title}</div><div className="muted">{h.cadence} · +1 companion XP · {done?"Logged this period":"Not logged this period"}</div></div><button className="btn" disabled={busy||done} onClick={()=>log(h)}>{done?"✓ Logged":"Log completion"}</button></div>})}</section>
 <section className="panel"><h2>Add a manual quest</h2><input className="field" value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} placeholder="e.g. Workout class"/><select className="field" value={cadence} onChange={e=>setCadence(e.target.value as Habit["cadence"])}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="once">One-time</option></select><button className="btn" disabled={busy||!title.trim()} onClick={addHabit}>Add quest</button></section>
 <section className="panel"><h2>💜 Quests from Izzy → Connor</h2>
 <p className="muted">Type a task for Connor. Matching existing or AI-created quests are upgraded instead of duplicated. Future eligible completions award 2 XP; previous XP stays unchanged.</p>
 <input className="field" value={assignment} maxLength={120} onChange={e=>setAssignment(e.target.value)} placeholder="e.g. Fold and put away laundry" aria-label="Quest for Connor"/>
 <button className="btn" disabled={busy||!assignment.trim()} onClick={assignToConnor}>Assign to Connor · 2 XP</button>
 {assignments.length>0&&<div style={{marginTop:16}}><h3>Assigned quests</h3>{assignments.map(a=><div className="quest" key={a.id}><div className="quest-main"><div className="quest-title">💜 {a.requested_title}</div><div className="muted">Assigned to Connor · +2 XP on eligible completion</div></div><button className="btn ghost" disabled={busy} onClick={()=>retireAssignment(a.id)}>Retire</button></div>)}</div>}</section>
 <section className="panel"><h2>Weekly activity snapshot</h2><p className="muted">{current.length} recorded completions in the past seven days. This is a descriptive count, not an automatic AI assessment.</p>{habits.map(h=><p key={h.id}>{h.title}: {current.filter(l=>l.habit_id===h.id).length} logged</p>)}</section>
 </>}
 {message&&<p className="message" role="status">{message}</p>}
 </main>;
}
