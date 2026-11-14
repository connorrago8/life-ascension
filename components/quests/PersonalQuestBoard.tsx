'use client';
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {questDetailHref} from '../../lib/questCardTap';
import {supabase} from '../../lib/supabase';
import {levelFor} from '../../lib/level';
import {verifiedLifetimeXp} from '../../lib/characterXpProof';
import {QuestProgressControls} from '../../components/QuestProgressControls';
import {QuestDetails} from '../../components/QuestDetails';
import {ConfirmCompleteButton} from '../../components/ConfirmCompleteButton';
import {IzzyProof} from '../../components/IzzyProof';
import {completionFeedback} from '../../lib/preview/questReceipt.mjs';
import {confirmedProgressResult} from '../../lib/preview/progressDelta.mjs';
import {hasPendingCompletedRecovery,pendingProgressInstanceIds,recoverableCompletedEntries} from '../../lib/preview/pendingProgress';
import {gameDayParts,parseStreak,weekStart,weeklyAppearOffset,weeklyVisible,type StreakState} from '../../lib/questStreak';
import {StreakShieldNote} from '../../components/couple/StreakShieldNote';
import {PHARMACY_WEEKLY_TITLES,weekdayLabel} from '../../lib/questAutopilot';
import {previewBoard} from '../../lib/questBoardPreview';
import {matchesChip,partnerChipLabel,prioritizePending,questDetailChip,taskArea,type QuestChip} from '../../lib/questWorkspace';
import {awardStamp,claimAward,confirmedAwardAmount,emptyCopy,restoreRow,sectionSlice,shouldVibrate,withStatus} from '../../lib/questPolish';
import {LIVE_PROGRESS_EFFECTS} from '../../lib/liveProgress';
import {assignTargetName,markPartnerSeen,partnerOwnershipTag,readSeenPartner,SEEN_PARTNER_KEY,unseenPartnerCount} from '../../lib/partnerQueue';
import {readSectionOpen,writeSectionOpen,type QuestSectionId} from '../../lib/questSections';
import {coupleBucket,type CoupleQuestView} from '../../lib/coupleQuestView';
import {useCompanionRole} from '../useCompanionRole';
import TogetherQuestPanel from './TogetherQuestPanel';
type Quest={id:string;title:string;domain:string;cadence:'once'|'daily'|'weekly';created_at:string;scheduled_for:string|null;quest_type:'scheduled'|'goal';target_amount:number|null;progress_unit:string|null;progress_increment:number|null;companion_one_shot?:boolean|null;fixed_reveal?:boolean|null;weekly_weekday?:number|null;description?:string|null};
type Instance={id:string;quest_id:string;due_date:string;status:'available'|'completed'|'deferred';current_amount:number};
const DOMAINS=[['hygiene','Hygiene & appearance'],['home','Home & environment'],['mental_health','Mental health & recovery'],['personal_growth','Growth & hobbies'],['finance','Financial health'],['career','Career & productivity'],['relationships','Relationships'],['physical_health','Physical health']];
function todayLocal(){return gameDayParts(new Date()).date}
export default function PersonalQuestBoard({chip,focus,couple,onMarkCouple,coupleBusy,onUnseen}:{chip:QuestChip;focus:'today'|'week'|'later'|'done';couple:CoupleQuestView[];onMarkCouple:(id:string)=>void;coupleBusy:boolean;onUnseen?:(count:number)=>void}){
 const role=useCompanionRole();
 const companion=role.mode==='companion';
 const partnerLabel=partnerChipLabel(companion);
 useEffect(()=>{setDomain(chip==='work'?'career':'home')},[chip]);
 const [user,setUser]=useState<string|null>(null),[ready,setReady]=useState(false),[quests,setQuests]=useState<Quest[]>([]),[instances,setInstances]=useState<Instance[]>([]),[xp,setXp]=useState<number|null>(null),[title,setTitle]=useState(''),[dueDate,setDueDate]=useState(''),[questType,setQuestType]=useState<'scheduled'|'goal'>('scheduled'),[domain,setDomain]=useState('home'),[cadence,setCadence]=useState<'once'|'daily'|'weekly'>('daily'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loginHref,setLoginHref]=useState('/login?next=%2Fquests');
 const [trackProgress,setTrackProgress]=useState(false),[targetAmount,setTargetAmount]=useState('8'),[progressUnit,setProgressUnit]=useState('glasses'),[progressIncrement,setProgressIncrement]=useState('1');
 const [layoutPreview,setLayoutPreview]=useState(false);const [showCompleted,setShowCompleted]=useState(false);const [recoveryIds,setRecoveryIds]=useState<string[]>([]);const [recoveryQuests,setRecoveryQuests]=useState<Quest[]>([]);const [showQuestForm,setShowQuestForm]=useState(false);
 // The streak is tagged with its account so a sign-out or account switch can never show another account's fire.
 const [streakFor,setStreak]=useState<{owner:string;state:StreakState}|null>(null);
 const [fromIzzy,setFromIzzy]=useState<Set<string>>(new Set());const [izzyColor,setIzzyColor]=useState('amber');const [nudged,setNudged]=useState<Set<string>>(new Set());
 const questFormRef=useRef<HTMLFormElement>(null);const openQuestFormOnRender=useRef(false);
 const loadEpoch=useRef(0);const accountRef=useRef<string|null>(null);
 const questCreateInFlight=useRef(false);
 const questActionInFlight=useRef(false);
 const seenAwards=useRef(new Set<string>());
 const buckets=useRef({today:[] as Instance[],goals:[] as Instance[],once:[] as Instance[],weekly:[] as Instance[],recovery:[] as Instance[]});
 const [sectionErrors,setSectionErrors]=useState<Record<string,string>>({});
 const [award,setAward]=useState<{id:string;amount:number;key:string}|null>(null);
 const [seenPartner,setSeenPartner]=useState<Set<string>>(new Set());
 const [fromOpen,setFromOpen]=useState(false);
 const [forPartner,setForPartner]=useState(false);
 const [sent,setSent]=useState<{id:string;title:string;status:string}[]>([]);
 const fromAuto=useRef(false);
 // A completed quest with an unconfirmed request must expose Retry after refresh.
 useEffect(()=>{
  if(hasPendingCompletedRecovery(instances,key=>localStorage.getItem(key)))setShowCompleted(true);
 },[instances]);
 useEffect(()=>{
  if(!user||user==='preview'){setFromIzzy(new Set());return;}
  let cancel=false;
  void supabase().from('companion_quests').select('id, quest_id').eq('to_user',user).in('status',['accepted','completed']).then(({data,error})=>{
   if(cancel||error||!Array.isArray(data))return;
   const rows=data as {id?:string|null;quest_id?:string|null}[];
   setFromIzzy(new Set(rows.map(row=>row.quest_id).filter((id):id is string=>!!id)));
   void supabase().from('companion_nudges').select('quest_id').eq('game_day',todayLocal()).then(({data:nudgeRows})=>{
    if(cancel||!Array.isArray(nudgeRows))return;
    const nudgedIds=new Set((nudgeRows as {quest_id?:string}[]).map(row=>row.quest_id));
    setNudged(new Set(rows.filter(row=>row.quest_id&&row.id&&nudgedIds.has(row.id)).map(row=>row.quest_id as string)));
   });
   void supabase().from('companion_bonds').select('companion_id').eq('inviter_id',user).eq('status','active').maybeSingle().then(({data:bond})=>{
    const companionId=(bond as {companion_id?:string}|null)?.companion_id;
    if(!companionId)return;
    void supabase().from('companion_identities').select('quest_color').eq('user_id',companionId).maybeSingle().then(({data:ident})=>{
     const next=(ident as {quest_color?:string}|null)?.quest_color;
     if(next)setIzzyColor(next);
    });
   });
  });
  return()=>{cancel=true;};
 },[user,instances]);
 const load=useCallback(async(expectedProgressInstanceId?:string)=>{const epoch=++loadEpoch.current;
  if(process.env.NODE_ENV==='development'&&typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('preview')==='1'){
    const sample=previewBoard(todayLocal());setLayoutPreview(true);setUser('preview');setReady(true);setQuests(sample.quests);setRecoveryQuests([]);setInstances(sample.instances);setStreak({owner:'preview',state:sample.streak});setXp(0);setMessage('');return false;
  }
  setLayoutPreview(false);const s=supabase();const {data:{user},error:authError}=await s.auth.getUser();if(epoch!==loadEpoch.current)return false;const nextAccount=authError?null:(user?.id||null);if(accountRef.current!==nextAccount){accountRef.current=nextAccount;setQuests([]);setInstances([]);setRecoveryQuests([]);setRecoveryIds([]);setXp(null);}setUser(nextAccount);setReady(true);if(authError||!user)return false;
 // Recover only journal-backed older completed instances owned by this signed-in user.
 // Never query arbitrary history or trust a browser key without server owner filtering.
 let pendingIds:string[]=[];try{pendingIds=pendingProgressInstanceIds(localStorage)}catch{/* Storage getter denied; never query broad history. */}
 const {data:q,error:qe}=await s.from('quests').select('id,title,domain,cadence,created_at,scheduled_for,quest_type,target_amount,progress_unit,progress_increment,companion_one_shot,fixed_reveal,weekly_weekday,description').eq('active',true).order('created_at',{ascending:true});if(epoch!==loadEpoch.current)return false;if(qe){setMessage(qe.message);return false}const all=q||[];const ensured=await Promise.all(all.filter(quest=>quest.quest_type!=='goal'&&(!quest.scheduled_for||quest.scheduled_for<=todayLocal())).map(quest=>s.rpc('ensure_quest_instance',{p_quest_id:quest.id,p_date:todayLocal()})));if(epoch!==loadEpoch.current)return false;const instanceError=ensured.find(r=>r.error)?.error;if(instanceError){setMessage(instanceError.message);return false}const today=todayLocal();
const goalIds=all.filter(q=>q.quest_type==='goal').map(q=>q.id);
const onceIds=all.filter(q=>q.quest_type==='scheduled'&&q.cadence==='once').map(q=>q.id);
// Weekly quests: one instance per local week, keyed by its Monday (see lib/questStreak.ts).
const weeklyIds=all.filter(q=>q.cadence==='weekly').map(q=>q.id);
const [{data:todayRows,error:te},{data:goals,error:ge},{data:openOnce,error:oe},{data:ledger,error:le},{data:recoveries,error:re},{data:weeklyRows,error:we},streakResult]=await Promise.all([
 s.from('quest_instances').select('id,quest_id,due_date,status,current_amount').eq('owner_id',user.id).eq('due_date',today).limit(1000),
 goalIds.length?s.from('quest_instances').select('id,quest_id,due_date,status,current_amount').eq('owner_id',user.id).in('quest_id',goalIds).limit(1000):Promise.resolve({data:[] as Instance[],error:null}),
 onceIds.length?s.from('quest_instances').select('id,quest_id,due_date,status,current_amount').eq('owner_id',user.id).in('quest_id',onceIds).neq('status','completed').limit(1000):Promise.resolve({data:[] as Instance[],error:null}),
 s.rpc('get_lifetime_xp'),
 pendingIds.length?s.from('quest_instances').select('id,quest_id,due_date,status,current_amount').eq('owner_id',user.id).in('id',pendingIds).eq('status','completed').limit(100):Promise.resolve({data:[] as Instance[],error:null}),
 weeklyIds.length?s.from('quest_instances').select('id,quest_id,due_date,status,current_amount').eq('owner_id',user.id).in('quest_id',weeklyIds).eq('due_date',weekStart(today)).limit(1000):Promise.resolve({data:[] as Instance[],error:null}),
 // The streak badge is optional: a database without get_quest_streak simply hides it.
 Promise.resolve(s.rpc('get_quest_streak')).catch(()=>({data:null,error:true}))
]);
if(epoch!==loadEpoch.current)return false;
const todaySlice=sectionSlice(buckets.current.today,te,todayRows);
const goalSlice=sectionSlice(buckets.current.goals,ge,goals);
const onceSlice=sectionSlice(buckets.current.once,oe,openOnce);
const weekSlice=sectionSlice(buckets.current.weekly,we,weeklyRows);
const recoverySlice=sectionSlice(buckets.current.recovery,re,recoveries);
buckets.current={today:todaySlice.rows,goals:goalSlice.rows,once:onceSlice.rows,weekly:weekSlice.rows,recovery:recoverySlice.rows};
const nextErrors={today:'',week:'',upcoming:'',completed:''};
if(todaySlice.error)nextErrors.today=todaySlice.error;
if(weekSlice.error)nextErrors.week=weekSlice.error;
if(goalSlice.error||onceSlice.error)nextErrors.upcoming=goalSlice.error||onceSlice.error||'Could not load this section.';
if(recoverySlice.error)nextErrors.completed=recoverySlice.error;
setSectionErrors(nextErrors);
if(le||todaySlice.error||weekSlice.error||goalSlice.error||onceSlice.error||recoverySlice.error){
 setMessage(le?'Lifetime XP could not be verified. Refresh to retry; no XP was changed.':'Part of the board could not refresh.');
 return false;
}
const todayRowsKept=todaySlice.rows,goalsKept=goalSlice.rows,openOnceKept=onceSlice.rows,recoveriesKept=recoverySlice.rows,weeklyRowsKept=weekSlice.rows;
// A pending retry must remain visible if its quest was archived after completion.
// Fetch metadata only for server-confirmed, owner-scoped recovered instances.
const missingRecoveryQuestIds=[...new Set((recoveriesKept||[]).map(row=>row.quest_id))].filter(id=>!all.some(quest=>quest.id===id));
const {data:missingRecoveryQuests,error:missingRecoveryError}=missingRecoveryQuestIds.length
 ?await s.from('quests').select('id,title,domain,cadence,created_at,scheduled_for,quest_type,target_amount,progress_unit,progress_increment,companion_one_shot,fixed_reveal,weekly_weekday,description').eq('owner_id',user.id).in('id',missingRecoveryQuestIds).limit(100)
 :{data:[] as Quest[],error:null};
if(epoch!==loadEpoch.current)return false;
if(missingRecoveryError){setMessage(missingRecoveryError.message);return false}
const verifiedXp = verifiedLifetimeXp(ledger);
setQuests(all);setRecoveryQuests(missingRecoveryQuests||[]);
const rows=new Map<string,Instance>();for(const row of [...todayRowsKept,...goalsKept,...openOnceKept,...recoveriesKept,...weeklyRowsKept])rows.set(row.id,row);
setRecoveryIds(recoveriesKept.map(row=>row.id));setInstances([...rows.values()]);setXp(verifiedXp);{const parsed=streakResult.error?null:parseStreak(streakResult.data);setStreak(parsed?{owner:user.id,state:parsed}:null)}
if(verifiedXp===null){
 setMessage('Lifetime XP could not be verified. Refresh to retry; no XP was changed.');
 return !expectedProgressInstanceId||rows.get(expectedProgressInstanceId)||false;
}
// A successful page reload is not proof of this save if its instance was omitted.
// Keep the original idempotent request until an owner-scoped refreshed row is visible.
return !expectedProgressInstanceId||rows.get(expectedProgressInstanceId)||false},[]);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const next=window.location.pathname+window.location.search+window.location.hash;
  setLoginHref('/login?next='+encodeURIComponent(next||'/quests'));
  if(!user)return;
  const proposedTitle=params.get('quest');
  const proposedDomain=params.get('domain');
  const proposedCadence=params.get('cadence');
  if(proposedTitle && proposedTitle.trim().length<=120){
    setTitle(proposedTitle.trim());
    if(DOMAINS.some(d=>d[0]===proposedDomain))setDomain(proposedDomain!);
    if(proposedCadence==='once'||proposedCadence==='daily'||proposedCadence==='weekly')setCadence(proposedCadence);
    setShowQuestForm(true);setMessage('AI quest proposal loaded. Review and select Add quest to save it.');
    window.history.replaceState({},'',window.location.pathname);
  }
 },[user]);
 // Opening the creator must visibly do something on iPhone: bring the form into view and focus its first field.
 useEffect(()=>{if(!showQuestForm||!openQuestFormOnRender.current)return;openQuestFormOnRender.current=false;const form=questFormRef.current;if(!form)return;form.scrollIntoView({behavior:'smooth',block:'start'});form.querySelector<HTMLInputElement>('#quest-title')?.focus({preventScroll:true})},[showQuestForm]);
 useEffect(()=>{void load();const {data:{subscription}}=supabase().auth.onAuthStateChange(()=>{void load()});return()=>subscription.unsubscribe()},[load]);
 useEffect(()=>{
  const open=[...fromIzzy].filter(id=>instances.some(row=>row.quest_id===id&&row.status!=='completed'));
  const count=unseenPartnerCount(open,seenPartner);
  onUnseen?.(count);
  if(!fromAuto.current&&count>0){setFromOpen(true);fromAuto.current=true;}
 },[fromIzzy,instances,seenPartner,onUnseen]);
 useEffect(()=>{try{setSeenPartner(readSeenPartner(localStorage.getItem(SEEN_PARTNER_KEY)))}catch{setSeenPartner(new Set())}},[]);
 useEffect(()=>{
  if(!user||user==='preview'){setSent([]);return;}
  let cancel=false;
  void supabase().from('companion_quests').select('id,title,status').eq('from_user',user).neq('status','declined').then(({data})=>{
    if(cancel||!Array.isArray(data))return;
    setSent((data as {id?:string;title?:string;status?:string}[]).filter(row=>row.id&&row.title).map(row=>({id:row.id as string,title:row.title as string,status:row.status||'sent'})));
  });
  return()=>{cancel=true};
 },[user,instances]);
 async function addPharmacyPack(){
  if(layoutPreview){setMessage('Layout preview. Sign in to save quests.');return}
  if(busy||!user||questCreateInFlight.current)return;
  questCreateInFlight.current=true;
  const operationAccount=accountRef.current;
  setBusy(true);
  try {
   const {data,error}=await supabase().rpc('apply_pharmacy_weekly_pack');
   if(accountRef.current!==operationAccount)return;
   if(error){setMessage(error.message);return}
   const added=typeof data==='number'?data:Number(data);
   setMessage(Number.isInteger(added)&&added>0?`Added ${added} Monday weekly quest${added===1?'':'s'}.`:'Those weekly quests are already on your board.');
   try {
    await load();
   } catch {
    if(accountRef.current===operationAccount)setMessage('Pharmacy weekly pack saved, but the board refresh failed. Refresh to view it; do not add it again.');
   }
  } catch {
   if(accountRef.current===operationAccount)setMessage('Pharmacy weekly pack was not confirmed. Refresh before trying again.');
  } finally {
   questCreateInFlight.current=false;
   setBusy(false);
  }
 }
 async function add(e:React.FormEvent){
  e.preventDefault();
  if(layoutPreview){setMessage('Layout preview. Sign in to save quests.');return}
  if(!title.trim()||busy||!user||questCreateInFlight.current)return;
  // Lock synchronously: a second tap can arrive before React commits busy state.
  questCreateInFlight.current=true;
  const operationAccount=accountRef.current;
  setBusy(true);
  try {
   const payload={p_title:title.trim(),p_domain:domain,p_cadence:cadence,p_date:dueDate||todayLocal(),p_quest_type:questType};
   const {error}=trackProgress
    ? await supabase().rpc('create_tracked_quest',{...payload,p_target:Number(targetAmount),p_unit:progressUnit.trim(),p_increment:Number(progressIncrement)})
    : await supabase().rpc('create_scheduled_quest',payload);
   // An old account's response must not update the newly signed-in account's UI.
   if(accountRef.current!==operationAccount)return;
   if(error){setMessage(error.message);return}
   setMessage('Quest scheduled.');
   setTitle('');setDueDate('');setQuestType('scheduled');setTrackProgress(false);
   try {
    await load();
   } catch {
    // The create RPC succeeded. A subsequent failed refresh must not imply creation failed.
    if(accountRef.current===operationAccount)setMessage('Quest created, but board refresh failed. Refresh to view it; do not add it again.');
   }
  } catch {
   // A lost response may follow a successful server commit; never auto-repeat creation.
   if(accountRef.current===operationAccount)setMessage('Quest creation not confirmed. Refresh your board before trying again.');
  } finally {
   questCreateInFlight.current=false;
   setBusy(false);
  }
 }
 async function act(id:string,action:'complete'|'defer'|'resume'){
  if(layoutPreview){setMessage('Layout preview. Sign in to update quests.');return}
  if(busy||questActionInFlight.current)return;
  // Completion is confirmed in-app (ConfirmCompleteButton two-step tap) before act() runs.
  // A second tap can fire before React commits the busy state.
  questActionInFlight.current=true;
  const operationAccount=accountRef.current;
  const previous=action==='complete'?instances.find(row=>row.id===id):undefined;
  if(previous)setInstances(rows=>withStatus(rows,id,'completed'));
  setBusy(true);
  let confirmed=false;
  try {
    if(action==='complete'){
      // Only the versioned, quest-scoped receipt may justify a new XP claim.
      const {data,error}=await supabase().rpc('set_quest_instance_status_v2',{p_instance_id:id,p_action:action});
      if(accountRef.current!==operationAccount)return;
      if(error){
        if(previous)setInstances(rows=>restoreRow(rows,previous));
        setMessage(error.message);
        return;
      }
      const amount=confirmedAwardAmount(data,id);
      const claimed=claimAward(id,awardStamp(data),amount,seenAwards.current);
      if(claimed){
        seenAwards.current.add(claimed.key);
        setAward({id,amount:claimed.amount,key:claimed.key});
        const reduced=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if(shouldVibrate(reduced,claimed.amount)&&typeof navigator!=='undefined'&&typeof navigator.vibrate==='function')navigator.vibrate(10);
        if(LIVE_PROGRESS_EFFECTS){/* Sparks and sounds stay off until the prototype is ported. */}
      }
      setMessage(completionFeedback(data,id));
      confirmed=true;
    } else {
      const {error}=await supabase().rpc('set_quest_instance_status',{p_instance_id:id,p_action:action});
      if(accountRef.current!==operationAccount)return;
      setMessage(error?.message||(action==='defer'?'Quest deferred without penalty.':'Quest returned to your board.'));
    }
    await load();
  } catch {
    if(!confirmed&&previous)setInstances(rows=>restoreRow(rows,previous));
    if(accountRef.current===operationAccount)setMessage('Quest update not confirmed. Refresh before retrying.');
  } finally {
    questActionInFlight.current=false;
    setBusy(false);
  }
 }
 async function logProgress(id:string,requestId:string,delta:number):Promise<'saved'|'retry'|'rejected'>{
  if(layoutPreview||busy)return 'retry';
  const operationAccount=accountRef.current;
  const operationEpoch=loadEpoch.current;
  if(!operationAccount)return 'retry';
  const operationIsCurrent=()=>accountRef.current===operationAccount&&loadEpoch.current===operationEpoch;
  setBusy(true);
  try {
   const {data,error}=await supabase().rpc('log_quest_progress',{p_instance_id:id,p_request_id:requestId,p_delta:delta});
   if(!operationIsCurrent())return 'retry';
   if(error){
    // Transport/server errors may have committed before the response was lost.
    const definite=/^(22|23|P0001)/.test(error.code ?? '');
    const ambiguous=!definite;
    if(!ambiguous){
     const refreshed=await load();
     if(!refreshed||accountRef.current!==operationAccount||loadEpoch.current!==operationEpoch+1)return 'retry';
    }
    setMessage(ambiguous?'Save not confirmed. Retry the pending operation.':error.message);
    return ambiguous?'retry':'rejected';
   }
   const confirmation=confirmedProgressResult(data);
   if(!confirmation){
    // A missing/malformed RPC result may follow a committed operation: keep its request ID.
    setMessage('Progress save response not verified. Retry the same operation.');
    return 'retry';
   }
   const refreshed=await load(id);
   if(!refreshed||typeof refreshed!=='object'||refreshed.current_amount!==confirmation.currentAmount||refreshed.status!==confirmation.status){
    // Preserve the original idempotent request until refreshed server state is verified.
    if(accountRef.current===operationAccount)setMessage('Progress confirmed by server, but refresh was not verified. Retry the same operation.');
    return 'retry';
   }
   if(accountRef.current!==operationAccount||loadEpoch.current!==operationEpoch+1)return 'retry';
   setMessage(confirmation.status === 'completed'
    ? 'Quest completion confirmed. XP is displayed from your account ledger.'
    : 'Progress saved.');
   return 'saved';
  } catch {
   if(operationIsCurrent())setMessage('Connection lost. Retry the pending operation; do not log again.');
   return 'retry';
  } finally {setBusy(false);}
 }
 // A confirmed retry clears its journal after load() snapshots pending IDs.
 // Reconcile the parent recovery list without another network query.
 function journalResolved(instanceId:string){setRecoveryIds(ids=>ids.filter(id=>id!==instanceId))}
 async function logout(){if(layoutPreview){window.location.assign('/login');return}try{const {error}=await supabase().auth.signOut();if(error){setMessage('Sign out was not confirmed. Please retry.');return}++loadEpoch.current;accountRef.current=null;setQuests([]);setInstances([]);setRecoveryQuests([]);setRecoveryIds([]);setXp(null);setUser(null)}catch{setMessage('Sign out was not confirmed. Please retry.')}}
 if(!ready)return <section className="wrap quest-board-page" aria-busy="true"><p className="muted">Loading your board…</p><div className="board-skeleton">{[0,1,2,3].map(item=><div className="skeleton-row" key={item}/>)}</div></section>;
 if(!user)return <section className="wrap"><div className="eyebrow">LIFE ASCENSION</div><h1>Your adventure awaits</h1><p className="muted">Real actions. Real progress. Your private quest journal.</p><a className="btn" href={loginHref}>Sign in</a></section>;
 const streak=streakFor&&streakFor.owner===user?streakFor.state:null;
 const today=todayLocal();const nowGame=gameDayParts(new Date());const thisWeek=weekStart(today);
 // Weekly quests stay hidden until their seeded appearance time (server enforces the same window).
 const weeklyReveal=(q:Quest)=>q.fixed_reveal?{fixedReveal:true,weekday:q.weekly_weekday??1}:undefined;
 const weeklyOpen=(q:Quest)=>q.cadence!=='weekly'||weeklyVisible(user,q.id,today,nowGame.minutes,q.companion_one_shot===true,weeklyReveal(q));
 const visible=quests.filter(q=>matchesChip(taskArea(q,fromIzzy),chip)).map(q=>({quest:q,instance:q.cadence==='daily'?instances.find(i=>i.quest_id===q.id&&i.due_date===today):q.cadence==='weekly'?instances.find(i=>i.quest_id===q.id&&i.due_date===thisWeek):instances.find(i=>i.quest_id===q.id)})).filter(x=>!!x.instance&&weeklyOpen(x.quest)&&(x.quest.quest_type==='goal'?x.instance!.status!=='completed'||x.instance!.due_date===today:x.quest.cadence==='daily'||x.quest.cadence==='weekly'||x.instance!.status!=='completed'||x.instance!.due_date===today));
 const weeklyHidden=quests.filter(q=>matchesChip(taskArea(q,fromIzzy),chip)&&q.cadence==='weekly'&&instances.some(i=>i.quest_id===q.id&&i.due_date===thisWeek)&&!weeklyOpen(q)).length;
 const completedQuests=visible.filter(x=>x.instance?.status==='completed');const completedDisplay=prioritizePending(completedQuests,recoveryIds,completedQuests.length);const earlierRecoveries=recoverableCompletedEntries(instances,recoveryIds,quests,recoveryQuests,completedQuests.map(x=>x.instance!.id));const activeQuests=visible.filter(x=>x.instance?.status!=='completed');const completed=completedQuests.length;const lvl=xp===null?null:levelFor(xp);
 const weekEnd=addDays(today,7);
 const sectionFor=(due:string)=>due<=today?'today':due<=weekEnd?'week':'upcoming';
 const weeklyQuests=activeQuests.filter(x=>x.quest.cadence==='weekly').sort((a,b)=>weeklyAppearOffset(user,a.quest.id,thisWeek,weeklyReveal(a.quest))-weeklyAppearOffset(user,b.quest.id,thisWeek,weeklyReveal(b.quest)));
 const todayQuests=activeQuests.filter(x=>x.quest.cadence==='daily'||(x.quest.cadence!=='weekly'&&sectionFor(x.instance!.due_date)==='today'));
 const weekQuests=[...weeklyQuests,...activeQuests.filter(x=>x.quest.cadence!=='daily'&&x.quest.cadence!=='weekly'&&sectionFor(x.instance!.due_date)==='week')];
 const laterQuests=activeQuests.filter(x=>x.quest.cadence!=='daily'&&x.quest.cadence!=='weekly'&&sectionFor(x.instance!.due_date)==='upcoming');
 const showShared=chip==='all'||chip==='together';
 const sharedToday=showShared?couple.filter(q=>coupleBucket(q,today,weekEnd)==='today'):[];
 const sharedWeek=showShared?couple.filter(q=>coupleBucket(q,today,weekEnd)==='week'):[];
 const sharedLater=showShared?couple.filter(q=>coupleBucket(q,today,weekEnd)==='upcoming'):[];
 const sharedDone=showShared?couple.filter(q=>coupleBucket(q,today,weekEnd)==='completed'):[];
 // Quests that start in the future and have no instance yet (e.g. a daily habit starting next week).
 const notStarted=quests.filter(q=>matchesChip(taskArea(q,fromIzzy),chip)&&q.scheduled_for&&q.scheduled_for>today&&!visible.some(v=>v.quest.id===q.id)&&!instances.some(i=>i.quest_id===q.id)).sort((a,b)=>(a.scheduled_for||'').localeCompare(b.scheduled_for||''));
 const weekNotStarted=notStarted.filter(q=>q.scheduled_for!<=weekEnd),laterNotStarted=notStarted.filter(q=>q.scheduled_for!>weekEnd);
 // Mirrors the server completion window: one-time chores open on their due date; goals may finish early.
 const canComplete=(quest:Quest,instance:Instance)=>instance.status==='available'&&(quest.cadence==='weekly'?instance.due_date===thisWeek:quest.cadence==='daily'?instance.due_date<=today:quest.quest_type==='goal'||instance.due_date<=today);
 const taskHref=(id:string)=>`${questDetailHref(id)}${questDetailChip(chip)}`;
 const ownership=(quest:Quest)=>fromIzzy.has(quest.id)?partnerOwnershipTag(companion):quest.domain==='career'?'WORK':'LIFE';
 const partnerOpen=activeQuests.filter(x=>fromIzzy.has(x.quest.id));
 const partnerIds=partnerOpen.map(x=>x.quest.id);
 const unseen=unseenPartnerCount(partnerIds,seenPartner);
 const own=(rows:{quest:Quest;instance?:Instance}[])=>rows.filter(x=>!fromIzzy.has(x.quest.id));
 const todayOwn=own(todayQuests),weekOwn=own(weekQuests),laterOwn=own(laterQuests);
 const showFrom=chip==='all'||chip==='partner';
 const questCard=({quest,instance}:{quest:Quest;instance?:Instance})=>{
  const finish=instance&&canComplete(quest,instance)&&(quest.target_amount==null||instance.current_amount>=quest.target_amount);
  const done=instance?.status==='completed';
  const meta=fromIzzy.has(quest.id)?partnerOwnershipTag(companion):quest.domain==='career'?'WORK':'LIFE';
  const cadence=quest.cadence==='weekly'?(quest.fixed_reveal?`${weekdayLabel(quest.weekly_weekday)??'Monday'} 5:00 AM`:'Weekly · open until Monday 5:00 AM'):quest.cadence==='daily'?'Daily':instance?.due_date;
  return <article className={instance&&award?.id===instance.id?'log-row quest-row is-awarded':'log-row quest-row'} key={quest.id}><span className={instance&&award?.id===instance.id?'log-mark is-drawn':'log-mark'} aria-hidden="true">{done?'[x]':'[ ]'}</span><div className="log-main"><Link className="log-title quest-title-link" href={taskHref(quest.id)} prefetch={false}>{quest.title}</Link><span className={fromIzzy.has(quest.id)?'log-meta is-partner':'log-meta'}>{meta}{cadence?` · ${cadence}`:''}{nudged.has(quest.id)?' · NUDGE':''}{finish?' · +10':''}{instance&&award?.id===instance.id&&<span className="xp-float">+{award.amount} XP</span>}</span></div>{instance?.status==='deferred'?<button className="btn ghost" disabled={busy} onClick={()=>act(instance.id,'resume')}>Resume</button>:finish?<ConfirmCompleteButton label="Complete" questTitle={quest.title} disabled={busy} onConfirm={()=>act(instance!.id,'complete')}/>:done?<span className="log-meta">done</span>:<span className="log-meta">opens {instance?.due_date}</span>}<QuestRowDetails><p className="muted">{quest.description||'No extra note.'}</p>{instance?.status==='available'&&quest.target_amount!=null&&canComplete(quest,instance)&&<QuestProgressControls onJournalResolved={journalResolved} quest={quest} instance={instance} disabled={busy} onLog={logProgress}/>}{instance&&canComplete(quest,instance)&&<button className="btn ghost" disabled={busy} onClick={()=>act(instance.id,'defer')}>Defer</button>}{instance?.status==='completed'&&<><QuestDetails quest={quest} instance={instance!}/>{fromIzzy.has(quest.id)&&<IzzyProof instanceId={instance.id} disabled={busy}/>}<QuestProgressControls onJournalResolved={journalResolved} quest={quest} instance={instance!} disabled={busy} onLog={logProgress}/></>}</QuestRowDetails></article>;
 };
 const notStartedCard=(q:Quest)=><article className="log-row quest-row" key={q.id}><span className="log-mark" aria-hidden="true">[ ]</span><div className="log-main"><Link className="log-title quest-title-link" href={taskHref(q.id)} prefetch={false}>{q.title}</Link><span className="log-meta">{ownership(q)} · starts {q.scheduled_for}</span></div></article>;
 const coupleCard=(quest:CoupleQuestView)=><article className="log-row quest-row" key={quest.id}><span className="log-mark" aria-hidden="true">{quest.myDone?'[x]':'[ ]'}</span><div className="log-main"><span className="log-title">{quest.title}</span><span className="log-meta">TOGETHER · {quest.cadence}{quest.myDone?'':' · +10'}</span></div><button type="button" className="btn" disabled={coupleBusy||quest.myDone} onClick={()=>onMarkCouple(quest.id)}>{quest.myDone?'Marked':'Mark my part'}</button><QuestRowDetails><p className="muted">{quest.description||'Shared activity.'}</p><p className="muted">{quest.myDone?'You marked done':'Your part is open'} · {quest.partnerDone?'Partner marked done':'Partner still open'}</p></QuestRowDetails></article>;
 return <section className="quest-board-page workspace-board">{layoutPreview&&<p className="preview-banner" role="status">Layout preview. Sign in to load your quests.</p>}
 <div className="quest-board-tools"><p className="workspace-progress">{todayQuests.length+sharedToday.length} open today{streak?` · ${streak.fire} day streak`:''}{xp===null?' · LEVEL UNAVAILABLE · XP NOT VERIFIED':` · Lv ${lvl?.level}`}</p><button type="button" className="btn quest-add" aria-expanded={showQuestForm} aria-controls="quest-create-form" onClick={()=>{openQuestFormOnRender.current=!showQuestForm;setShowQuestForm(v=>!v)}}>{showQuestForm?'Close':'＋'}</button></div>
 <StreakShieldNote/>
 <div className="board-panel" aria-label="Quest board">
 {chip==='sent'?<section className="board-section" aria-label="Sent to partner"><h2 className="board-section-toggle">Sent to partner ({sent.length})</h2>{sent.length===0?<p className="muted">Nothing sent yet.</p>:sent.map(row=><article className="log-row" key={row.id}><span className="log-mark" aria-hidden="true">{row.status==='completed'?'[x]':'[ ]'}</span><div className="log-main"><span className="log-title">{row.title}</span><span className="log-meta">{row.status==='completed'?'done':'pending'}</span></div></article>)}</section>:<>
 {showFrom&&<section className="board-section from-partner" aria-label={partnerLabel}><button type="button" className="board-section-toggle" aria-expanded={fromOpen} onClick={()=>{const next=!fromOpen;setFromOpen(next);if(next){const marked=markPartnerSeen(partnerIds,seenPartner);setSeenPartner(marked);try{localStorage.setItem(SEEN_PARTNER_KEY,JSON.stringify([...marked]))}catch{/* private mode */}}}}>{partnerLabel} ({partnerOpen.length}){unseen>0&&<span className="unseen-badge">{unseen}</span>}</button>{fromOpen&&<>{partnerOpen.map(questCard)}{partnerOpen.length===0&&<p className="muted">{emptyCopy('today','partner')}</p>}</>}</section>}
 <BoardSection id="today" label="Today" count={todayOwn.length+sharedToday.length} fallbackOpen={focus==='today'}>{sectionErrors.today&&<p className="section-retry">{sectionErrors.today} <button type="button" className="btn ghost" onClick={()=>void load()}>Retry</button></p>}{todayOwn.map(questCard)}{sharedToday.map(coupleCard)}{todayOwn.length+sharedToday.length===0&&!sectionErrors.today&&<p className="muted">{emptyCopy('today',chip)}</p>}{weeklyHidden>0&&<p className="muted weekly-pending">{weeklyHidden===1?'1 weekly quest arrives':`${weeklyHidden} weekly quests arrive`} later this week.</p>}</BoardSection>
 <BoardSection id="week" label="This Week" count={weekOwn.length+weekNotStarted.filter(q=>!fromIzzy.has(q.id)).length+sharedWeek.length} fallbackOpen={focus==='week'}>{sectionErrors.week&&<p className="section-retry">{sectionErrors.week} <button type="button" className="btn ghost" onClick={()=>void load()}>Retry</button></p>}{weekOwn.map(questCard)}{weekNotStarted.filter(q=>!fromIzzy.has(q.id)).map(notStartedCard)}{sharedWeek.map(coupleCard)}{weekOwn.length+weekNotStarted.filter(q=>!fromIzzy.has(q.id)).length+sharedWeek.length===0&&!sectionErrors.week&&<p className="muted">{emptyCopy('week',chip)}</p>}</BoardSection>
 <BoardSection id="upcoming" label="Upcoming" count={laterOwn.length+laterNotStarted.filter(q=>!fromIzzy.has(q.id)).length+sharedLater.length} fallbackOpen={focus==='later'}>{sectionErrors.upcoming&&<p className="section-retry">{sectionErrors.upcoming} <button type="button" className="btn ghost" onClick={()=>void load()}>Retry</button></p>}{laterOwn.map(questCard)}{laterNotStarted.filter(q=>!fromIzzy.has(q.id)).map(notStartedCard)}{sharedLater.map(coupleCard)}{laterOwn.length+laterNotStarted.filter(q=>!fromIzzy.has(q.id)).length+sharedLater.length===0&&!sectionErrors.upcoming&&<p className="muted">{emptyCopy('upcoming',chip)}</p>}</BoardSection>
 <BoardSection id="completed" label="Completed" count={completed+sharedDone.length} fallbackOpen={focus==='done'||showCompleted}>{sectionErrors.completed&&<p className="section-retry">{sectionErrors.completed} <button type="button" className="btn ghost" onClick={()=>void load()}>Retry</button></p>}{completedDisplay.map(questCard)}{sharedDone.map(coupleCard)}{completed+sharedDone.length===0&&!sectionErrors.completed&&<p className="muted">{emptyCopy('completed',chip)}</p>}</BoardSection>
 </>}
 </div>
 {earlierRecoveries.length>0&&<section className="panel"><h2>Completed quests with pending saves</h2>{earlierRecoveries.map(({quest,instance})=><div className="quest-row" key={instance.id}><div className="quest-row-main"><span className="quest-row-title">{quest.title}</span><span className="quest-row-meta">Completed · {instance.due_date}</span></div><QuestProgressControls onJournalResolved={journalResolved} quest={quest} instance={instance} disabled={busy} onLog={logProgress}/></div>)}</section>}
 {showQuestForm&&<div className="quest-sheet" id="quest-create-sheet" role="dialog" aria-label="Add a quest"><button type="button" className="btn ghost" onClick={()=>setShowQuestForm(false)}>Close</button>
 <div role="group" aria-label="Who is this quest for"><button type="button" aria-pressed={!forPartner} onClick={()=>setForPartner(false)}>Me</button><button type="button" aria-pressed={forPartner} onClick={()=>setForPartner(true)}>{assignTargetName(false, companion)}</button></div>
 {!forPartner&&<form id="quest-create-form" ref={questFormRef} className="quest-create-form" onSubmit={add}><h2>New quest</h2><label htmlFor="quest-title">What real-world action will you take?</label><input id="quest-title" className="field" maxLength={120} required placeholder="Fold and put away laundry" value={title} onChange={e=>setTitle(e.target.value)}/><div className="form-row"><label>Life domain<select className="field" value={domain} onChange={e=>setDomain(e.target.value)}>{DOMAINS.map(d=><option key={d[0]} value={d[0]}>{d[1]}</option>)}</select></label><label>Frequency<select className="field" value={cadence} disabled={questType==='goal'} onChange={e=>setCadence(e.target.value as 'once'|'daily'|'weekly')}><option value="daily">Every day</option><option value="weekly">Once a week</option><option value="once">One-time</option></select></label></div><label>Quest type<select className="field" value={questType} onChange={e=>{const v=e.target.value as 'scheduled'|'goal';setQuestType(v);if(v==='goal')setCadence('once')}}><option value="scheduled">Scheduled chore / habit</option><option value="goal">Goal with deadline</option></select></label><label htmlFor="quest-date">{questType==='goal'?'Goal deadline':'First due date'}</label><input id="quest-date" className="field" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/><label className="quest-check"><input type="checkbox" checked={trackProgress} onChange={e=>setTrackProgress(e.target.checked)}/> Track partial progress</label>{trackProgress&&<div className="form-row"><label>Target amount<input className="field" type="number" min={1} max={1000000} step={1} value={targetAmount} onChange={e=>setTargetAmount(e.target.value)}/></label><label>Unit<input className="field" maxLength={32} value={progressUnit} onChange={e=>setProgressUnit(e.target.value)}/></label><label>Quick-log increment<input className="field" type="number" min={1} max={targetAmount||1} step={1} value={progressIncrement} onChange={e=>setProgressIncrement(e.target.value)}/></label></div>}<button className="btn" disabled={busy||!title.trim()||(trackProgress&&(!Number.isInteger(Number(targetAmount))||Number(targetAmount)<1||Number(targetAmount)>1000000||!progressUnit.trim()||!Number.isInteger(Number(progressIncrement))||Number(progressIncrement)<1||Number(progressIncrement)>Number(targetAmount)))}>Schedule quest</button></form>}
 {forPartner&&user&&user!=='preview'&&<AssignToPartner companion={companion}/>}
 {(chip==='work'||chip==='all')&&<div><h2>Set up Monday work tasks</h2><button type="button" className="btn" disabled={busy} onClick={()=>void addPharmacyPack()}>Add work tasks</button></div>}
 {(chip==='together'||chip==='all')&&<div><h2>Shared plans</h2><TogetherPlans/></div>}
 <p><Link href="/quests/manage">Organize tasks</Link> · <Link href="/quests/journal">Quest notes</Link> · <Link href="/more">More settings</Link></p>
 </div>}
 <p className="message" role="status" aria-live="polite">{message}</p></section>
}
function addDays(date:string,days:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}

