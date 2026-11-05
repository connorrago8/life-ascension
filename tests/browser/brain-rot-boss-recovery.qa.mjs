import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { chromium } from 'playwright';
if(process.getuid?.()===0)throw Error('Non-root sandboxed browser required.');
const base=new URL(process.env.QA_BASE_URL||'http://127.0.0.1:3146');
assert.equal(base.hostname,'127.0.0.1');
const core={},games={};
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(compile('lib/brainRot/core.ts'),{exports:core,structuredClone});
vm.runInNewContext(compile('lib/brainRot/games.ts'),{exports:games,require:()=>core,structuredClone});
let browser;
before(async()=>{browser=await chromium.launch({chromiumSandbox:true,executablePath:process.env.CHROMIUM_BIN});});
after(async()=>{await browser?.close();});

function fixture(first,second='rune-fusion') {
  const run={...core.newRun(71),level:31,best:31,boss:core.newBoss(71)};
  run.boss.queue=[first,...(second!==first?[second]:[]),...core.GAMES.map(g=>g.id).filter(id=>id!==first&&id!==second)];
  run.boss.segmentMs=14990;
  const entry=games.createGame(first,3,123);entry.goal=Number.MAX_SAFE_INTEGER;
  run.boss.snapshots[first]=structuredClone(entry);
  const state=structuredClone(entry);state.tick=59;
  return {version:1,revision:1,run,active:{level:31,state}};
}
async function open(checkpoint, start=true) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const errors=[],forbidden=[];
  await context.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin!==base.origin||!['GET','HEAD'].includes(r.method())){forbidden.push(r.method()+' '+r.url());return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({key,checkpoint})=>localStorage.setItem(key,JSON.stringify(checkpoint)),{key:core.CHECKPOINT_KEY,checkpoint});
  const time=new Date('2026-11-04T18:00:00Z');await page.clock.install({time});await page.clock.pauseAt(time);
  await page.goto(new URL('/play/brain-rot',base).href);
  if(start)await page.getByRole('button',{name:/^(Resume \/ Retry|Start Challenge)$/}).click();
  const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),core.CHECKPOINT_KEY);
  return {context,page,read,errors,forbidden};
}

test('a survival segment cannot award fifteen seconds before fifteen active browser seconds',async()=>{
 const checkpoint=fixture('endless-crossing','rune-fusion');
 checkpoint.run.boss.segmentMs=0;checkpoint.active.state.tick=0;
 const f=await open(checkpoint);
 try{
  await f.page.clock.runFor(14999);
  const raw=await f.read();
  console.log(JSON.stringify({case:'boss-active-clock-14999',index:raw.run.boss.index,credited:raw.run.boss.seconds['endless-crossing'],segmentMs:raw.run.boss.segmentMs,errors:f.errors,forbidden:f.forbidden}));
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.forbidden,[]);
  assert.equal(raw.run.boss.index,0,'15-second segment must not rotate before 15000ms of active browser time');
  assert.equal(raw.run.boss.seconds['endless-crossing'],0,'completed-time credit must wait for actual segment duration');
 }finally{await f.context.close();}
});

test('paused wall time leaves boss clock and bank unchanged until explicit Resume',async()=>{
 const checkpoint=fixture('endless-crossing','rune-fusion');
 checkpoint.run.boss.segmentMs=1000;checkpoint.active.state.tick=12;
 const f=await open(checkpoint);
 try{
  await f.page.clock.runFor(320);
  await f.page.getByRole('button',{name:'Pause & Save',exact:true}).click();
  const paused=await f.read();
  await f.page.clock.runFor(30000);
  assert.deepEqual(await f.read(),paused);
  await f.page.getByRole('button',{name:'Resume / Retry',exact:true}).click();
  await f.page.clock.runFor(160);
  await f.page.getByRole('button',{name:'Pause & Save',exact:true}).click();
  const resumed=await f.read();
  assert.equal(resumed.run.boss.index,0);
  assert.ok(resumed.run.boss.segmentMs>paused.run.boss.segmentMs);
  assert.ok(resumed.run.boss.segmentMs-paused.run.boss.segmentMs<200);
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.forbidden,[]);
  console.log(JSON.stringify({case:'boss-explicit-pause-clock',pausedMs:paused.run.boss.segmentMs,afterThirtySeconds:paused.run.boss.segmentMs,resumedMs:resumed.run.boss.segmentMs}));
 }finally{await f.context.close();}
});

test('third lethal frame resets boss attempt and banks without crediting the failed segment',async()=>{
 const checkpoint=fixture('flappy-wyvern','rune-fusion');
 checkpoint.run.boss.hearts=1;
 checkpoint.run.boss.seconds['rune-fusion']=15;
 const bank=games.createGame('rune-fusion',3,991);bank.goal=Number.MAX_SAFE_INTEGER;bank.score=24;
 checkpoint.run.boss.states['rune-fusion']=bank;
 checkpoint.active.state.player.y=.939;checkpoint.active.state.player.vy=.012;
 const f=await open(checkpoint);
 try{
  await f.page.clock.runFor(18);
  const raw=await f.read();
  assert.equal(raw.run.level,31);assert.equal(raw.run.best,31);assert.equal(raw.run.boss.hearts,3);
  assert.equal(raw.run.boss.won,false);assert.equal(raw.run.boss.segmentMs,0);assert.equal(raw.run.boss.index,0);
  assert.ok(Object.values(raw.run.boss.seconds).every(s=>s===0));
  assert.deepEqual(raw.run.boss.states,{});assert.deepEqual(raw.run.boss.snapshots,{});assert.equal(raw.active,null);
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.forbidden,[]);
  console.log(JSON.stringify({case:'boss-third-heart-reset',hearts:raw.run.boss.hearts,level:raw.run.level,banks:Object.keys(raw.run.boss.states).length,completedSeconds:Object.values(raw.run.boss.seconds).reduce((a,b)=>a+b,0)}));
 }finally{await f.context.close();}
});

test('completed boss checkpoint cannot consume another heart through its offered Resume action',async()=>{
 const checkpoint=fixture('flappy-wyvern','rune-fusion');
 for(const id of Object.keys(checkpoint.run.boss.seconds))checkpoint.run.boss.seconds[id]=60;
 checkpoint.run.boss.won=true;checkpoint.run.boss.segmentMs=15000;
 const bank=checkpoint.active.state;bank.player.y=.939;bank.player.vy=.012;
 checkpoint.run.boss.states['flappy-wyvern']=bank;checkpoint.active=null;
 // Simulate recovery of a complete run with a valid nonterminal bank, as retained by prior visits.
 const f=await open(checkpoint,false);
 try{
  const action=f.page.getByRole('button',{name:/^(Resume \/ Retry|Start Challenge)$/});
  const offered=await action.count()>0&&await action.isEnabled();
  if(offered){await action.click();await f.page.clock.runFor(18);}
  const raw=await f.read();
  console.log(JSON.stringify({case:'boss-completed-recovery',offered,won:raw.run.boss.won,hearts:raw.run.boss.hearts,segmentMs:raw.run.boss.segmentMs,active:raw.active?.state?.id??null,errors:f.errors,forbidden:f.forbidden}));
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.forbidden,[]);
  assert.equal(raw.run.boss.won,true);
  assert.equal(raw.run.boss.hearts,3,'completed boss must not resume old hazards and consume a heart');
  assert.equal(raw.run.boss.segmentMs,15000);
  assert.equal(raw.active,null);
 }finally{await f.context.close();}
});
