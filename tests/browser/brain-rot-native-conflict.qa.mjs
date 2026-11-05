/** QA fixtures: real origin locks/storage, frozen simulation; no application edits. */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {chromium} from 'playwright';
import {checkpointSaveBarrier} from './brain-rot-save-barrier.mjs';
if(process.getuid?.()===0)throw Error('Non-root sandboxed Chromium required');
const base=new URL(process.env.QA_BASE_URL||'http://127.0.0.1:3148');assert.equal(base.hostname,'127.0.0.1');
const core={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/brainRot/core.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:core,structuredClone});
const lock='life-ascension:brain-rot:checkpoint-writer:v1';let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,chromiumSandbox:true});});
after(async()=>{await browser?.close();});
for(const width of [320,375,390,430])for(const outcome of ['completion','heart-loss'])for(const attempt of [1,2]){
 test(`${width}px ${outcome} native conflict recovery, repetition ${attempt}`,{timeout:45000},async()=>{
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true});
  const errors=[],forbidden=[];let holder,player;
  const initial={version:1,revision:1,run:core.newRun(93),active:null};
  const accepted={...initial,revision:2,run:outcome==='completion'?core.completeLevel(initial.run):{...initial.run,hearts:2}};
  assert.ok(core.validRun(accepted.run));
  try{
   await context.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin!==base.origin||!['GET','HEAD'].includes(r.method())){forbidden.push(r.method()+' '+r.url());return route.abort();}return route.continue();});
   const time=new Date('2026-11-05T18:30:00Z');await context.clock.install({time});await context.clock.pauseAt(time);
   await context.addInitScript(({key,initial})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(initial));},{key:core.CHECKPOINT_KEY,initial});
   holder=await context.newPage();player=await context.newPage();
   for(const p of [holder,player]){p.on('pageerror',e=>errors.push(e.message));await p.goto(new URL('/play/brain-rot',base).href);await p.getByRole('button',{name:'Start Challenge',exact:true}).waitFor();}
   await holder.evaluate(lock=>new Promise(acquired=>{void navigator.locks.request(lock,()=>new Promise(release=>{window.releaseLock=release;acquired();}));}),lock);
   await player.getByRole('button',{name:'Start Challenge',exact:true}).click();
   // Native polling must not depend on a frozen requestAnimationFrame clock.
   await holder.evaluate(async lock=>{const q=await navigator.locks.query();if(!q.pending.some(x=>x.name===lock))throw Error('Start did not queue native checkpoint lock');},lock);
   await player.getByText('Saving checkpoint…',{exact:true}).waitFor();
   assert.equal(await holder.evaluate(key=>JSON.parse(localStorage.getItem(key)).revision,core.CHECKPOINT_KEY),1);
   // Author a valid competing writer outcome; this does not simulate a natural peer run.
   // Browser itself delivers the storage event; no synthetic event or LockManager mock.
   await holder.evaluate(({key,saveKey,accepted})=>{localStorage.setItem(key,JSON.stringify(accepted));localStorage.setItem(saveKey,JSON.stringify(accepted.run));window.releaseLock();},{key:core.CHECKPOINT_KEY,saveKey:core.SAVE_KEY,accepted});
   await checkpointSaveBarrier(player);
   await player.getByText(`Level ${accepted.run.level}/31`,{exact:true}).waitFor();
   await player.getByText(`❤️ ${accepted.run.hearts}`,{exact:true}).waitFor();
   assert.equal(await player.getByRole('button',{name:'Pause & Save',exact:true}).count(),0,'conflict must recover paused');
   assert.deepEqual(await player.evaluate(key=>JSON.parse(localStorage.getItem(key)),core.CHECKPOINT_KEY),JSON.parse(JSON.stringify(accepted)),'stale queued Start must not overwrite peer outcome');
   // Old mount teardown must not retry stale dirty state over the accepted revision.
   await player.getByRole('link',{name:'← Back to Hub',exact:true}).click();await player.getByRole('heading',{name:'Hub',exact:true}).waitFor();await checkpointSaveBarrier(player);
   await player.getByRole('link',{name:'Enter Brain Rot',exact:true}).click();await player.getByRole('button',{name:'Start Challenge',exact:true}).waitFor();
   await player.getByText(`Level ${accepted.run.level}/31`,{exact:true}).waitFor();await player.getByText(`❤️ ${accepted.run.hearts}`,{exact:true}).waitFor();
   assert.deepEqual(await player.evaluate(key=>JSON.parse(localStorage.getItem(key)),core.CHECKPOINT_KEY),JSON.parse(JSON.stringify(accepted)));
   assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
   console.log(JSON.stringify({case:'native-conflict-frozen-clock',width,outcome,attempt,level:accepted.run.level,hearts:accepted.run.hearts,revision:2,errors,forbidden}));
  }catch(error){
   console.log(JSON.stringify({case:'native-conflict-failure',width,outcome,attempt,stored:holder?await holder.evaluate(key=>localStorage.getItem(key),core.CHECKPOINT_KEY):null,ui:player?await player.locator('main').innerText().catch(()=>null):null,errors,forbidden}));throw error;
  }finally{await context.close();}
 });
}
