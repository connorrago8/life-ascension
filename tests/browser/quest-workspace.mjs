// Exercises the actual workspace/nav/components with deterministic, account-scoped fixtures.
// No requests can reach a hosted database. Also captures phone/desktop layout evidence.
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=process.cwd();
const navigation=`import {useState,useEffect} from 'react';
function useLocation(){const [url,setUrl]=useState(location.href);useEffect(()=>{const update=()=>setUrl(location.href);addEventListener('popstate',update);return()=>removeEventListener('popstate',update)},[]);return new URL(url)}
export function usePathname(){return useLocation().pathname} export function useSearchParams(){return useLocation().searchParams}
export function useRouter(){return {push(href){history.pushState({},'',href);dispatchEvent(new PopStateEvent('popstate'))},replace(href){history.replaceState({},'',href);dispatchEvent(new PopStateEvent('popstate'))}}}`;
const link=`import React from 'react';export default function Link({href,prefetch,children,onClick,...props}){return <a {...props} href={href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented){event.preventDefault();history.pushState({},'',href);dispatchEvent(new PopStateEvent('popstate'))}}}>{children}</a>}`;
const fake=`
import {gameDayParts,weekStart} from './lib/questStreak';
const today=gameDayParts(new Date()).date, week=weekStart(today);
const user={id:'workspace-fixture-owner'};
const make=(id,title,domain,cadence='daily',due=today)=>({id,title,domain,cadence,owner_id:user.id,active:true,created_at:today+'T12:00:00Z',scheduled_for:due,quest_type:'scheduled',target_amount:null,progress_unit:null,progress_increment:null,description:null,fixed_reveal:cadence==='weekly',weekly_weekday:1});
const quests=[...Array.from({length:9},(_,i)=>make('life-'+i,['Make the bed','Go for a walk','Cook dinner','Read a chapter','Water the plants','Tidy the kitchen','Call family','Plan the weekend','Stretch'][i],'home')),...['Tech schedule','Pharmacist schedule','Supplies order','U Learn check','Attendance check','PTO check'].map((t,i)=>make('work-'+i,t,'career','weekly')),make('izzy-1','Pick up dry cleaning','home')];
const instances=quests.map(q=>({id:'instance-'+q.id,quest_id:q.id,owner_id:user.id,due_date:q.cadence==='weekly'?week:today,status:'available',current_amount:0}));
const tables={quests,quest_instances:instances,companion_quests:[{id:'request-1',quest_id:'izzy-1',to_user:user.id,status:'accepted'}],companion_bonds:[{inviter_id:user.id,companion_id:'partner',status:'active'}],companion_identities:[{user_id:'partner',quest_color:'amber'}],companion_nudges:[]};
function from(table){let rows=tables[table]??[];let single=false;const query={select(){return query},order(){return query},limit(n){rows=rows.slice(0,n);return query},eq(k,v){rows=rows.filter(r=>r[k]===v);return query},neq(k,v){rows=rows.filter(r=>r[k]!==v);return query},in(k,values){rows=rows.filter(r=>values.includes(r[k]));return query},maybeSingle(){single=true;return query},then(resolve,reject){return Promise.resolve({data:single?(rows[0]??null):rows,error:null}).then(resolve,reject)}};return query}
export function supabase(){return {from,auth:{getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},rpc:async(name)=>({error:null,data:name==='get_lifetime_xp'?100:name==='get_quest_streak'?{fire:4,done_today:false,today}:name==='get_streak_shield'?{status:'ready',notice:'Streak Shield ready · 1 this month'}:name==='companion_state'?{userId:user.id,bond:{status:'active',role:'inviter'}}:name==='couple_board'?{role:'adventurer',companionXp:10,quests:[{id:'shared-1',title:'A walk without phones',description:'A little time together.',cadence:'once',kind:'shared',steps:[],myDone:false,partnerDone:false,awarded:false}]}:null})}}
`;
const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {AppNav} from './app/components/AppNav';import {QuestWorkspace} from './components/quests/QuestWorkspace';createRoot(document.getElementById('root')).render(<div className="shell"><AppNav/><div className="shell-main"><QuestWorkspace/></div></div>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},loader:{'.css':'empty'},plugins:[{name:'isolated-fixtures',setup(b){
 b.onResolve({filter:/^next\/(navigation|link|dynamic)$/},a=>({path:a.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='next/navigation'?navigation:a.path==='next/link'?link:`import React,{lazy,Suspense} from 'react';export default function dynamic(load,options){const Component=lazy(load);return props=><Suspense fallback={options?.loading?.()}><Component {...props}/></Suspense>}`,loader:'tsx',resolveDir:root}));
 b.onLoad({filter:/[/\\]lib[/\\]supabase\.ts$/},()=>({contents:fake,loader:'tsx',resolveDir:root}));
}}]});
const css=['style.css','companion-dark.css','adventurer-dark.css','polish.css','couple.css','quest-workspace.css'].map(f=>readFileSync(root+'/app/'+f,'utf8')).join('\n');
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div><script>'+bundle.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></body></html>';
const server=createServer((request,response)=>{response.writeHead(200,{'Content-Type':'text/html'});response.end(html)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 mkdirSync('/tmp/quest-workspace-screens',{recursive:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 await page.goto(base+'/quests');
 await page.getByRole('button',{name:'Complete Make the bed',exact:true}).waitFor();
 assert.equal(await page.locator('.quest-title-link').count(),6,'one six-item page, not every task at once');
 assert.equal(await page.getByRole('navigation',{name:'Primary'}).getByRole('link').count(),5,'brand plus four destinations');
 assert.equal(await page.getByRole('button',{name:'More',exact:true}).count(),0);
 assert.equal(await page.locator('.quest-time-nav [aria-current="page"]').innerText(),'Today');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'phone has no horizontal overflow');
 await page.screenshot({path:'/tmp/quest-workspace-screens/life-mobile.png',fullPage:true});
 await page.getByRole('link',{name:'Work Pharmacy & career tasks',exact:false}).click();
 await page.getByRole('button',{name:'Complete Tech schedule',exact:true}).waitFor();
 assert.equal(await page.getByText('Make the bed',{exact:true}).count(),0);
 assert.equal(await page.getByText('Pick up dry cleaning',{exact:true}).count(),0);
 await page.screenshot({path:'/tmp/quest-workspace-screens/work-mobile.png',fullPage:true});
 await page.getByRole('link',{name:'Izzy Tasks from your partner',exact:false}).click();
 await page.getByRole('button',{name:'Complete Pick up dry cleaning',exact:true}).waitFor();
 assert.equal(await page.getByText('Tech schedule',{exact:true}).count(),0);
 await page.getByRole('link',{name:'Together Shared plans & activities',exact:false}).click();
 await page.getByRole('heading',{name:'A walk without phones',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Choose',exact:true}).count(),0,'date catalogue is not dumped onto shared tasks');
 await page.getByRole('button',{name:'Date night',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Choose',exact:true}).count(),6,'only six date ideas initially');
 await page.getByRole('link',{name:'Life Home, health & everyday tasks',exact:false}).click();
 await page.getByRole('link',{name:'Done',exact:true}).click();
 await page.getByText('No completed tasks in this section.',{exact:true}).waitFor();
 await page.getByRole('link',{name:'Today',exact:true}).click();
 await page.getByRole('button',{name:'Show 6 more tasks (3 remaining)',exact:true}).click();
 assert.equal(await page.locator('.quest-title-link').count(),9);
 await page.setViewportSize({width:1280,height:900});
 await page.goto(base+'/quests?area=work&view=today');
 await page.getByRole('button',{name:'Complete Tech schedule',exact:true}).waitFor();
 await page.screenshot({path:'/tmp/quest-workspace-screens/work-desktop.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS workspace: four categories, category isolation, one time group, six-item pagination, shared/date separation, phone and desktop layout');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
