'use client';
import {useCallback,useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {ADVENTURER_CLASS} from '../../lib/character';
import {coerceXp,levelFor} from '../../lib/level';
import {QuestProgressControls} from '../../components/QuestProgressControls';
import {completionFeedback} from '../../lib/preview/questReceipt.mjs';
import {confirmedProgressResult} from '../../lib/preview/progressDelta.mjs';
import {hasPendingCompletedRecovery,pendingProgressInstanceIds,recoverableCompletedEntries} from '../../lib/preview/pendingProgress';
type Quest={id:string;title:string;domain:string;cadence:'once'|'daily';created_at:string;scheduled_for:string|null;quest_type:'scheduled'|'goal';target_amount:number|null;progress_unit:string|null;progress_increment:number|null};
type Instance={id:string;quest_id:string;due_date:string;status:'available'|'completed'|'deferred';current_amount:number};
const DOMAINS=[['hygiene','Hygiene & appearance'],['home','Home & environment'],['mental_health','Mental health & recovery'],['personal_growth','Growth & hobbies'],['finance','Financial health'],['career','Career & productivity'],['relationships','Relationships'],['physical_health','Physical health']];
function todayLocal(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export default function Home(){
 const [user,setUser]=useState<string|null>(null),[ready,setReady]=useState(false),[quests,setQuests]=useState<Quest[]>([]),[instances,setInstances]=useState<Instance[]>([]),[xp,setXp]=useState(0),[title,setTitle]=useState(''),[dueDate,setDueDate]=useState(''),[questType,setQuestType]=useState<'scheduled'|'goal'>('scheduled'),[domain,setDomain]=useState('home'),[cadence,setCadence]=useState<'once'|'daily'>('daily'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[mode,setMode]=useState<'daily'|'adventure'>('daily'),[loginHref,setLoginHref]=useState('/login?next=%2F');
 const [trackProgress,setTrackProgress]=useState(false),[targetAmount,setTargetAmount]=useState('8'),[progressUnit,setProgressUnit]=useState('glasses'),[progressIncrement,setProgressIncrement]=useState('1');
 const [layoutPreview,setLayoutPreview]=useState(false);const [showCompleted,setShowCompleted]=useState(false);const [recoveryIds,setRecoveryIds]=useState<string[]>([]);const [recoveryQuests,setRecoveryQuests]=useState<Quest[]>([]);const [showQuestForm,setShowQuestForm]=useState(false);
 // A completed quest with an unconfirmed request must expose Retry after refresh.
 useEffect(()=>{
  if(hasPendingCompletedRecovery(instances,key=>localStorage.getItem(key)))setShowCompleted(true);
 },[instances]);
 const load=useCallback(async()=>{
  if(process.env.NODE_ENV==='development'&&typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('preview')==='1'){
    setLayoutPreview(true);setUser('preview');setReady(true);setQuests([]);setRecoveryQuests([]);setInstances([]);setXp(0);setMessage('');return;
  }
  setLayoutPreview(false);const s=supabase();const {data:{user},error:authError}=await s.auth.getUser();setUser(user?.id||null);setReady(true);if(authError||!user)return;
 // Recover only journal-backed older completed instances owned by this signed-in user.
 // Never query arbitrary history or trust a browser key without server owner filtering.
 let pendingIds:string[]=[];try{pendingIds=pendingProgressInstanceIds(localStorage)}catch{/* Storage getter denied; never query broad history. */}
 const {data:q,error:qe}=await s.from('quests').select('id,title,domain,cadence,created_at,scheduled_for,quest_type,target_amount,progress_unit,progress_increment').eq('active',true).order('created_at',{ascending:true});if(qe){setMessage(qe.message);return}const all=q||[];setQuests(all);const ensured=await Promise.all(all.filter(quest=>quest.quest_type!=='goal'&&(!quest.scheduled_for||quest.scheduled_for<=todayLocal())).map(quest=>s.rpc('ensure_quest_instance',{p_quest_id:quest.id,p_date:todayLocal()})));const instanceError=ensured.find(r=>r.error)?.error;if(instanceError){setMessage(instanceError.message);return}const today=todayLocal();
const goalIds=all.filter(q=>q.quest_type==='goal').map(q=>q.id);
const onceIds=all.filter(q=>q.quest_type==='scheduled'&&q.cadence==='once').map(q=>q.id);
const [{data:todayRows,error:te},{data:goals,error:ge},{data:openOnce,error:oe},{data:ledger,error:le},{data:recoveries,error:re}]=await Promise.all([
 s.from('quest_instances').select('id,quest_id,due_date,status,current_amount').eq('owner_id',user.id).eq('due_date',today).limit(1000),
 goalIds.length?s.from('quest_instances').select('id,quest_id,due_date,status,current_amount').eq('owner_id',user.id).in('quest_id',goalIds).limit(1000):Promise.resolve({data:[] as Instance[],error:null}),
 onceIds.length?s.from('quest_instances').select('id,quest_id,due_date,status,current_amount').eq('owner_id',user.id).in('quest_id',onceIds).lte('due_date',today).neq('status','completed').limit(1000):Promise.resolve({data:[] as Instance[],error:null}),
 s.rpc('get_lifetime_xp'),
 pendingIds.length?s.from('quest_instances').select('id,quest_id,due_date,status,current_amount').eq('owner_id',user.id).in('id',pendingIds).eq('status','completed').limit(100):Promise.resolve({data:[] as Instance[],error:null})
]);
if(te||ge||oe||le||re){setMessage(te?.message||ge?.message||oe?.message||le?.message||re?.message||'Unable to load');return}
// A pending retry must remain visible if its quest was archived after completion.
// Fetch metadata only for server-confirmed, owner-scoped recovered instances.
const missingRecoveryQuestIds=[...new Set((recoveries||[]).map(row=>row.quest_id))].filter(id=>!all.some(quest=>quest.id===id));
const {data:missingRecoveryQuests,error:missingRecoveryError}=missingRecoveryQuestIds.length
 ?await s.from('quests').select('id,title,domain,cadence,created_at,scheduled_for,quest_type,target_amount,progress_unit,progress_increment').eq('owner_id',user.id).in('id',missingRecoveryQuestIds).limit(100)
 :{data:[] as Quest[],error:null};
if(missingRecoveryError){setMessage(missingRecoveryError.message);return}
setRecoveryQuests(missingRecoveryQuests||[]);
const rows=new Map<string,Instance>();for(const row of [...(todayRows||[]),...(goals||[]),...(openOnce||[]),...(recoveries||[])])rows.set(row.id,row);
setRecoveryIds((recoveries||[]).map(row=>row.id));setInstances([...rows.values()]);setXp(coerceXp(ledger))},[]);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const next=window.location.pathname+window.location.search+window.location.hash;
  setLoginHref('/login?next='+encodeURIComponent(next||'/'));
  if(!user)return;
  const proposedTitle=params.get('quest');
  const proposedDomain=params.get('domain');
  const proposedCadence=params.get('cadence');
  if(proposedTitle && proposedTitle.trim().length<=120){
    setTitle(proposedTitle.trim());
    if(DOMAINS.some(d=>d[0]===proposedDomain))setDomain(proposedDomain!);
    if(proposedCadence==='once'||proposedCadence==='daily')setCadence(proposedCadence);
    setShowQuestForm(true);setMessage('AI quest proposal loaded. Review and select Add quest to save it.');
    window.history.replaceState({},'',window.location.pathname);
  }
 },[user]);
 useEffect(()=>{void load();const {data:{subscription}}=supabase().auth.onAuthStateChange(()=>{void load()});return()=>subscription.unsubscribe()},[load]);
 async function add(e:React.FormEvent){e.preventDefault();if(layoutPreview){setMessage('Layout preview. Sign in to save quests.');return}if(!title.trim()||busy||!user)return;setBusy(true);const payload={p_title:title.trim(),p_domain:domain,p_cadence:cadence,p_date:dueDate||todayLocal(),p_quest_type:questType};
 const {error}=trackProgress
   ? await supabase().rpc('create_tracked_quest',{...payload,p_target:Number(targetAmount),p_unit:progressUnit.trim(),p_increment:Number(progressIncrement)})
   : await supabase().rpc('create_scheduled_quest',payload);
 setMessage(error?.message||'Quest scheduled.');if(!error){setTitle('');setDueDate('');setQuestType('scheduled');setTrackProgress(false);}await load();setBusy(false)}
 async function act(id:string,action:'complete'|'defer'|'resume'){
  if(layoutPreview){setMessage('Layout preview. Sign in to update quests.');return}
  if(busy)return;
  if(action==='complete'&&!window.confirm('Confirm you actually completed this quest?'))return;
  setBusy(true);
  try {
    if(action==='complete'){
      // Only the versioned, quest-scoped receipt may justify a new XP claim.
      // QA must include Alpha PR #31's reviewed v2 migration before this draft is deployed.
      const {data,error}=await supabase().rpc('set_quest_instance_status_v2',{p_instance_id:id,p_action:action});
      setMessage(error?.message||completionFeedback(data,id));
    } else {
      const {error}=await supabase().rpc('set_quest_instance_status',{p_instance_id:id,p_action:action});
      setMessage(error?.message||(action==='defer'?'Quest deferred without penalty.':'Quest returned to your board.'));
    }
    await load();
  } catch {
    setMessage('Quest update not confirmed. Refresh before retrying.');
  } finally {setBusy(false)}
 }
 async function logProgress(id:string,requestId:string,delta:number):Promise<'saved'|'retry'|'rejected'>{
  if(layoutPreview||busy)return 'retry';
  setBusy(true);
  try {
   const {data,error}=await supabase().rpc('log_quest_progress',{p_instance_id:id,p_request_id:requestId,p_delta:delta});
   if(error){
    // Transport/server errors may have committed before the response was lost.
    const definite=/^(22|23|P0001)/.test(error.code ?? '');
    const ambiguous=!definite;
    setMessage(ambiguous?'Save not confirmed. Retry the pending operation.':error.message);
    if(!ambiguous)await load();
    return ambiguous?'retry':'rejected';
   }
   const confirmation=confirmedProgressResult(data);
   if(!confirmation){
    // A missing/malformed RPC result may follow a committed operation: keep its request ID.
    setMessage('Progress save response not verified. Retry the same operation.');
    return 'retry';
   }
   setMessage(confirmation.status === 'completed'
    ? 'Quest completion confirmed. XP is displayed from your account ledger.'
    : 'Progress saved.');
   await load();
   return 'saved';
  } catch {
   setMessage('Connection lost. Retry the pending operation; do not log again.');
   return 'retry';
  } finally {setBusy(false);}
 }
 // A confirmed retry clears its journal after load() snapshots pending IDs.
 // Reconcile the parent recovery list without another network query.
 function journalResolved(instanceId:string){setRecoveryIds(ids=>ids.filter(id=>id!==instanceId))}
 async function logout(){if(layoutPreview){window.location.assign('/login');return}await supabase().auth.signOut();setUser(null)}
 if(!ready)return <main className="wrap">Loading your character…</main>;
 if(!user)return <main className="wrap"><div className="eyebrow">LIFE ASCENSION</div><h1>Your adventure awaits</h1><p className="muted">Real actions. Real progress. Your private quest journal.</p><a className="btn" href={loginHref}>Sign in</a></main>;
 const today=todayLocal();const visible=quests.map(q=>({quest:q,instance:q.cadence==='daily'?instances.find(i=>i.quest_id===q.id&&i.due_date===today):instances.find(i=>i.quest_id===q.id)})).filter(x=>!!x.instance&&(x.quest.quest_type==='goal'?x.instance!.status!=='completed'||x.instance!.due_date===today:x.quest.cadence==='daily'||x.instance!.status!=='completed'||x.instance!.due_date===today));const completedQuests=visible.filter(x=>x.instance?.status==='completed');const earlierRecoveries=recoverableCompletedEntries(instances,recoveryIds,quests,recoveryQuests,completedQuests.map(x=>x.instance!.id));const activeQuests=visible.filter(x=>x.instance?.status!=='completed');const completed=completedQuests.length;const lvl=levelFor(xp);
 return <main className="wrap">{layoutPreview&&<p className="preview-banner" role="status">Layout preview. Sign in to load your quests.</p>}<header className="top"><div><div className="eyebrow">LIFE ASCENSION</div><h1>{mode==='daily'?'Today’s Quests':'The Adventurer’s Path'}</h1><p className="muted">{new Date(dateString()+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</p></div><button className="btn ghost" onClick={logout}>Sign out</button></header>
 <nav className="tabs" aria-label="View mode"><button className={'btn '+(mode==='daily'?'':'ghost')} onClick={()=>setMode('daily')}>Daily Mode</button><button className={'btn '+(mode==='adventure'?'':'ghost')} onClick={()=>setMode('adventure')}>Adventure Mode</button></nav>
 <section className="panel"><div className="eyebrow">LEVEL {lvl.level} · {ADVENTURER_CLASS.toUpperCase()}</div><div className="xp">{xp} <small>lifetime XP</small></div><p className="muted">{completed} of {visible.length} quests completed · No XP penalty for missed days</p><div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={Math.max(visible.length,1)} aria-valuenow={completed}><span style={{width:(visible.length?completed/visible.length*100:0)+'%'}}/></div></section>
 {mode==='adventure'&&<section className="panel"><div className="eyebrow">CHAPTER I</div><h2>The Awakening</h2><p className="muted">Your character grows through real actions. Fantasy encounters are future upgrades.</p></section>}
 <section className="panel"><h2>Quest Board</h2>{visible.length===0&&<p className="muted">Create your first quest below.</p>}{activeQuests.length===0&&visible.length>0&&<p className="muted">All caught up! Your completed quests are tucked away below.</p>}{activeQuests.map(({quest,instance})=><div className="quest" key={quest.id}><div className="quest-main"><div className="quest-title">{quest.title}</div><div className="muted">Due {instance?.due_date}{instance&&instance.due_date<today&&instance.status!=='completed'?' · Overdue':''}</div><details className="quest-card-details"><summary aria-label={"Quest details for " + quest.title}>Quest details</summary><p className="muted">{DOMAINS.find(d=>d[0]===quest.domain)?.[1]} · {quest.cadence==='daily'?'Daily':'One-time'}</p></details></div>{instance?.status==='available'&&quest.target_amount!=null&&<QuestProgressControls onJournalResolved={journalResolved} quest={quest} instance={instance} disabled={busy} onLog={logProgress}/> }<div className="actions quest-card-actions" aria-label={`Actions for ${quest.title}`}>{instance?.status==='completed'?<span className="tag">✓ Done</span>:instance?.status==='deferred'?<button className="btn ghost" disabled={busy} onClick={()=>act(instance.id,'resume')}>Resume</button>:<><button className="btn ghost" disabled={busy} onClick={()=>act(instance!.id,'defer')}>Defer</button>{quest.target_amount==null&&<button className="btn" disabled={busy} onClick={()=>act(instance!.id,'complete')}>Complete</button>}</>}</div></div>)}{completed>0&&<div style={{marginTop:20,borderTop:'1px solid var(--border, #38404b)',paddingTop:16}}><button type="button" className="btn ghost" aria-expanded={showCompleted} onClick={()=>setShowCompleted(v=>!v)}>{showCompleted?'▾':'▸'} Completed ({completed})</button>{showCompleted&&completedQuests.map(({quest,instance})=><div className="quest" key={quest.id}><div className="quest-main"><div className="quest-title">{quest.title}</div><div className="muted">Completed · {instance?.due_date}</div></div><div className="actions"><span className="tag">✓ Done</span></div><QuestProgressControls onJournalResolved={journalResolved} quest={quest} instance={instance!} disabled={busy} onLog={logProgress}/></div>)}</div>}</section>
 {earlierRecoveries.length>0&&<section className="panel"><h2>Completed quests with pending saves</h2><p className="muted">Review the original saved request before logging new progress. Retry never creates another request ID.</p>{earlierRecoveries.map(({quest,instance})=><div className="quest" key={instance.id}><div className="quest-main"><div className="quest-title">{quest.title}</div><div className="muted">Completed · {instance.due_date}</div></div><QuestProgressControls onJournalResolved={journalResolved} quest={quest} instance={instance} disabled={busy} onLog={logProgress}/></div>)}</section>}
 <section className="panel"><h2>Upcoming</h2><p className="muted">Scheduled quests and deadlines after today (Chicago time).</p>{quests.filter(q=>q.scheduled_for&&q.scheduled_for>today&&(q.cadence==='once'||q.quest_type==='goal')).sort((a,b)=>(a.scheduled_for||'').localeCompare(b.scheduled_for||'')).slice(0,20).map(q=><div className="quest" key={q.id}><div className="quest-main"><div className="quest-title">{q.title}</div><div className="muted">{q.quest_type==='goal'?'Deadline':'Scheduled'} · {q.scheduled_for}</div></div></div>)}</section>
 <section className="panel"><button type="button" className="btn ghost" aria-expanded={showQuestForm} onClick={()=>setShowQuestForm(value=>!value)}>{showQuestForm?'▾ Hide quest creator':'+ Create a quest'}</button>{showQuestForm&&<form onSubmit={add}><h2>Create or approve a quest</h2><p className="muted">Quests proposed in ChatGPT can open here prefilled. Review before saving.</p><label htmlFor="quest-title">What real-world action will you take?</label><input id="quest-title" className="field" maxLength={120} required placeholder="e.g. Fold and put away laundry" value={title} onChange={e=>setTitle(e.target.value)}/><div className="form-row"><label>Life domain<select className="field" value={domain} onChange={e=>setDomain(e.target.value)}>{DOMAINS.map(d=><option key={d[0]} value={d[0]}>{d[1]}</option>)}</select></label><label>Frequency<select className="field" value={cadence} disabled={questType==='goal'} onChange={e=>setCadence(e.target.value as 'once'|'daily')}><option value="daily">Every day</option><option value="once">One-time</option></select></label></div><label>Quest type<select className="field" value={questType} onChange={e=>{const v=e.target.value as 'scheduled'|'goal';setQuestType(v);if(v==='goal')setCadence('once')}}><option value="scheduled">Scheduled chore / habit</option><option value="goal">Goal with deadline (early completion allowed)</option></select></label><label htmlFor="quest-date">{questType==='goal'?'Goal deadline':'First due date'} (Chicago time)</label><input id="quest-date" className="field" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/><label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={trackProgress} onChange={e=>setTrackProgress(e.target.checked)}/> Track partial progress (optional)</label>{trackProgress&&<div className="form-row"><label>Target amount<input className="field" type="number" min={1} max={1000000} step={1} value={targetAmount} onChange={e=>setTargetAmount(e.target.value)}/></label><label>Unit<input className="field" maxLength={32} value={progressUnit} onChange={e=>setProgressUnit(e.target.value)}/></label><label>Quick-log increment<input className="field" type="number" min={1} max={targetAmount||1} step={1} value={progressIncrement} onChange={e=>setProgressIncrement(e.target.value)}/></label></div>}<button className="btn" disabled={busy||!title.trim()||(trackProgress&&(!Number.isInteger(Number(targetAmount))||Number(targetAmount)<1||Number(targetAmount)>1000000||!progressUnit.trim()||!Number.isInteger(Number(progressIncrement))||Number(progressIncrement)<1||Number(progressIncrement)>Number(targetAmount)))}>Schedule quest</button></form>}</section>
 <p className="message" role="status" aria-live="polite">{message}</p><p className="foot">Self-reported MVP. Health, finance, and AI integrations are not active. <a href="/quests">Quest notes</a> · <a href="/settings/api-keys">API keys</a> · <a href="/settings/password">Set or change password</a></p></main>
}
function dateString(){return todayLocal()}
