/** Local mock API + actual app browser QA. No hosted credentials or connections.
 * Install playwright in a temporary QA directory. Set QA_MODULES and CHROMIUM_BIN.
 * Screenshots: /tmp/life-m1-browser. Root-only runtimes run without Chromium sandbox;
 * this is mock verification, not security certification or hosted persistence proof.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.QA_MODULES+'/playwright/index.mjs'));
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const accounts=new Map();
function state(owner){
 if(!accounts.has(owner)){
  const names=['Fold and put away the remaining laundry','Brush your teeth before bed','Review the next pharmacist schedule'];
  const yesterday=new Date(new Date(day+'T12:00:00Z').getTime()-86400000).toISOString().slice(0,10);
  const quests=names.map((title,n)=>({id:'11111111-1111-4111-8111-11111111111'+(n+1),owner_id:owner,title,cadence:['weekly','daily','biweekly'][n],scheduled_for:n===0?yesterday:day,quest_type:'scheduled',quest_class:n===0?'main':'side',domain:'home',active:true,created_at:day+'T00:00:00Z'}));
  const instances=quests.map((q,n)=>({id:'22222222-2222-4222-8222-22222222222'+(n+1),owner_id:owner,quest_id:q.id,due_date:q.scheduled_for,status:'available',completed_at:null}));
  accounts.set(owner,{quests,instances,ledger:[],calls:0,lost:false,reject:false});
 }return accounts.get(owner);
}
const output=process.env.QA_SCREENSHOTS_DIR??'/tmp/life-m1-browser';
const api=http.createServer(async(req,res)=>{
 try{
 const auth=req.headers.authorization?.replace('Bearer ','');let owner='';try{owner=JSON.parse(Buffer.from(auth.split('.')[1],'base64url')).sub}catch{}
 const s=state(owner);const url=new URL(req.url,'http://127.0.0.1:3999');
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.end();return}
 if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:owner,aud:'authenticated',role:'authenticated',email:'mock@example.invalid',app_metadata:{},user_metadata:{}}));return}
 let data;let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{};
 if(url.pathname.endsWith('/rpc/ensure_quest_instance'))data=s.instances.find(i=>i.quest_id===body.p_quest_id)?.id;
 else if(url.pathname.endsWith('/rpc/get_lifetime_xp'))data=s.ledger.length;
 else if(url.pathname.endsWith('/rpc/set_quest_instance_status_v2')){
  s.calls++;await new Promise(r=>setTimeout(r,900));if(s.reject){s.reject=false;res.statusCode=400;res.end(JSON.stringify({code:'P0001',message:'Simulated eligibility rejection'}));return;}const i=s.instances.find(i=>i.id===body.p_instance_id);const fresh=i.status!=='completed';
  i.status='completed';i.completed_at??=new Date().toISOString();if(fresh)s.ledger.push({instance_id:i.id,owner_id:owner,amount:1});
  if(s.lost){s.lost=false;res.statusCode=503;res.end(JSON.stringify({message:'Simulated lost response'}));return}
  data={schema_version:1,quest_instance_id:i.id,status:'completed',quest_completion_confirmed:true,reward_confirmed:true,xp_awarded:fresh?1:0,reward_status:fresh?'awarded':'already_awarded',reward_awarded_at:i.completed_at};
 }else{
  const table=url.pathname.split('/').pop();data=table==='quests'?s.quests:table==='quest_instances'?s.instances:table==='xp_ledger'?s.ledger:[];
  data=data.filter(row=>[...url.searchParams].every(([k,v])=>!v.startsWith('eq.')||String(row[k])===v.slice(3)));
  if(req.headers.accept?.includes('vnd.pgrst.object'))data=data[0]??null;
 }
 res.end(JSON.stringify(data));
 }catch(e){res.statusCode=500;res.end(JSON.stringify({message:e.message}))}
});
await new Promise(r=>api.listen(3999,'127.0.0.1',r));
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3210'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3999',NEXT_PUBLIC_SUPABASE_ANON_KEY:'mock-only',NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore'});
let browser;
try{
 for(let n=0;n<120;n++){try{const r=await fetch('http://127.0.0.1:3210');if(r.ok)break}catch{}await new Promise(r=>setTimeout(r,500));if(n===119)throw Error('App startup timed out')}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,headless:true,args:['--disable-dev-shm-usage','--disable-gpu']});
 await mkdir(output,{recursive:true});
 for(const width of [320,375,390,430]){
  const owner=`00000000-0000-4000-8000-000000000${width}`;const s=state(owner);
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
  await context.route('**/*',route=>{const host=new URL(route.request().url()).hostname;return host==='127.0.0.1'?route.continue():route.abort()});
  const user={id:owner,aud:'authenticated',role:'authenticated',email:'mock@example.invalid'};
  const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:owner,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+604800})).toString('base64url')+'.mock';
  const session={access_token:jwt,refresh_token:'mock',token_type:'bearer',expires_in:604800,expires_at:Math.floor(Date.now()/1000)+604800,user};
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/'}]);
  const page=await context.newPage();await page.goto('http://127.0.0.1:3210');
  const highlights=page.getByRole('region',{name:"Today's highlighted actions"});
  const first=s.instances[0],second=s.instances[1],third=s.instances[2];
  const shot=async name=>page.screenshot({path:`${output}/${name}-${width}.png`,fullPage:true});
  const inline=(region,phase)=>region.locator(`[data-completion-phase="${phase}"]`);
  await highlights.locator('li').nth(2).waitFor();assert.equal(await highlights.locator('li').count(),3);
  assert.equal(await highlights.getByText(/Main · Weekly/).count(),1);assert.equal(await highlights.getByText(/Side ·/).count(),2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await shot('board');
  const selection=await page.evaluate(()=>localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('highlights:v1:'))));
  await page.reload();await highlights.locator('li').nth(2).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('highlights:v1:')))),selection);
  await highlights.getByRole('link',{name:s.quests[0].title,exact:true}).click();
  await page.getByRole('heading',{name:'Instructions',exact:true}).waitFor();
  const detail=page.getByRole('region',{name:'Quest completion'});
  await detail.getByRole('button',{name:'Complete quest',exact:true}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('instance'),first.id);
  assert.ok(await page.locator('.quest-instructions').getByText(s.quests[0].title,{exact:true}).count());
  await shot('detail');
  const complete=detail.getByRole('button',{name:'Complete quest',exact:true});const box=await complete.boundingBox();assert.ok(box.width>=44&&box.height>=44);
  await complete.click();await inline(detail,'pending').waitFor();assert.equal(s.ledger.length,0);await shot('detail-pending');
  await inline(detail,'confirmed').getByText('+1 XP',{exact:false}).waitFor();await shot('detail-confirmed');
  assert.equal(s.ledger.length,1);
  await page.goto('http://127.0.0.1:3210');await highlights.locator('li').nth(2).waitFor();
  await page.getByRole('button',{name:/Completed \(1\)/}).click();
  await page.getByText('Completed · '+day,{exact:true}).waitFor();
  assert.notEqual(first.due_date,day);await shot('completed-date');
  const secondHighlight=highlights.locator('li').nth(1);
  s.lost=true;await secondHighlight.getByRole('button',{name:/Complete quest/}).click();
  await inline(secondHighlight,'pending').waitFor();assert.equal(s.ledger.length,1);await shot('highlight-pending');
  await inline(secondHighlight,'uncertain').waitFor();await shot('uncertain');
  assert.equal(await inline(secondHighlight,'uncertain').getByText('+1 XP',{exact:false}).count(),0);
  await page.reload();await inline(secondHighlight,'uncertain').getByRole('button',{name:'Retry pending action'}).click();
  await inline(secondHighlight,'confirmed').getByText('already saved',{exact:false}).waitFor();await shot('highlight-confirmed');
  assert.equal(s.ledger.length,2);assert.equal(s.calls,3);assert.equal(await highlights.locator('li').count(),3);
  const card=page.locator('#occurrence-'+third.id);s.reject=true;
  await card.getByRole('button',{name:'Complete',exact:true}).click();await inline(card,'error').waitFor();await shot('error');assert.equal(s.ledger.length,2);
  await card.getByRole('button',{name:'Complete',exact:true}).click();await inline(card,'pending').waitFor();await shot('board-pending');
  const savedCard=page.locator('#receipt-'+third.id);
  await inline(savedCard,'confirmed').getByText('+1 XP',{exact:false}).waitFor();await shot('board-confirmed');
  assert.equal(await page.locator('#occurrence-'+third.id).count(),0);assert.equal(s.ledger.length,3);
  await page.goto('http://127.0.0.1:3210/journal');await page.getByText(s.quests[0].title,{exact:true}).waitFor();
  assert.equal(await page.getByText('+1 XP verified',{exact:false}).count(),3);
  await page.reload();await page.getByText(s.quests[0].title,{exact:true}).waitFor();await shot('journal');
  await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body));
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(()=>document.documentElement.style.fontSize='');
  const awards=[...s.ledger];s.ledger=s.ledger.slice(1);await page.reload();await page.getByText('Reward not verified',{exact:false}).waitFor();s.ledger=awards;
  await page.clock.install({time:new Date(Date.now()+86400000)});await page.reload();await page.getByText(s.quests[0].title,{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log(`PASS ${width}px: three Main/Side highlights, Detail completion, inline pending/confirmed/uncertain/error, Chicago completed_at, Journal/reload/day boundary; 12 screenshots`);
  if(width===430){
   const other='00000000-0000-4000-8000-000000000999';state(other).quests[0].title='Other account action';
   const otherJwt=jwt.split('.')[0]+'.'+Buffer.from(JSON.stringify({sub:other,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+604800})).toString('base64url')+'.mock';
   await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify({...session,user:{...user,id:other},access_token:otherJwt})).toString('base64url'),domain:'127.0.0.1',path:'/'}]);
   await page.goto('http://127.0.0.1:3210');await page.locator('.quest-title').filter({hasText:'Other account action'}).waitFor();
   assert.equal(await page.getByText(s.quests[0].title,{exact:true}).count(),0);assert.equal(state(other).ledger.length,0);
   console.log('PASS account switch: previous account content and pending action absent');
  }
  await context.close();
 }
}finally{await browser?.close();app.kill('SIGTERM');api.close();}
