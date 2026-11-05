/** Systems regression: hrefs reflect initial and query-only navigation. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
if(process.getuid?.()===0)throw Error('Non-root sandboxed browser required');
const base=new URL(process.env.QA_BASE_URL||'http://127.0.0.1:3148');assert.equal(base.hostname,'127.0.0.1');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,chromiumSandbox:true});
try{
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true}),errors=[],forbidden=[];
  await context.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin!==base.origin||!['GET','HEAD'].includes(r.method())){forbidden.push(r.method()+' '+r.url());return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  // Direct entry must never expose an actionable plain Character href in preview.
  await page.goto(new URL('/play/emberhaven/blacksmith?preview=1',base).href);
  const character=page.getByRole('link',{name:'Open Character →',exact:true});
  assert.equal(await character.getAttribute('href'),'/character?preview=1');
  const back=page.getByRole('navigation',{name:'Back navigation',exact:true}).getByRole('link');
  assert.equal(await back.getAttribute('href'),'/play/emberhaven?preview=1');
  // Next integrates the native history API; pathname stays identical throughout.
  for(const search of ['?preview=0','?preview=1&unrelated=do-not-forward','']){
   await page.evaluate(search=>history.pushState(null,'',location.pathname+search),search);
   const suffix=search.startsWith('?preview=1')?'?preview=1':'';
   await page.waitForFunction(href=>[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Open Character →')?.getAttribute('href')===href,'/character'+suffix);
   assert.equal(await character.getAttribute('href'),'/character'+suffix);
   assert.equal(await back.getAttribute('href'),'/play/emberhaven'+suffix);
  }
  await page.goBack();
  await page.waitForFunction(()=>[...document.querySelectorAll('a')].some(a=>a.textContent.trim()==='Open Character →'&&a.getAttribute('href')==='/character?preview=1'));
  assert.equal(await back.getAttribute('href'),'/play/emberhaven?preview=1');
  const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  await back.click();await page.waitForURL(u=>u.pathname==='/play/emberhaven'&&u.searchParams.get('preview')==='1');
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),before);
  assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
  console.log(`PASS ${width}px direct preview Character/Back href, query-only preview on/off, no unrelated forwarding, browser Back, return navigation, unchanged storage; errors[]/forbidden[]`);
  await context.close();
 }
}finally{await browser.close();}
