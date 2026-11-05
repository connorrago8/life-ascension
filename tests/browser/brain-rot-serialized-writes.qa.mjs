import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { chromium } from 'playwright';
if(process.getuid?.()===0)throw Error('Non-root sandboxed browser required');
const base=new URL(process.env.QA_BASE_URL||'http://127.0.0.1:3148');assert.equal(base.hostname,'127.0.0.1');
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const core={};vm.runInNewContext(compile('lib/brainRot/core.ts'),{exports:core,structuredClone});
const checkpoint={version:1,revision:1,run:core.newRun(93),active:null};
const lock='life-ascension:brain-rot:checkpoint-writer:v1';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,chromiumSandbox:true});
try{
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true});
  const errors=[],forbidden=[];
  await context.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin!==base.origin||!['GET','HEAD'].includes(r.method())){forbidden.push(r.method()+' '+r.url());return route.abort();}return route.continue();});
  await context.addInitScript(({key,checkpoint})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(checkpoint));},{key:core.CHECKPOINT_KEY,checkpoint});
  const holder=await context.newPage(),player=await context.newPage();
  for(const page of [holder,player]){page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL('/play/brain-rot',base).href);await page.getByRole('button',{name:'Start Challenge',exact:true}).waitFor();}
  // A real browser-held origin lock, not a mocked LockManager or storage facade.
  await holder.evaluate(lock=>{window.held=false;navigator.locks.request(lock,()=>new Promise(resolve=>{window.releaseLock=resolve;window.held=true;}));},lock);
  await holder.waitForFunction(()=>window.held===true);
  await player.getByRole('button',{name:'Start Challenge',exact:true}).click();
  await holder.waitForFunction(async lock=>(await navigator.locks.query()).pending.some(x=>x.name===lock),lock);
  assert.equal(await player.getByRole('button',{name:'Pause & Save',exact:true}).count(),0,'waiting for save must not start the game');
  const before=await holder.evaluate(key=>localStorage.getItem(key),core.CHECKPOINT_KEY);
  assert.equal(JSON.parse(before).revision,1,'queued save must not run outside the origin lock');
  // While this start waits, the lock holder accepts a valid newer completion.
  const completed={...checkpoint,revision:2,run:core.completeLevel(checkpoint.run)};
  await holder.evaluate(({key,saveKey,completed})=>{localStorage.setItem(key,JSON.stringify(completed));localStorage.setItem(saveKey,JSON.stringify(completed.run));window.releaseLock();},{key:core.CHECKPOINT_KEY,saveKey:core.SAVE_KEY,completed});
  await player.getByText('Level 2/31',{exact:true}).waitFor();
  await holder.waitForFunction(async lock=>!(await navigator.locks.query()).held.some(x=>x.name===lock)&&!(await navigator.locks.query()).pending.some(x=>x.name===lock),lock);
  const after=await holder.evaluate(key=>JSON.parse(localStorage.getItem(key)),core.CHECKPOINT_KEY);
  assert.equal(after.run.level,2);assert.equal(after.revision,2);assert.equal(await player.getByRole('button',{name:'Pause & Save',exact:true}).count(),0);
  // Pause/pagehide during a delayed Start cannot cause automatic play on release.
  await holder.evaluate(lock=>{window.held=false;navigator.locks.request(lock,()=>new Promise(resolve=>{window.releaseLock=resolve;window.held=true;}));},lock);await holder.waitForFunction(()=>window.held);
  await player.getByRole('button',{name:'Start Challenge',exact:true}).click();
  await holder.waitForFunction(async lock=>(await navigator.locks.query()).pending.some(x=>x.name===lock),lock);
  await player.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  await holder.evaluate(()=>window.releaseLock());
  await holder.waitForFunction(async lock=>!(await navigator.locks.query()).held.some(x=>x.name===lock)&&!(await navigator.locks.query()).pending.some(x=>x.name===lock),lock);
  await player.getByRole('button',{name:'Resume / Retry',exact:true}).waitFor();
  assert.equal(await player.getByRole('button',{name:'Pause & Save',exact:true}).count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
  console.log(`PASS ${width}px native Web Locks: queued Start waits, newer level retained, pause while queued prevents automatic play; errors[]/forbidden[]`);
  await context.close();
 }
}finally{await browser.close();}
