// Temporary TEST credentials are RSA/AES encrypted to this run's ephemeral key.
// The private key and decrypted payload never leave the runner or appear in logs.
import {readFileSync} from 'node:fs';
import {privateDecrypt,createDecipheriv,constants} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const repo='connorrago8/life-ascension',branch='chatgpt/test-integration-20261111';
let fixture;
for(let attempt=0;attempt<180;attempt++){
 const r=await fetch(`https://api.github.com/repos/${repo}/contents/.github/live-test-fixture.json?ref=${encodeURIComponent(branch)}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'}});
 if(r.ok){const file=await r.json();const envelope=JSON.parse(Buffer.from(file.content,'base64').toString());if(envelope.runId===process.env.GITHUB_RUN_ID){
  const key=privateDecrypt({key:readFileSync('/tmp/live-private.pem'),oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(envelope.key,'base64'));
  const d=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));d.setAuthTag(Buffer.from(envelope.tag,'base64'));
  fixture=JSON.parse(Buffer.concat([d.update(Buffer.from(envelope.data,'base64')),d.final()]).toString());break;
 }}
 await sleep(5000);
}
assert.ok(fixture,'No encrypted fixture supplied to this run');
assert.equal(fixture.project,'njqwwimzrsunheehnnnt');
assert.equal(fixture.commit,process.env.GITHUB_SHA,'Fixture must match the checked-out commit');
const base=new URL(fixture.preview).origin;
assert.match(base,/^https:\/\/life-ascension-[a-z0-9]+-r6r6bsfbkm-9616\.vercel\.app$/);
const api='https://njqwwimzrsunheehnnnt.supabase.co';
const sessions={};
async function rpc(role,name,args={}){const r=await fetch(api+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:fixture.key,Authorization:`Bearer ${sessions[role].access_token}`,'Content-Type':'application/json'},body:JSON.stringify(args)});const data=await r.json();assert.equal(r.ok,true,`RPC ${name} failed: ${data.code||r.status}`);return data;}
for(const role of ['connor','izzy']){const r=await fetch(api+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:fixture.key,'Content-Type':'application/json'},body:JSON.stringify({email:fixture[role+'Email'],password:fixture.password})});assert.equal(r.ok,true,'Isolated Auth sign-in failed');sessions[role]=await r.json();}
const browser=await chromium.launch({headless:true});
let stage='start';
try{
 const contexts={};const pages={};
 for(const role of ['connor','izzy']){
  const context=await browser.newContext();contexts[role]=context;
  const forbidden=[];context.on('request',request=>{if(request.url().includes('ugcvhmrriazbbymjxvch'))forbidden.push(request.url());});
  const page=await context.newPage();pages[role]=page;
  await page.goto(fixture.preview);await page.goto(base+'/login');
  await page.getByLabel('Email',{exact:true}).fill(fixture[role+'Email']);
  await page.getByLabel('Password',{exact:true}).fill(fixture.password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL(base+'/',{timeout:30000});
  assert.equal(forbidden.length,0,'Production traffic is forbidden');
 }
 const connor=pages.connor,izzy=pages.izzy;
 stage='shield cancellation and confirmation';
 await connor.goto(base+'/quests');
 await connor.getByRole('button',{name:'Review Streak Shield',exact:true}).click();
 await connor.getByRole('button',{name:'Not Now',exact:true}).click();
 assert.equal((await rpc('connor','get_streak_shield')).status,'ready');
 await connor.getByRole('button',{name:'Review Streak Shield',exact:true}).click();
 await connor.getByRole('button',{name:'Use Shield',exact:true}).click();
 await connor.getByText(/Streak Shield used/).waitFor();
 await connor.reload();await connor.getByText(/Streak Shield used/).waitFor();
 assert.equal((await rpc('izzy','get_streak_shield')).status,'ready');
 stage='normal quest persistence';
 await connor.getByRole('button',{name:'Complete QA persistence check',exact:true}).click();
 await connor.getByRole('button',{name:'Tap again to confirm you completed QA persistence check',exact:true}).click();
 await connor.getByRole('button',{name:/Completed \(/}).waitFor();
 await connor.reload();await connor.getByRole('button',{name:/Completed \(/}).waitFor();
 const pack=await rpc('connor','apply_pharmacy_weekly_pack');
 const again=await rpc('connor','apply_pharmacy_weekly_pack');
 assert.equal(Number(again.added??0),0,'Pharmacy pack duplicates');
 console.log('PASS signed-in shield cancel/use/refresh, account isolation, normal quest persistence and pharmacy dedupe');
 stage='shared completion';
 for(const page of [connor,izzy]){await page.goto(base+'/together');const card=page.locator('article').filter({hasText:'QA shared activity'});await card.getByRole('button',{name:'Mark my part',exact:true}).click();await card.getByRole('button',{name:'Marked',exact:true}).waitFor();}
 const board=await rpc('izzy','couple_board');assert.equal(board.quests.find(q=>q.title==='QA shared activity').awarded,true);
 stage='companion activity persistence';
 await izzy.goto(base+'/companion/log');await izzy.getByLabel('Activity',{exact:true}).fill('Make the bed');await izzy.getByRole('button',{name:'Save activity',exact:true}).click();
 await izzy.waitForURL(base+'/companion/history');await izzy.getByText('Make the bed',{exact:true}).waitFor();await izzy.reload();await izzy.getByText('Make the bed',{exact:true}).waitFor();
 const wardrobe=await rpc('izzy','companion_wardrobe');assert.equal(wardrobe.xp,15,'Couple +10 and manual +5 both count toward the companion');
 stage='cosmetic persistence';
 await izzy.goto(base+'/companion/character');
 await izzy.getByRole('button',{name:'Wear',exact:true}).first().click();
 await izzy.getByRole('button',{name:'Take off',exact:true}).first().waitFor();
 await izzy.reload();await izzy.getByRole('button',{name:'Take off',exact:true}).first().waitFor();
 assert.equal((await rpc('izzy','companion_wardrobe')).xp,15,'wearing grants no XP');
 console.log('PASS shared completion, companion activity refresh, combined +15 XP and cosmetic persistence');
 console.log(JSON.stringify({preview:base,commit:fixture.commit,result:'PASS'}));
}catch(error){let detail=String(error?.message??error);for(const secret of [fixture.password,fixture.connorEmail,fixture.izzyEmail,...Object.values(sessions).map(s=>s.access_token)])detail=detail.replaceAll(secret,'[redacted]');console.error(`Hosted TEST walkthrough failed at: ${stage}: ${detail.slice(0,1800)}`);process.exitCode=1;}
finally{await browser.close();for(const role of ['connor','izzy']){await fetch(api+'/auth/v1/logout',{method:'POST',headers:{apikey:fixture.key,Authorization:`Bearer ${sessions[role].access_token}`}});}}
