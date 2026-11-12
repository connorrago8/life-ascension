'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {useSearchParams} from 'next/navigation';
import {QUEST_AREAS,parseQuestArea,parseQuestView,questWorkspaceHref} from '../../lib/questWorkspace';
import {useCompanionRole} from '../useCompanionRole';
import PersonalQuestBoard from './PersonalQuestBoard';
const TogetherQuestPanel=dynamic(()=>import('./TogetherQuestPanel'),{loading:()=><p role="status">Loading shared tasks…</p>});
const CompanionAssignmentsPanel=dynamic(()=>import('./CompanionAssignmentsPanel'),{loading:()=><p role="status">Loading partner tasks…</p>});
export function QuestWorkspace(){
 const params=useSearchParams();
 const area=parseQuestArea(params.get('area')),view=parseQuestView(params.get('view'));
 const role=useCompanionRole();const companion=role.mode==='companion';
 return <main className="wrap quest-workspace">
  <header className="workspace-heading"><div><p className="eyebrow">YOUR DAY, ONE STEP AT A TIME</p><h1>Quests</h1></div><Link className="workspace-utility" href={companion?'/companion/character':'/character'} aria-label="Your character">Character ↗</Link></header>
  <nav className="quest-areas" aria-label="Quest categories">{QUEST_AREAS.map(item=><Link key={item.id} href={questWorkspaceHref(item.id)} className="quest-area" aria-current={area===item.id?'page':undefined} prefetch={false}><span className="quest-area-icon" aria-hidden="true">{item.icon}</span><strong>{item.id==='izzy'&&companion?'For Connor':item.label}</strong><small>{item.id==='izzy'&&companion?'Tasks you assign':item.description}</small></Link>)}</nav>
  {companion&&area==='life'&&<Link className="btn workspace-log" href="/companion/log">+ Log an activity</Link>}{area==='together'?<TogetherQuestPanel/>:area==='izzy'&&companion?<CompanionAssignmentsPanel/>:<PersonalQuestBoard area={area} view={view}/>}
 </main>;
}
