'use client';
import {useCallback,useEffect,useState,useRef} from 'react';
import {supabase} from '../../lib/supabase';
import {ADVENTURER_CLASS} from '../../lib/character';
import {questReceipt,CADENCE_LABELS,calendarDateOffset} from '../../lib/questReceipt';
import {chicagoDay} from '../../lib/questBoard';
import DailyHighlights from '../../components/DailyHighlights';
import {coerceXp,levelFor} from '../../lib/level';
type Quest={id:string;title:string;domain:string;cadence:'once'|'daily'|'weekly'|'biweekly';created_at:string;scheduled_for:string|null;quest_type:'scheduled'|'goal';quest_class?:'main'|'side';target_amount?:number|null};
type Instance={id:string;quest_id:string;due_date:string;status:'available'|'completed'|'deferred';completed_at:string|null};
const DOMAINS=[['hygiene','Hygiene & appearance'],['home','Home & environment'],['mental_health','Mental health & recovery'],['personal_growth','Growth & hobbies'],['finance','Financial health'],['career','Career & productivity'],['relationships','Relationships'],['physical_health','Physical health']];
function todayLocal(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export default function Home(){
 const [user,setUser]=useState<string|null>(null),[ready,setReady]=useState(false),[quests,setQuests]=useState<Quest[]>([]),[instances,setInstances]=useState<Instance[]>([]),[xp,setXp]=useState(0),[title,setTitle]=useState(''),[dueDate,setDueDate]=useState(''),[questType,setQuestType]=useState<'scheduled'|'goal'>('scheduled'),[domain,setDomain]=useState('home'),[cadence,setCadence]=useState<'once'|'daily'|'weekly'|'biweekly'>('daily'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[mode,setMode]=useState<'daily'|'adventure'>('daily'),[loginHref,setLoginHref]=useState('/login?next=%2F');
 const generation=useRef(0);
 const [pending,setPending]=useState<{id:string;action:'complete'|'defer'|'resume'}|null>(null);
 const [loadError,setLoadError]=useState('');
 const [questClass,setQuestClass]=useState<'main'|'side'>('side');
 const [boardOwner,setBoardOwner]=useState<string|null>(null);
 const [layoutPreview,setLayoutPreview]=useState(false);const [showCompleted,setShowCompleted]=useState(false);const [showQuestForm,setShowQuestForm]=useState(false);
 const load=useCallback(async()=>{
  const version=++generation.current;setBoardOwner(null);setLoadError('');
  if(process.env.NODE_ENV==='development'&&typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('preview')==='1'){
    setLayoutPreview(true);setUser('preview');setReady(true);setQuests([]);setInstances([]);setXp(0);setMessage('');return;
  }
  try{
  setLayoutPreview(false);const client=supabase();const auth=await client.auth.getUser();
  if(version!==generation.current)return;
  if(auth.error)throw auth.error;
  const current=auth.data.user;setUser(current?.id??null);setQuests([]);setInstances([]);setXp(0);setPending(null);setReady(true);
  if(!current)return;
  const stored=localStorage.getItem('life-ascension:pending:'+current.id);
  if(stored){const value=JSON.parse(stored);if(typeof value.id==='string'&&['complete','defer','resume'].includes(value.action))setPending(value);else throw Error('Unrecognized pending action');}
  const q=await client.from('quests').select('*').eq('owner_id',current.id).eq('active',true).order('created_at',{ascending:true});
  if(q.error)throw q.error;
  const all=q.data??[];const today=todayLocal();
  const ensured=await Promise.all(all.filter(quest=>quest.quest_type!=='goal'&&(!quest.scheduled_for||quest.scheduled_for<=today)).map(quest=>client.rpc('ensure_quest_instance',{p_quest_id:quest.id,p_date:today})));
  if(ensured.some(r=>r.error))throw Error('Could not prepare due occurrences.');
  const [result,ledger]=await Promise.all([
    client.from('quest_instances').select('id,quest_id,due_date,status,completed_at').eq('owner_id',current.id).or(`status.neq.completed,completed_at.gte.${calendarDateOffset(today,-1)}T00:00:00Z`).order('due_date',{ascending:true}).limit(1000),
    client.rpc('get_lifetime_xp')]);
  if(result.error||ledger.error)throw result.error??ledger.error;
  if(version!==generation.current)return;
  if((result.data?.length??0)===1000)throw Error('Quest history exceeds board loading limit. Use Journal while we load a narrower range.');
  setQuests(all);setInstances(result.data??[]);setXp(coerceXp(ledger.data));setBoardOwner(current.id);
  }catch(e){if(version===generation.current){setLoadError(e instanceof Error?e.message:'Could not load your quests.');setReady(true)}}
},[]);
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
 useEffect(()=>{let day=todayLocal();const check=()=>{const next=todayLocal();if(next!==day){day=next;void load();}};const timer=window.setInterval(check,30000);document.addEventListener('visibilitychange',check);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',check)}},[load]);
 async function add(e:React.FormEvent){
  e.preventDefault();if(layoutPreview){setMessage('Layout preview. Sign in to save quests.');return}
  if(!title.trim()||busy||pending||!user)return;setBusy(true);
  try{const {error}=await supabase().rpc('create_classified_quest',{p_class:questClass,p_title:title.trim(),p_domain:domain,p_cadence:cadence,p_date:dueDate||todayLocal(),p_quest_type:questType});
   if(error){setMessage(error.message);return}
   setMessage('Quest scheduled.');setTitle('');setDueDate('');setQuestType('scheduled');await load();
  }catch{setMessage('Quest save not confirmed. Reload and check your quests before creating it again.');}finally{setBusy(false)}
 }
 async function act(id:string,action:'complete'|'defer'|'resume'){
  if(layoutPreview||busy||!user||(pending&&(pending.id!==id||pending.action!==action)))return;
  const operation={id,action};const owner=user;const version=generation.current;
  setBusy(true);setMessage('Saving…');
  try{
   // Persist the exact occurrence/action before submitting. Never replay under another account.
   localStorage.setItem('life-ascension:pending:'+owner,JSON.stringify(operation));setPending(operation);
   const {data,error}=await supabase().rpc('set_quest_instance_status_v2',{p_instance_id:id,p_action:action});
   if(version!==generation.current)return;
   if(error){if(error.code==='P0001'||error.code==='42501'){localStorage.removeItem('life-ascension:pending:'+owner);setPending(null);setMessage('Action rejected. No new XP confirmed. '+error.message);await load();return;}throw error;}
   const receipt=questReceipt(data,id);if(!receipt)throw Error('Receipt not confirmed');
   localStorage.removeItem('life-ascension:pending:'+owner);setPending(null);
   setMessage(receipt.xp_awarded===1?'Quest completed · +1 XP':receipt.status==='completed'?
    (receipt.reward_confirmed?'Completion already saved · no additional XP':'Completion saved · reward not verified'):
    receipt.status==='deferred'?'Quest deferred without penalty.':'Quest returned to your board.');
   await load();
  }catch{if(version===generation.current)setMessage('Completion not confirmed yet. Retry the same action; no reward has been confirmed.');}
  finally{setBusy(false)}
 }
 async function classify(id:string,value:'main'|'side'){if(busy||layoutPreview)return;setBusy(true);try{const {error}=await supabase().rpc('set_quest_class',{p_quest_id:id,p_class:value});setMessage(error?.message||'Quest classification saved.');if(!error)await load();}catch{setMessage('Classification save not confirmed. Reload before trying again.');}finally{setBusy(false)}}
 async function logout(){if(layoutPreview){window.location.assign('/login');return}await supabase().auth.signOut();setUser(null)}
 if(!ready)return <main className="wrap">Loading your character…</main>;
 if(!user)return <main className="wrap"><div className="eyebrow">LIFE ASCENSION</div><h1>Your adventure awaits</h1><p className="muted">Real actions. Real progress. Your private quest journal.</p><a className="btn" href={loginHref}>Sign in</a></main>;
 const today=todayLocal();
 const visible=instances.flatMap(instance=>{const quest=quests.find(q=>q.id===instance.quest_id);if(!quest)return [];if(instance.status==='completed'&&(!instance.completed_at||chicagoDay(new Date(instance.completed_at))!==today))return [];
  if(quest.cadence==='daily'&&(instance.due_date<calendarDateOffset(today,-2)||instance.due_date>today))return [];
  if(quest.quest_type!=='goal'&&instance.due_date>today)return [];
  return [{quest,instance}];});
 const completedQuests=visible.filter(x=>x.instance.status==='completed');
 const activeQuests=visible.filter(x=>x.instance.status!=='completed');const completed=completedQuests.length;const lvl=levelFor(xp);
 if(loadError)return <main className="wrap"><h1>Quest Board</h1><p role="alert">{loadError}</p><button className="btn" onClick={()=>void load()}>Retry loading quests</button></main>;
 if(!layoutPreview&&boardOwner!==user)return <main className="wrap"><p role="status">Loading your quests…</p></main>;
 return <main className="wrap">{layoutPreview&&<p className="preview-banner" role="status">Layout preview. Sign in to load your quests.</p>}<header className="top"><div><div className="eyebrow">LIFE ASCENSION</div><h1>{mode==='daily'?'Today’s Quests':'The Adventurer’s Path'}</h1><p className="muted">{new Date(dateString()+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</p></div><button className="btn ghost" onClick={logout}>Sign out</button></header>
 {pending&&<section className="panel"><p role="status">{busy?'Saving your action…':'An action needs confirmation. Retry checks the same occurrence without awarding duplicate XP.'}</p><button className="btn" disabled={busy} onClick={()=>void act(pending.id,pending.action)}>Retry pending action</button></section>}
 {boardOwner===user&&!layoutPreview&&<DailyHighlights disabled={busy||!!pending} onComplete={id=>void act(id,'complete')} cadences={Object.fromEntries(visible.map(({quest,instance})=>[instance.id,CADENCE_LABELS[quest.cadence]]))} ownerId={user} candidates={visible.map(({quest,instance})=>({id:instance!.id,dueDate:instance!.due_date,createdAt:quest.created_at,classification:quest.quest_class??'side',status:instance!.status,eligible:quest.target_amount==null&&instance!.status==='available'&&(quest.cadence!=='daily'||instance!.due_date>=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-1,Number(today.slice(8,10))-2)).toISOString().slice(0,10))}))} titles={Object.fromEntries(visible.map(({quest,instance})=>[instance!.id,quest.title]))}/>}
 <nav className="tabs" aria-label="View mode"><button className={'btn '+(mode==='daily'?'':'ghost')} onClick={()=>setMode('daily')}>Daily Mode</button><button className={'btn '+(mode==='adventure'?'':'ghost')} onClick={()=>setMode('adventure')}>Adventure Mode</button></nav>
 <section className="panel"><div className="eyebrow">LEVEL {lvl.level} · {ADVENTURER_CLASS.toUpperCase()}</div><div className="xp">{xp} <small>lifetime XP</small></div><p className="muted">{completed} of {visible.length} quests completed · No XP penalty for missed days</p><div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={Math.max(visible.length,1)} aria-valuenow={completed}><span style={{width:(visible.length?completed/visible.length*100:0)+'%'}}/></div></section>
 {mode==='adventure'&&<section className="panel"><div className="eyebrow">CHAPTER I</div><h2>The Awakening</h2><p className="muted">Your character grows through real actions. Fantasy encounters are future upgrades.</p></section>}

 <section className="panel"><h2>Quest Board</h2>{visible.length===0&&<p className="muted">Create your first quest below.</p>}{activeQuests.length===0&&visible.length>0&&<p className="muted">All caught up! Your completed quests are tucked away below.</p>}{activeQuests.map(({quest,instance})=><div className={'quest '+(quest.quest_class==='main'?'main-quest':'')} tabIndex={-1} id={instance?`occurrence-${instance.id}`:undefined} key={instance.id}><div className="quest-main"><div className="eyebrow">{quest.quest_class==='main'?'MAIN QUEST':'SIDE QUEST'}</div><a className="quest-title" href={'/quests/'+quest.id}>{quest.title}</a><details><summary>Edit classification</summary><label>Classification<select aria-label={'Classification for '+quest.title} className="field" value={quest.quest_class??'side'} disabled={busy||!!pending} onChange={e=>classify(quest.id,e.target.value as 'main'|'side')}><option value="main">Main</option><option value="side">Side</option></select></label></details><div className="muted">Due {instance?.due_date}{instance&&instance.due_date<today&&instance.status!=='completed'?' · Overdue':''}</div><div className="muted">{DOMAINS.find(d=>d[0]===quest.domain)?.[1]} · {CADENCE_LABELS[quest.cadence]} · +1 XP</div></div><div className="actions">{instance?.status==='completed'?<span className="tag">✓ Done</span>:instance?.status==='deferred'?<button className="btn ghost" disabled={busy||!!pending} onClick={()=>act(instance.id,'resume')}>Resume</button>:<><button className="btn ghost" disabled={busy||!!pending} onClick={()=>act(instance!.id,'defer')}>Defer</button>{quest.target_amount!=null?<span className="muted">Tracked quest · progress controls deferred</span>:<button className="btn" disabled={busy||!!pending} onClick={()=>act(instance!.id,'complete')}>Complete</button>}</>}</div></div>)}{completed>0&&<div style={{marginTop:20,borderTop:'1px solid var(--border, #38404b)',paddingTop:16}}><button type="button" className="btn ghost" aria-expanded={showCompleted} onClick={()=>setShowCompleted(v=>!v)}>{showCompleted?'▾':'▸'} Completed ({completed})</button>{showCompleted&&completedQuests.map(({quest,instance})=><div className="quest" key={quest.id}><div className="quest-main"><div className="quest-title">{quest.title}</div><div className="muted">Completed · {instance?.due_date}</div></div><div className="actions"><span className="tag">✓ Done</span></div></div>)}</div>}</section>
 <section className="panel"><h2>Upcoming</h2><p className="muted">Scheduled quests and deadlines after today (Chicago time).</p>{quests.filter(q=>q.scheduled_for&&q.scheduled_for>today&&(q.cadence==='once'||q.quest_type==='goal')).sort((a,b)=>(a.scheduled_for||'').localeCompare(b.scheduled_for||'')).slice(0,20).map(q=><div className="quest" key={q.id}><div className="quest-main"><div className="quest-title">{q.title}</div><div className="muted">{q.quest_type==='goal'?'Deadline':'Scheduled'} · {q.scheduled_for}</div></div></div>)}</section>
 <section className="panel"><button type="button" className="btn ghost" aria-expanded={showQuestForm} onClick={()=>setShowQuestForm(value=>!value)}>{showQuestForm?'▾ Hide quest creator':'+ Create a quest'}</button>{showQuestForm&&<form onSubmit={add}><h2>Create or approve a quest</h2><p className="muted">Quests proposed in ChatGPT can open here prefilled. Review before saving.</p><label htmlFor="quest-title">What real-world action will you take?</label><input id="quest-title" className="field" maxLength={120} required placeholder="e.g. Fold and put away laundry" value={title} onChange={e=>setTitle(e.target.value)}/><div className="form-row"><label>Classification<select className="field" value={questClass} onChange={e=>setQuestClass(e.target.value as 'main'|'side')}><option value="main">Main</option><option value="side">Side</option></select></label><label>Life domain<select className="field" value={domain} onChange={e=>setDomain(e.target.value)}>{DOMAINS.map(d=><option key={d[0]} value={d[0]}>{d[1]}</option>)}</select></label><label>Frequency<select className="field" value={cadence} disabled={questType==='goal'} onChange={e=>setCadence(e.target.value as 'once'|'daily'|'weekly'|'biweekly')}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="once">One-time</option></select></label></div><label>Quest type<select className="field" value={questType} onChange={e=>{const v=e.target.value as 'scheduled'|'goal';setQuestType(v);if(v==='goal')setCadence('once')}}><option value="scheduled">Scheduled chore / habit</option><option value="goal">Goal with deadline (early completion allowed)</option></select></label><label htmlFor="quest-date">{questType==='goal'?'Goal deadline':'First due date'} (Chicago time)</label><input id="quest-date" className="field" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/><button className="btn" disabled={busy||!!pending||!title.trim()}>Schedule quest</button></form>}</section>
 <p className="message" role="status" aria-live="polite">{message}</p><p className="foot">Self-reported MVP. Health, finance, and AI integrations are not active. <a href="/journal">Completed Journal</a> · <a href="/quests">Quest notes</a> · <a href="/settings/api-keys">API keys</a> · <a href="/settings/password">Set or change password</a></p></main>
}
function dateString(){return todayLocal()}
