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
async function open(checkpoint) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const errors=[],forbidden=[];
  await context.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin!==base.origin||!['GET','HEAD'].includes(r.method())){forbidden.push(r.method()+' '+r.url());return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({key,checkpoint})=>{
    window.__bossWrites=[];
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){if(k===key)window.__bossWrites.push(JSON.parse(v));return original.call(this,k,v);};
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(checkpoint));
  },{key:core.CHECKPOINT_KEY,checkpoint});
  const time=new Date('2026-11-04T18:00:00Z');await page.clock.install({time});await page.clock.pauseAt(time);
  await page.goto(new URL('/play/brain-rot',base).href);
  await page.getByRole('button',{name:'Resume / Retry',exact:true}).click();
  const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),core.CHECKPOINT_KEY);
  return {context,page,read,errors,forbidden};
}

test('every boundary write is coherent and an isolated atomic record resumes the incoming bank',async()=>{
 const checkpoint=fixture('goblin-jetpack');
 const bank=games.createGame('rune-fusion',3,555);bank.goal=Number.MAX_SAFE_INTEGER;
 bank.grid=[8,4,2,0,0,0,0,0,0,0,0,0,0,0,0,0];bank.score=19;bank.tick=120;
 checkpoint.run.boss.states['rune-fusion']=bank;
 const f=await open(checkpoint);
 let recovery;
 try{
  // Exclude fixture/start writes; inspect every save produced by the boundary tick.
  await f.page.evaluate(()=>window.__bossWrites=[]);
  await f.page.clock.runFor(18);
  const writes=await f.page.evaluate(()=>window.__bossWrites);
  assert.ok(writes.length>0);
  for(const c of writes){
   assert.equal(c.active?.state?.id,c.run.boss.queue[c.run.boss.index]);
   assert.equal(c.active?.level,31);
  }
  recovery=await f.read();
  assert.equal(recovery.run.boss.index,1);assert.equal(recovery.run.boss.segmentMs,0);
  assert.equal(recovery.active.state.id,'rune-fusion');assert.deepEqual(recovery.active.state.grid,bank.grid);
  assert.equal(recovery.active.state.score,19);assert.equal(recovery.active.state.tick,120);
  assert.deepEqual(recovery.run.boss.snapshots['rune-fusion'],recovery.active.state);
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.forbidden,[]);
  console.log(JSON.stringify({case:'all-boundary-writes',writes:writes.length,active:recovery.active.state.id,score:recovery.active.state.score}));
 }finally{await f.context.close();}
 // A new isolated browser context receives only the captured atomic record;
 // no clean pagehide write or legacy active/run key can repair it.
 const recovered=await open(recovery);
 try{
  const actual=await recovered.read();
  assert.equal(actual.active.state.id,'rune-fusion');
  assert.deepEqual(actual.active.state.grid,bank.grid);
  assert.equal(actual.active.state.score,19);assert.equal(actual.active.state.tick,120);
  assert.equal(actual.run.boss.seconds['goblin-jetpack'],15);
  assert.deepEqual(recovered.errors,[]);assert.deepEqual(recovered.forbidden,[]);
  console.log(JSON.stringify({case:'atomic-only-handoff-recovery',active:actual.active.state.id,tick:actual.active.state.tick,score:actual.active.state.score}));
 }finally{await recovered.context.close();}
});

test('fortieth segment checkpoint clears active state and stays terminal without an extra tick',async()=>{
 const checkpoint=fixture('goblin-jetpack');
 for(const id of Object.keys(checkpoint.run.boss.seconds))checkpoint.run.boss.seconds[id]=60;
 checkpoint.run.boss.seconds['goblin-jetpack']=45;
 const f=await open(checkpoint);
 try{
  await f.page.clock.runFor(18);
  const raw=await f.read();
  assert.equal(raw.run.boss.won,true);assert.equal(raw.active,null);
  assert.equal(Object.values(raw.run.boss.seconds).reduce((a,b)=>a+b,0),600);
  await f.page.getByRole('status').filter({hasText:'BRAIN ROT KING DEFEATED'}).waitFor();
  await f.page.clock.runFor(1000);
  assert.deepEqual(await f.read(),raw);
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.forbidden,[]);
  console.log(JSON.stringify({case:'boss-terminal-checkpoint',won:raw.run.boss.won,active:raw.active,completedSeconds:600}));
 }finally{await f.context.close();}
});
