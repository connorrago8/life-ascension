/** QA-only native-lock timeout/lifecycle tests. No gameplay implementation writes. */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {chromium} from 'playwright';
import {checkpointSaveBarrier} from './brain-rot-save-barrier.mjs';
if(process.getuid?.()===0)throw Error('Non-root sandboxed Chromium required');
const base=new URL(process.env.QA_BASE_URL||'http://127.0.0.1:3148');assert.equal(base.hostname,'127.0.0.1');
const core={},games={};const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(compile('lib/brainRot/core.ts'),{exports:core,structuredClone});
vm.runInNewContext(compile('lib/brainRot/games.ts'),{exports:games,require:()=>core,structuredClone});
const lock='life-ascension:brain-rot:checkpoint-writer:v1';let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,chromiumSandbox:true});});
after(async()=>{await browser?.close();});
function fixture(id){
 const run=core.newRun(93),index=run.order.slice(0,10).indexOf(id);[run.order[0],run.order[index]]=[run.order[index],run.order[0]];
 const state=games.createGame(id,1,123);
 if(id==='rune-fusion'){state.grid=[64,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0];state.progress=64;state.score=128;}
 else{state.player.y=.939;state.player.vy=.012;}
 assert.ok(core.validRun(run)&&core.validGameState(state));return{version:1,revision:1,run,active:{level:1,state}};
}
async function session(id){
 const context=await browser.newContext({viewport:{width:390,height:844}}),errors=[],forbidden=[];
 await context.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin!==base.origin||!['GET','HEAD'].includes(r.method())){forbidden.push(r.method()+' '+r.url());return route.abort();}return route.continue();});
 const time=new Date('2026-11-05T14:40:00Z');await context.clock.install({time});await context.clock.pauseAt(time);
 await context.addInitScript(({key,checkpoint})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(checkpoint));},{key:core.CHECKPOINT_KEY,checkpoint:fixture(id)});
 const holder=await context.newPage(),page=await context.newPage();
 for(const p of [holder,page]){p.on('pageerror',e=>errors.push(e.message));await p.goto(new URL('/play/brain-rot',base).href);await p.getByRole('button',{name:'Resume / Retry',exact:true}).waitFor();}
 await holder.evaluate(lock=>{window.held=false;navigator.locks.request(lock,()=>new Promise(resolve=>{window.releaseLock=resolve;window.held=true;}));},lock);await holder.waitForFunction(()=>window.held);
 await page.getByRole('button',{name:'Resume / Retry',exact:true}).click();
 if(id==='rune-fusion')await page.keyboard.down('ArrowLeft');
 await page.clock.runFor(18);
 if(id==='rune-fusion')await page.keyboard.up('ArrowLeft');
 await page.getByText(id==='rune-fusion'?'Level 2/31':'❤️ 2',{exact:true}).waitFor();
 const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),core.CHECKPOINT_KEY);
 async function release(){await holder.evaluate(()=>window.releaseLock());await checkpointSaveBarrier(page);}
 async function timeout(){await page.clock.runFor(2100);await page.getByText('Device save unavailable. Keep this tab open; your next save will retry.',{exact:true}).waitFor();}
 async function roundtrip(){await page.getByRole('link',{name:'← Back to Hub',exact:true}).click();await page.getByRole('heading',{name:'Hub',exact:true}).waitFor();await checkpointSaveBarrier(page);await page.getByRole('link',{name:'Enter Brain Rot',exact:true}).click();await page.getByRole('button',{name:/^(Resume \/ Retry|Start Challenge)$/}).waitFor();return{raw:await read(),text:await page.locator('main').innerText()};}
 return{context,page,read,release,timeout,roundtrip,errors,forbidden};
}
test('timed-out accepted completion retries on Hub exit once the native lock is free',async()=>{
 const f=await session('rune-fusion');try{
  await f.timeout();await f.release();const before=await f.read(),recovered=await f.roundtrip();
  const level=Number(recovered.text.match(/Level (\d+)\/31/)[1]);
  console.log(JSON.stringify({case:'timeout-completion-hub',uiBeforeExit:2,durableBeforeExit:before.run.level,durableAfterReturn:recovered.raw.run.level,renderedAfterReturn:level,revision:recovered.raw.revision,errors:f.errors,forbidden:f.forbidden}));
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.forbidden,[]);
  assert.equal(recovered.raw.run.level,2,'released lock permits a final dirty completion retry before Hub navigation discards memory');assert.equal(level,2);
 }finally{await f.context.close();}
});
test('timed-out spent heart retries on Hub exit without restoring the lost heart',async()=>{
 const f=await session('flappy-wyvern');try{
  await f.timeout();await f.release();const before=await f.read(),recovered=await f.roundtrip();
  const hearts=Number(recovered.text.match(/❤️\s*(\d+)/u)[1]);
  console.log(JSON.stringify({case:'timeout-heart-hub',uiBeforeExit:2,durableBeforeExit:before.run.hearts,durableAfterReturn:recovered.raw.run.hearts,renderedAfterReturn:hearts,errors:f.errors,forbidden:f.forbidden}));
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.forbidden,[]);
  assert.equal(recovered.raw.run.hearts,2,'released lock permits retry of dirty heart loss before Hub discards memory');assert.equal(hearts,2);
 }finally{await f.context.close();}
});
test('control: explicit next Start retries the failed completion after lock recovery',async()=>{
 const f=await session('rune-fusion');try{
  await f.timeout();await f.release();await f.page.getByRole('button',{name:'Start Challenge',exact:true}).click();await checkpointSaveBarrier(f.page);
  await f.page.getByRole('button',{name:'Pause & Save',exact:true}).click();await checkpointSaveBarrier(f.page);
  const recovered=await f.roundtrip();
  console.log(JSON.stringify({case:'timeout-explicit-save-control',level:recovered.raw.run.level,errors:f.errors,forbidden:f.forbidden}));
  assert.equal(recovered.raw.run.level,2);assert.deepEqual(f.errors,[]);assert.deepEqual(f.forbidden,[]);
 }finally{await f.context.close();}
});