function BoardSection({id,label,count,fallbackOpen,children}:{id:QuestSectionId;label:string;count:number;fallbackOpen:boolean;children:ReactNode}){
 const [open,setOpen]=useState(fallbackOpen);
 useEffect(()=>{setOpen(readSectionOpen(id,fallbackOpen,window.localStorage)||(id==='completed'&&fallbackOpen));},[id,fallbackOpen]);
 return <section className="board-section" aria-label={label}>
  <button type="button" className={id==='completed'?'board-section-toggle completed-board-toggle':'board-section-toggle'} aria-expanded={open} onClick={()=>{const next=!open;setOpen(next);writeSectionOpen(id,next,window.localStorage);}}>{label} ({count})</button>
  {open&&<div className="board-section-body">{children}</div>}
 </section>;
}
function QuestRowDetails({children}:{children:ReactNode}){
 const [open,setOpen]=useState(false);
 return <div className="quest-row-extra"><button type="button" className="btn ghost quest-row-more" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?'Hide':'Details'}</button>{open&&<div className="quest-row-details">{children}</div>}</div>;
}
function AssignToPartner({companion}:{companion:boolean}){
 const partner=companion?'Connor':'Izzy';
 const [text,setText]=useState('');
 const [note,setNote]=useState('');
 const [cadence,setCadence]=useState<'daily'|'weekly'>('daily');
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('');
 async function send(event:React.FormEvent){
  event.preventDefault();
  if(!text.trim()||busy)return;
  setBusy(true);
  const {data,error}=await supabase().rpc('companion_send_quest',{p_title:text.trim(),p_description:note.trim(),p_due:null,p_reward:'',p_cadence:cadence});
  setBusy(false);
  if(error){setStatus(error.message);return;}
  const again=(data as {idempotent?:boolean}|null)?.idempotent===true;
  setText('');setNote('');
  setStatus(again?`Already on ${partner}'s board.`:`Sent to ${partner}. It is on their board, with their XP.`);
 }
 return <form onSubmit={event=>{void send(event);}}><h2>Assign to {partner}</h2><label htmlFor="assign-title">Quest</label><input id="assign-title" className="field" maxLength={120} required value={text} onChange={event=>setText(event.target.value)}/><label htmlFor="assign-note">Note</label><input id="assign-note" className="field" maxLength={500} value={note} onChange={event=>setNote(event.target.value)}/><label>Cadence<select className="field" value={cadence} onChange={event=>setCadence(event.target.value==='weekly'?'weekly':'daily')}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><button className="btn" disabled={busy||!text.trim()}>Send</button>{status&&<p className="message" role="status">{status}</p>}</form>;
}
function TogetherPlans(){
 return <TogetherQuestPanel plansOnly/>;
}
