/** Delay application scripts to exercise real SSR-to-client query changes. */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
if(process.getuid?.()===0)throw Error('Non-root sandboxed Chromium required');
const base=new URL(process.env.QA_BASE_URL||'http://127.0.0.1:3148');assert.equal(base.hostname,'127.0.0.1');let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,chromiumSandbox:true});});
after(async()=>{await browser?.close();});
for(const width of [320,375,390,430])for(const [initial,next] of [['?preview=1','?preview=0'],['?preview=0','?preview=1&unrelated=do-not-forward']]){
 test(`${width}px query ${initial} → ${next} before hydration`,{timeout:45000},async()=>{
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true}),errors=[],forbidden=[];
  let release;const scriptsReady=new Promise(resolve=>{release=resolve;});let heldScripts=0;
  await context.route('**/*',async route=>{const r=route.request();if(new URL(r.url()).origin!==base.origin||!['GET','HEAD'].includes(r.method())){forbidden.push(r.method()+' '+r.url());return route.abort();}if(r.resourceType()==='script'){heldScripts++;await scriptsReady;}return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(new URL('/play/emberhaven/blacksmith'+initial,base).href,{waitUntil:'commit'});
   const character=page.getByRole('link',{name:'Open Character →',exact:true});
   const back=page.getByRole('navigation',{name:'Back navigation',exact:true}).getByRole('link');
   const oldSuffix=initial==='?preview=1'?'?preview=1':'';
   assert.equal(await character.getAttribute('href'),'/character'+oldSuffix,'server-rendered query must be correct before client scripts');
   assert.equal(await back.getAttribute('href'),'/play/emberhaven'+oldSuffix);
   await page.evaluate(search=>history.pushState(null,'',location.pathname+search),next);
   const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
   release();await page.waitForLoadState('load');assert.ok(heldScripts>0,'must actually hold application scripts before query change');
   const suffix=next.startsWith('?preview=1')?'?preview=1':'';
   await page.waitForFunction(href=>[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Open Character →')?.getAttribute('href')===href,'/character'+suffix,{timeout:10000});
   assert.equal(await back.getAttribute('href'),'/play/emberhaven'+suffix);
   // Native modified activation uses the rendered href; verify it before clicking.
   assert.equal(await character.getAttribute('href'),'/character'+suffix);
   await back.click();await page.waitForURL(u=>u.pathname==='/play/emberhaven'&&u.search==suffix);
   assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),before);
   assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
   console.log(JSON.stringify({case:'town-before-hydration-query',width,initial,next,heldScripts,character:'/character'+suffix,back:'/play/emberhaven'+suffix,errors,forbidden}));
  }catch(error){console.log(JSON.stringify({case:'town-before-hydration-failure',width,initial,next,heldScripts,url:page.url(),links:await page.locator('a').evaluateAll(nodes=>nodes.map(a=>({text:a.textContent.trim(),href:a.getAttribute('href')}))),errors,forbidden}));throw error;}
  finally{release();await context.close();}
 });
}
