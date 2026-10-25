'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../../../lib/supabase';

type Quest={id:string;title:string;domain:string;cadence:string;scheduled_for:string|null;active:boolean};
function chicagoToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export default function ManageQuests(){
 const [quests,setQuests]=useState<Quest[]>([]);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState<string|null>(null);
 const [signedIn,setSignedIn]=useState(false);
 const load=useCallback(async()=>{
  const client=supabase();
  const {data:{user}}=await client.auth.getUser();
  setSignedIn(!!user);
  if(!user){setLoading(false);return}
  const {data,error}=await client.from('quests').select('id,title,domain,cadence,scheduled_for,active').eq('owner_id',user.id).eq('active',true).order('created_at',{ascending:false}).limit(200);
  if(error)setMessage('Unable to load quests. Please try again.');
  else setQuests(data||[]);
  setLoading(false);
 },[]);
 useEffect(()=>{void load()},[load]);
 async function rename(q:Quest){
  const title=window.prompt('Rename quest',q.title)?.trim();
  if(title===undefined||title===q.title)return;
  if(title.length<1||title.length>120){setMessage('Quest titles must be 1–120 characters.');return}
  setBusy(q.id);const {error}=await supabase().rpc('rename_quest',{p_quest_id:q.id,p_title:title});
  setMessage(error?'Could not rename quest.':'Quest renamed.');await load();setBusy(null);
 }
 async function reschedule(q:Quest){
  const date=window.prompt(q.cadence==='daily'?'New start date (YYYY-MM-DD)':'New due date (YYYY-MM-DD)',q.scheduled_for||chicagoToday());
  if(date===null)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){setMessage('Enter a date as YYYY-MM-DD.');return}
  setBusy(q.id);const {error}=await supabase().rpc('reschedule_quest',{p_quest_id:q.id,p_date:date});
  setMessage(error?'Could not reschedule quest. Completed quests cannot be moved.':'Quest rescheduled.');await load();setBusy(null);
 }
 async function archive(q:Quest){
  if(!window.confirm('Archive "'+q.title+'"? It will disappear from the active board. Existing XP and completion history will remain.'))return;
  setBusy(q.id);const {error}=await supabase().rpc('archive_quest',{p_quest_id:q.id});
  setMessage(error?'Could not archive quest.':'Quest archived. XP history preserved.');await load();setBusy(null);
 }
 return <main className="wrap"><div className="eyebrow">LIFE ASCENSION</div><h1>Manage quests</h1><p className="muted">Rename, change dates, or archive active quests. Archiving never removes earned XP.</p>
 <p><Link href="/">← Back to Quest Board</Link></p>
 {loading?<p>Loading quests…</p>:!signedIn?<p>Please <Link href="/login?next=%2Fquests%2Fmanage">sign in</Link> to manage quests.</p>:<section className="panel"><h2>Active quests</h2>{quests.length===0&&<p>No active quests.</p>}
 {quests.map(q=><div className="quest" key={q.id}><div className="quest-main"><div className="quest-title">{q.title}</div><div className="muted">{q.domain} · {q.cadence} · {q.scheduled_for||'No date set'}</div></div><div className="actions"><button className="btn ghost" disabled={!!busy} onClick={()=>void rename(q)}>Rename</button><button className="btn ghost" disabled={!!busy} onClick={()=>void reschedule(q)}>Reschedule</button><button className="btn ghost" disabled={!!busy} onClick={()=>void archive(q)}>Archive</button></div></div>)}
 </section>}<p className="message" role="status" aria-live="polite">{message}</p></main>;
}
