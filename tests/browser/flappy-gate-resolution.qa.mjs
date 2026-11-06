/** Actual Resume/tick/result/persistence with authored gate snapshots; no natural-run claim. */
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {chromium} from 'playwright';import {checkpointSaveBarrier} from './brain-rot-save-barrier.mjs';
if(process.getuid?.()===0)throw Error('Non-root sandboxed Chromium required');
const base=new URL(process.env.QA_BASE_URL||'http://127.0.0.1:3148');assert.equal(base.hostname,'127.0.0.1');
const core={},games={};const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(compile('lib/brainRot/core.ts'),{exports:core,structuredClone});vm.runInNewContext(compile('lib/brainRot/games.ts'),{exports:games,require:()=>core,structuredClone});
let seed=1;while(core.currentGame(core.newRun(seed))!=='flappy-wyvern')seed++;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,chromiumSandbox:true});
try{
 for(const width of [320,375,390,430])for(const scenario of ['clear','lethal','stationary']){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true}),errors=[],forbidden=[];
  const run=core.newRun(seed),state=games.createGame('flappy-wyvern',1,110);state.progress=state.goal-1;state.score=90;
  state.player.y=scenario==='lethal'?.7:.5;
  const x=scenario==='stationary'?.499:.504,vx=scenario==='stationary'?0:-.0045;
  state.entities=[{x,y:.28,vx,vy:0,type:2},{x,y:.72,vx,vy:0,type:3}];
  const initial={version:1,revision:1,run,active:{level:1,state}};assert.equal(core.validGameState(state),true);
  await context.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin!==base.origin||!['GET','HEAD'].includes(r.method())){forbidden.push(r.method()+' '+r.url());return route.abort();}return route.continue();});
  await context.addInitScript(({key,initial})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(initial));},{key:core.CHECKPOINT_KEY,initial});
  const time=new Date('2026-11-06T00:30:00Z');await context.clock.install({time});await context.clock.pauseAt(time);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('/play/brain-rot',base).href);await page.getByRole('button',{name:'Resume / Retry',exact:true}).click();await checkpointSaveBarrier(page);
  await page.clock.runFor(20);await checkpointSaveBarrier(page);
  if(scenario==='stationary'){await page.getByRole('button',{name:'Pause & Save',exact:true}).click();await checkpointSaveBarrier(page);}
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),core.CHECKPOINT_KEY);
  assert.equal(saved.run.level,scenario==='clear'?2:1);assert.equal(saved.run.hearts,scenario==='lethal'?2:3);
  if(scenario==='stationary'){assert.equal(saved.active.state.progress,9);assert.equal(saved.active.state.score,90);assert.equal(saved.active.state.tick,1);await page.getByRole('button',{name:'Resume / Retry',exact:true}).waitFor();}
  else{assert.equal(saved.active,null);await page.getByRole('button',{name:'Start Challenge',exact:true}).waitFor();}
  await page.getByText(`Level ${saved.run.level}/31`,{exact:true}).waitFor();await page.getByText(`❤️ ${saved.run.hearts}`,{exact:true}).waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
  console.log(JSON.stringify({case:'flappy-gate-resolution',width,scenario,level:saved.run.level,hearts:saved.run.hearts,activeProgress:saved.active?.state.progress??null,errors,forbidden}));
  await context.close();
 }
}finally{await browser.close();}
