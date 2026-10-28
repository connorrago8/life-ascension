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
function state(owner){if(!accounts.has(owner))accounts.set(owner,{quests:[{id:'11111111-1111-4111-8111-111111111111',owner_id:owner,title:'Fold and put away the remaining laundry',cadence:'weekly',scheduled_for:day,quest_type:'scheduled',quest_class:'main',domain:'home',active:true,created_at:day+'T00:00:00Z'}],instances:[{id:'22222222-2222-4222-8222-222222222222',owner_id:owner,quest_id:'11111111-1111-4111-8111-111111111111',due_date:day,status:'available',completed_at:null}],ledger:[],calls:0,lost:false});return accounts.get(owner)}
const api=http.createServer(async(req,res)=>{
 try{
 const auth=req.headers.authorization?.replace('Bearer ','');let owner='';try{owner=JSON.parse(Buffer.from(auth.split('.')[1],'base64url')).sub}catch{}
 const s=state(owner);const url=new URL(req.url,'http://127.0.0.1:3999');
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.end();return}
 if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:owner,aud:'authenticated',role:'authenticated',email:'mock@example.invalid',app_metadata:{},user_metadata:{}}));return}
 let data;let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{};
 if(url.pathname.endsWith('/rpc/ensure_quest_instance'))data=s.instances[0].id;
 else if(url.pathname.endsWith('/rpc/get_lifetime_xp'))data=s.ledger.length;
 else if(url.pathname.endsWith('/rpc/set_quest_instance_status_v2')){
  s.calls++;await new Promise(r=>setTimeout(r,500));const i=s.instances.find(i=>i.id===body.p_instance_id);const fresh=i.status!=='completed';
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
 await mkdir('/tmp/life-m1-browser',{recursive:true});
 for(const width of [320,375,390,430]){
  const owner=`00000000-0000-4000-8000-000000000${width}`;const s=state(owner);
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
  await context.route('**/*',route=>{const host=new URL(route.request().url()).hostname;return host==='127.0.0.1'?route.continue():route.abort()});
  const user={id:owner,aud:'authenticated',role:'authenticated',email:'mock@example.invalid'};
  const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:owner,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+604800})).toString('base64url')+'.mock';
  const session={access_token:jwt,refresh_token:'mock',token_type:'bearer',expires_in:604800,expires_at:Math.floor(Date.now()/1000)+604800,user};
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/'}]);
  const page=await context.newPage();await page.goto('http://127.0.0.1:3210');
  const card=page.locator('#occurrence-22222222-2222-4222-8222-222222222222');
  await card.waitFor();await page.getByRole('heading',{name:'Your next actions'}).waitFor();
  assert.ok(await card.getByText('MAIN QUEST',{exact:true}).count());assert.ok(await card.getByText(/Weekly/).count());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`${width}: horizontal overflow`);
  await page.screenshot({path:`/tmp/life-m1-browser/board-${width}.png`,fullPage:true});
  await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body));
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}: text enlargement overflow`);
  await page.evaluate(()=>document.documentElement.style.fontSize='');
  const before=await page.evaluate(()=>localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('highlights:v1:'))));
  await page.reload();await card.waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('highlights:v1:')))),before);
  s.lost=width===320;
  const button=card.getByRole('button',{name:'Complete',exact:true});const box=await button.boundingBox();assert.ok(box.height>=44&&box.width>=44);
  await button.click();await page.locator('.message').filter({hasText:'Saving'}).waitFor();
  assert.equal(await card.count(),1);assert.equal(s.ledger.length,0);assert.equal(await page.locator('.message').filter({hasText:'+1 XP'}).count(),0);
  if(width===320){await page.locator('.message').filter({hasText:'not confirmed'}).waitFor();await page.reload();await page.getByRole('button',{name:'Retry pending action'}).click();}
  await page.locator('.message').filter({hasText:width===320?'already saved':'+1 XP'}).waitFor();
  assert.equal(s.ledger.length,1);assert.equal(s.calls,width===320?2:1);
  assert.equal(await page.locator('#occurrence-22222222-2222-4222-8222-222222222222').count(),0);
  await page.goto('http://127.0.0.1:3210/journal');await page.getByText(s.quests[0].title,{exact:true}).waitFor();
  await page.getByText('+1 XP verified',{exact:false}).waitFor();await page.reload();await page.getByText(s.quests[0].title,{exact:true}).waitFor();
  const awards=[...s.ledger];s.ledger=[];await page.reload();await page.getByText('Reward not verified',{exact:false}).waitFor();
  assert.equal(await page.getByText('+1 XP verified',{exact:false}).count(),0);s.ledger=awards;
  await page.clock.install({time:new Date(Date.now()+86400000)});await page.reload();await page.getByText(s.quests[0].title,{exact:true}).waitFor();
  await page.screenshot({path:`/tmp/life-m1-browser/journal-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  console.log(`PASS ${width}px: hierarchy, cadence, freeze/reload, pending, receipt, Journal/reload; calls=${s.calls}`);
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
