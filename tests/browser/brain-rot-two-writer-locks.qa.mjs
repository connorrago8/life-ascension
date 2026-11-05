/** Actual repository writer modules in separate browser documents; no gameplay edits.
 * Controlled snapshots/clock: not a natural two-player completion or independent approval. */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {chromium} from 'playwright';
if(process.getuid?.()===0)throw Error('Non-root sandboxed Chromium required');
const base=new URL(process.env.QA_BASE_URL||'http://127.0.0.1:3148');assert.equal(base.hostname,'127.0.0.1');
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sources={core:compile('lib/brainRot/core.ts'),writer:compile('lib/brainRot/checkpointWriter.ts')};
const core={},games={};vm.runInNewContext(sources.core,{exports:core,structuredClone});vm.runInNewContext(compile('lib/brainRot/games.ts'),{exports:games,require:()=>core,structuredClone});
const lock='life-ascension:brain-rot:checkpoint-writer:v1';let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,chromiumSandbox:true});});
after(async()=>{await browser?.close();});
async function install(page){
 await page.evaluate(({sources,key})=>{
  const core={},writer={};new Function('exports',sources.core)(core);
  new Function('exports','require',sources.writer)(writer,name=>{if(name!=='./core')throw Error(name);return core;});
  window.qaWriter=writer.createCheckpointWriter();window.qaStorageEvents=[];
  addEventListener('storage',e=>{if(e.key===key)window.qaStorageEvents.push({old:e.oldValue,next:e.newValue});});
 },{sources,key:core.CHECKPOINT_KEY});
}
/** Playwright evaluate returning does not guarantee cross-document lock IPC is visible.
 * Observe the native queue before releasing it; never retry a write/result assertion. */
async function pendingBarrier(page,count){
 let observed=-1;
 for(let poll=0;poll<80;poll++){
  observed=await page.evaluate(async lock=>(await navigator.locks.query()).pending.filter(x=>x.name===lock).length,lock);
  if(observed===count)return poll+1;
  assert.ok(observed<count,'unexpected extra checkpoint writer in fixture');
  // Node clock, not the frozen simulation clock; bounded setup synchronization only.
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 assert.equal(observed,count,'native queue setup did not reach required writer count');
}
for(const width of [320,375,390,430])for(const outcome of ['completion','heart-loss'])for(const arrival of ['ordered','simultaneous']){
 test(`${width}px ${outcome}: ${arrival} actual native-lock writers`,{timeout:45000},async()=>{
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true}),errors=[],forbidden=[];
  const initial={version:1,revision:1,run:core.newRun(93),active:null};
  const candidateA={run:initial.run,active:{level:1,state:games.createGame(core.currentGame(initial.run),1,110)}};
  const candidateB={run:outcome==='completion'?core.completeLevel(initial.run):{...initial.run,hearts:2},active:null};
  let holder,a,b,reader;
  try{
   await context.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin!==base.origin||!['GET','HEAD'].includes(r.method())){forbidden.push(r.method()+' '+r.url());return route.abort();}return route.continue();});
   const time=new Date('2026-11-05T23:50:00Z');await context.clock.install({time});await context.clock.pauseAt(time);
   await context.addInitScript(({key,initial})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(initial));},{key:core.CHECKPOINT_KEY,initial});
   for(const name of ['holder','a','b']){
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL('/play/brain-rot',base).href);await page.getByRole('button',{name:'Start Challenge',exact:true}).waitFor();
    if(name==='holder')holder=page;else if(name==='a')a=page;else b=page;
   }
   await install(a);await install(b);
   const extraBefore=await holder.evaluate(keys=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>!keys.includes(k))),[core.CHECKPOINT_KEY,core.SAVE_KEY,core.ACTIVE_KEY]);
   await holder.evaluate(lock=>new Promise(acquired=>{void navigator.locks.request(lock,()=>new Promise(release=>{window.qaRelease=release;acquired();}));}),lock);
   const queue=(page,candidate)=>page.evaluate(candidate=>{window.qaPending=window.qaWriter.commitExclusive(candidate.run,candidate.active);return 'queued';},candidate);
   if(arrival==='ordered'){
    await queue(b,candidateB);
    await pendingBarrier(holder,1);
    await queue(a,candidateA);
   }else await Promise.all([queue(a,candidateA),queue(b,candidateB)]);
   const queuePolls=await pendingBarrier(holder,2);
   await holder.evaluate(()=>window.qaRelease());
   const results=await Promise.all([a.evaluate(()=>window.qaPending),b.evaluate(()=>window.qaPending)]);
   assert.deepEqual([...results].sort(),['conflict','saved'],'exactly one same-generation writer may commit');
   if(arrival==='ordered')assert.deepEqual(results,['conflict','saved'],'queued stale Start cannot replace completed level/spent heart');
   const winner=results[0]==='saved'?candidateA:candidateB;
   const expected={version:1,run:winner.run,active:winner.active,revision:2};
   reader=await context.newPage();reader.on('pageerror',e=>errors.push(e.message));await reader.goto(new URL('/play/brain-rot',base).href);
   await reader.getByText(`Level ${winner.run.level}/31`,{exact:true}).waitFor();await reader.getByText(`❤️ ${winner.run.hearts}`,{exact:true}).waitFor();
   const stored=await reader.evaluate(keys=>({checkpoint:JSON.parse(localStorage.getItem(keys[0])),legacy:JSON.parse(localStorage.getItem(keys[1])),active:JSON.parse(localStorage.getItem(keys[2]))}),[core.CHECKPOINT_KEY,core.SAVE_KEY,core.ACTIVE_KEY]);
   assert.deepEqual(stored,JSON.parse(JSON.stringify({checkpoint:expected,legacy:winner.run,active:winner.active})),'fresh app recovery and both legacy mirrors retain the winning snapshot');
   // A genuinely fresh writer remains usable; rejecting stale writers must not deadlock saving.
   await install(reader);
   assert.equal(await reader.evaluate(candidate=>window.qaWriter.commitExclusive(candidate.run,candidate.active),winner),'saved');
   assert.deepEqual(await reader.evaluate(key=>JSON.parse(localStorage.getItem(key)),core.CHECKPOINT_KEY),JSON.parse(JSON.stringify({...expected,revision:3})));
   assert.deepEqual(await reader.evaluate(keys=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>!keys.includes(k))),[core.CHECKPOINT_KEY,core.SAVE_KEY,core.ACTIVE_KEY]),extraBefore,'no unrelated progression/storage changes');
   assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
   console.log(JSON.stringify({case:'actual-two-writer-native-lock',width,outcome,arrival,queuePolls,results,winningLevel:winner.run.level,winningHearts:winner.run.hearts,freshWriterRevision:3,errors,forbidden}));
  }catch(error){
   console.log(JSON.stringify({case:'actual-two-writer-failure',width,outcome,arrival,documents:await Promise.all([a,b].filter(Boolean).map(p=>p.evaluate(key=>({events:window.qaStorageEvents,checkpoint:localStorage.getItem(key)}),core.CHECKPOINT_KEY).catch(()=>null))),errors,forbidden}));throw error;
  }finally{await context.close();}
 });
}
