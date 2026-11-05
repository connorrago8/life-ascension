import {checkpointSaveBarrier} from './brain-rot-save-barrier.mjs';
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
  await page.addInitScript(({key,checkpoint})=>localStorage.setItem(key,JSON.stringify(checkpoint)),{key:core.CHECKPOINT_KEY,checkpoint});
  const time=new Date('2026-11-04T18:00:00Z');await page.clock.install({time});await page.clock.pauseAt(time);
  await page.goto(new URL('/play/brain-rot',base).href);
  await page.getByRole('button',{name:'Resume / Retry',exact:true}).click();await checkpointSaveBarrier(page);
  const read=async()=>{await checkpointSaveBarrier(page);return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),core.CHECKPOINT_KEY);};
  return {context,page,read,errors,forbidden};
}

test('boss rotation writes an atomic active state matching the newly selected game',async()=>{
  const f=await open(fixture('goblin-jetpack'));
  try {
    await f.page.clock.runFor(18);
    const raw=await f.read(),expected=raw.run.boss.queue[raw.run.boss.index];
    console.log(JSON.stringify({case:'boss-atomic-boundary',index:raw.run.boss.index,segmentMs:raw.run.boss.segmentMs,expected,active:raw.active?.state?.id,errors:f.errors,forbidden:f.forbidden}));
    assert.equal(raw.run.boss.index,1,'fixture must cross a real segment boundary');
    assert.deepEqual(f.errors,[]);assert.deepEqual(f.forbidden,[]);
    assert.equal(raw.active?.state?.id,expected,'atomic run and active game must describe the same segment');
  } finally {await f.context.close();}
});

test('lethal frame at segment boundary loses one heart without awarding completed time',async()=>{
  const checkpoint=fixture('flappy-wyvern');checkpoint.active.state.player.y=.939;checkpoint.active.state.player.vy=.012;
  const f=await open(checkpoint);
  try {
    await f.page.clock.runFor(18);
    const raw=await f.read(),boss=raw.run.boss;
    console.log(JSON.stringify({case:'loss-before-credit',hearts:boss.hearts,index:boss.index,segmentMs:boss.segmentMs,seconds:boss.seconds['flappy-wyvern'],errors:f.errors,forbidden:f.forbidden}));
    assert.equal(boss.hearts,2);assert.equal(boss.index,0);assert.equal(boss.segmentMs,0);assert.equal(boss.seconds['flappy-wyvern'],0);
    assert.equal(raw.active,null);
    assert.equal(JSON.stringify(boss.states['flappy-wyvern']),JSON.stringify(checkpoint.run.boss.snapshots['flappy-wyvern']));
    assert.deepEqual(f.errors,[]);assert.deepEqual(f.forbidden,[]);
  } finally {await f.context.close();}
});

test('Rune idle near a switch cannot accumulate boss time or complete a segment',async()=>{
  const f=await open(fixture('rune-fusion','goblin-jetpack'));
  try {
    await f.page.clock.runFor(1000);
    const raw=await f.read();
    console.log(JSON.stringify({case:'rune-idle-boundary',index:raw.run.boss.index,segmentMs:raw.run.boss.segmentMs,tick:raw.active.state.tick,errors:f.errors,forbidden:f.forbidden}));
    assert.equal(raw.run.boss.index,0);assert.equal(raw.run.boss.segmentMs,14990);
    assert.equal(raw.run.boss.seconds['rune-fusion'],0);assert.ok(raw.active.state.tick>59);
    assert.deepEqual(f.errors,[]);assert.deepEqual(f.forbidden,[]);
  } finally {await f.context.close();}
});
