'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from '../../../lib/supabase';
import {journalError,journalTimestamp,moveJournalWeek,type ManualJournal as Journal} from '../../../lib/companion/manual-journal';
import styles from './ManualJournal.module.css';
export default function ManualJournal({pairId,viewerId,connectionActive}:{pairId:string;viewerId:string;connectionActive:boolean}) {
 const client=useMemo(()=>supabase(),[]);
 const [data,setData]=useState<Journal|null>(null),[title,setTitle]=useState(''),[date,setDate]=useState(''),[reason,setReason]=useState(''),[correcting,setCorrecting]=useState('');
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const generation=useRef(0),alive=useRef(false),locked=useRef(false),request=useRef(''),correctionRequest=useRef('');
 const read=useCallback(async(target='')=>{
  const mine=++generation.current;setLoading(true);
  try {
   const auth=await client.auth.getUser();
   if(!alive.current||mine!==generation.current)return;
   if(auth.error||auth.data.user?.id!==viewerId){setData(null);setMessage('Sign-in required');return;}
   const r=await client.rpc('companion_activity',{p_action:'week',p_payload:{pairId,date:target}});
   if(!alive.current||mine!==generation.current)return;
   if(r.error){setData(null);setMessage(journalError(r.error.code,r.error.message));return;}
   const next=r.data as Journal;setData(next);setDate(old=>old||next.today);
  } catch {if(alive.current&&mine===generation.current){setData(null);setMessage(journalError());}}
  finally {if(alive.current&&mine===generation.current)setLoading(false);}
 },[client,pairId,viewerId]);
 useEffect(()=>{alive.current=true;void read();return()=>{alive.current=false;++generation.current;};},[read,connectionActive]);
 async function save(action:'log'|'correct') {
  if(locked.current)return;locked.current=true;setBusy(true);setMessage('Saving manual record…');const mine=generation.current;
  try {
   const auth=await client.auth.getUser();
   if(!alive.current||mine!==generation.current)return;
   if(auth.error||auth.data.user?.id!==viewerId){setData(null);setMessage('Sign-in required');return;}
   const token=action==='log'?request:correctionRequest;token.current ||= crypto.randomUUID();
   const payload=action==='log'?{pairId,requestId:token.current,title,date}:{pairId,requestId:token.current,entryId:correcting,reason};
   const r=await client.rpc('companion_activity',{p_action:action,p_payload:payload});
   if(!alive.current||mine!==generation.current)return;
   if(r.error){setMessage(journalError(r.error.code,r.error.message));return;}
   token.current='';setTitle('');setReason('');setCorrecting('');
   setMessage(action==='log'?'Manual activity saved. Account XP unchanged.':'Correction recorded. Original history retained; account XP unchanged.');
   await read(action==='log'?date:data?.weekStart);
  } catch {if(alive.current)setMessage(journalError());}
  finally {locked.current=false;if(alive.current)setBusy(false);}
 }
 const disabled=busy||loading;
 return <section className={styles.root} aria-label="Private manual companion journal" aria-busy={disabled}>
  <h2>Izzy’s manual activity journal</h2><p>Recorded by you, privately. This tally is separate from Connor’s XP and Izzy’s account XP; nothing syncs automatically.</p>
  <p>No log does not mean an activity was missed.</p>
  {message&&<p role="status" aria-live="polite">{message}</p>}
  {loading&&<p role="status">Loading manual history…</p>}
  <button className="btn ghost" disabled={disabled} onClick={()=>{void read(data?.weekStart);}}>Refresh manual journal</button>
  {data&&<>
   <h3>Week {data.weekStart} – {data.weekEnd}</h3><p><strong>{data.weeklyXp} manual companion XP this week</strong> · 1 per logged real-life activity.</p>
   <div className={styles.actions}><button className="btn ghost" disabled={disabled} onClick={()=>{void read(moveJournalWeek(data.weekStart,-1));}}>Previous journal week</button><button className="btn ghost" disabled={disabled} onClick={()=>{void read();}}>Current journal week</button><button className="btn ghost" disabled={disabled||data.weekEnd>=data.today} onClick={()=>{void read(moveJournalWeek(data.weekStart,1));}}>Next journal week</button></div>
   <p>Weeks run Monday–Sunday in America/Chicago. This is a manual summary, not a shared account balance.</p>
   {data.canLog&&connectionActive?<form onSubmit={e=>{e.preventDefault();void save('log');}}><h3>Log Izzy’s completed real-life activity</h3><label>Completed activity<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} disabled={disabled}/></label><label>Activity date · Chicago<input type="date" required max={data.today} value={date} onChange={e=>setDate(e.target.value)} disabled={disabled}/></label><p>Log one meaningful completed task once. Repeated clicks and the same task/date do not create extra credit.</p><button className="btn" disabled={disabled||!title.trim()||!date}>Save manual activity</button></form>:<p>Connection ended. Your private history remains; new logging is paused.</p>}
   <h3>Activity history</h3>{data.entries.length===0&&<p>No activities recorded for this week. There is nothing to catch up on.</p>}
   {data.entries.map(entry=><article key={entry.id}><h4>{entry.title}</h4><p>{entry.date} · Recorded manually by you · {entry.corrected?'Corrected · excluded from manual tally':'1 manual companion XP'}</p><p>Recorded {journalTimestamp(entry.recordedAt)} · Chicago</p>
    {entry.corrected?<><p>Correction: {entry.correctionReason}</p>{entry.correctedAt&&<p>Correction recorded {journalTimestamp(entry.correctedAt)} · Chicago</p>}</>:correcting===entry.id?<form onSubmit={e=>{e.preventDefault();void save('correct');}}><label>Correction reason<input required maxLength={240} disabled={disabled} value={reason} onChange={e=>setReason(e.target.value)}/></label><p>This excludes the mistaken manual entry; its original record stays in history. No permanent XP is deducted.</p><div className={styles.actions}><button className="btn ghost" disabled={disabled||!reason.trim()}>Record correction</button><button type="button" className="btn ghost" disabled={disabled} onClick={()=>{setCorrecting('');setReason('');correctionRequest.current='';}}>Keep entry</button></div></form>:<button className="btn ghost" disabled={disabled} onClick={()=>{setCorrecting(entry.id);setReason('');correctionRequest.current='';}}>Correct manual entry: {entry.title}</button>}
   </article>)}
  </>}
 </section>;
}
