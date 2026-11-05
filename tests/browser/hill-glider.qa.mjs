/** Real localhost controls and idle-loss journey; authored seed, frozen clock, no account writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mkdir} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {chromium} from 'playwright';
import {checkpointSaveBarrier} from './brain-rot-save-barrier.mjs';
if(process.getuid?.()===0)throw Error('Non-root sandboxed Chromium required');
const base=new URL(process.env.QA_BASE_URL||'http://127.0.0.1:3148');assert.equal(base.hostname,'127.0.0.1');
const core={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/brainRot/core.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:core,structuredClone});
let seed=1;while(core.currentGame(core.newRun(seed))!=='hill-glider')seed++;
await mkdir('artifacts/hill-glider',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,chromiumSandbox:true});
try{
 for(const width of [320,375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,reducedMotion:'reduce'}),errors=[],forbidden=[];
  await context.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin!==base.origin||!['GET','HEAD'].includes(r.method())){forbidden.push(r.method()+' '+r.url());return route.abort();}return route.continue();});
  await context.addInitScript(({key,run})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(run));},{key:core.SAVE_KEY,run:core.newRun(seed)});
  const time=new Date('2026-11-05T23:30:00Z');await context.clock.install({time});await context.clock.pauseAt(time);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('/play/brain-rot',base).href);
  await page.getByRole('button',{name:'Start Challenge',exact:true}).click();
  await page.getByText('Objective: Land 6 clean downhill glides',{exact:true}).waitFor();await checkpointSaveBarrier(page);
  const toggle=page.getByRole('button',{name:'Toggle dive',exact:true});
  const hold=page.getByRole('button',{name:'Hold to dive',exact:true});
  assert.equal(await toggle.getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('svg polygon').count(),1,'visible collision terrain');
  for(const b of [hold,toggle]){const r=await b.boundingBox();assert.ok(r&&r.width>=44&&r.height>=44&&r.x>=0&&r.x+r.width<=width+1&&r.y+r.height<=844);assert.ok(await b.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el;}),'initial control center is above navigation');}
  await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'true');await page.clock.runFor(400);
  await page.getByRole('button',{name:'Pause & Save',exact:true}).click();await checkpointSaveBarrier(page);
  const checkpoint=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),core.CHECKPOINT_KEY);
  const paused=await checkpoint();assert.ok(paused.active.state.glide.distance>0);assert.equal(paused.active.state.lastInput,'hold');assert.equal(paused.active.state.progress,0);
  await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.down('Space');await page.clock.runFor(300);await page.keyboard.up('Space');assert.deepEqual(await checkpoint(),paused,'paused input cannot advance or rewrite');
  await page.getByRole('button',{name:'Resume / Retry',exact:true}).click();await page.keyboard.down('Space');await page.clock.runFor(200);assert.equal(await toggle.getAttribute('aria-pressed'),'true');
  await page.keyboard.up('Space');assert.equal(await toggle.getAttribute('aria-pressed'),'false');await page.clock.runFor(200);
  await page.getByRole('button',{name:'Pause & Save',exact:true}).click();await checkpointSaveBarrier(page);
  const released=await checkpoint();assert.equal(released.active.state.lastInput,null);assert.ok(released.active.state.tick>paused.active.state.tick);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`artifacts/hill-glider/${width}-paused.png`,fullPage:true});
  // Fresh browser context below proves actual elapsed time without input cannot clear.
  assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);await context.close();
  const idle=await browser.newContext({viewport:{width,height:844},hasTouch:true}),idleErrors=[],idleForbidden=[];
  await idle.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin!==base.origin||!['GET','HEAD'].includes(r.method())){idleForbidden.push(r.url());return route.abort();}return route.continue();});
  await idle.addInitScript(({key,run})=>localStorage.setItem(key,JSON.stringify(run)),{key:core.SAVE_KEY,run:core.newRun(seed)});
  await idle.clock.install({time});await idle.clock.pauseAt(time);const p=await idle.newPage();p.on('pageerror',e=>idleErrors.push(e.message));
  await p.goto(new URL('/play/brain-rot',base).href);await p.getByRole('button',{name:'Start Challenge',exact:true}).click();await checkpointSaveBarrier(p);await p.clock.runFor(6000);await checkpointSaveBarrier(p);
  await p.getByText('❤️ 2',{exact:true}).waitFor();await p.getByRole('button',{name:'Start Challenge',exact:true}).waitFor();
  const stopped=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),core.CHECKPOINT_KEY);assert.equal(stopped.run.level,1);assert.equal(stopped.run.hearts,2);assert.equal(stopped.active,null);
  assert.deepEqual(idleErrors,[]);assert.deepEqual(idleForbidden,[]);await idle.close();
  console.log(`PASS Hill Glider ${width}px: terrain,44px controls,toggle/Space release,paused immutable save,real idle loss spends one heart/no level; errors[]/forbidden[]`);
 }
}finally{await browser.close();}
