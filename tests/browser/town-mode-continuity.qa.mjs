import assert from 'node:assert/strict';
import { chromium } from 'playwright';
if(process.getuid?.()===0)throw Error('Use a sandboxed non-root browser.');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3148',origin=new URL(base).origin;
assert.equal(new URL(base).hostname,'127.0.0.1');
const key='la.crypt.activeRun.v1';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,chromiumSandbox:true});
try{
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true});
  const errors=[],forbidden=[];
  await context.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin!==origin||!['GET','HEAD'].includes(r.method())){forbidden.push(r.method()+' '+r.url());return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const read=()=>page.evaluate(key=>localStorage.getItem(key),key);
  const mode=async path=>{await page.waitForURL(url=>url.pathname===path&&url.searchParams.get('preview')==='1');};
  await page.goto(base+'/play?preview=1');
  await page.getByRole('link',{name:'Enter →',exact:true}).click();await mode('/play/delve');
  await page.getByRole('button',{name:'Enter Floor 1',exact:true}).click();
  await page.getByRole('button',{name:/^Start with the Bruiser deck/}).click();
  await page.getByRole('button',{name:/^Take .* costs /}).first().click();
  await page.getByRole('heading',{name:'Choose your path',exact:true}).waitFor();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.state?.phase==='map',key);
  const before=await read();assert.equal(JSON.parse(before).owner,'preview');
  // Real browser Back, rather than ending the run, returns to the originating Hub.
  await page.goBack();await mode('/play');await page.getByRole('link',{name:'Continue run',exact:true}).waitFor();
  await page.getByRole('link',{name:'Visit Emberhaven town →',exact:true}).click();await mode('/play/emberhaven');
  const locations=page.getByRole('navigation',{name:'Emberhaven locations',exact:true});
  await locations.getByRole('link').first().waitFor();assert.equal(await locations.getByRole('link').count(),6);
  await page.waitForFunction(()=>[...document.querySelectorAll('nav[aria-label="Emberhaven locations"] a')].every(a=>new URL(a.href).searchParams.get('preview')==='1'));
  for(const link of await locations.getByRole('link').all()){
   const url=new URL(await link.getAttribute('href'),origin);assert.equal(url.searchParams.get('preview'),'1');
  }
  await page.getByRole('button',{name:'Begin the Lantern Route',exact:true}).click();
  await page.getByRole('link',{name:'Seek the next clue →',exact:true}).click();await mode('/play/emberhaven/hearth');
  await page.getByRole('button',{name:'Talk to Hearth keeper',exact:true}).click();
  await page.getByRole('button',{name:'Ask about the Lantern Route',exact:true}).click();
  assert.equal(new URL(await page.getByRole('link',{name:'View quests →',exact:true}).getAttribute('href'),origin).searchParams.get('preview'),'1');
  await page.getByRole('navigation',{name:'Back navigation',exact:true}).getByRole('link').click();await mode('/play/emberhaven');
  await page.getByRole('link',{name:'Seek the next clue →',exact:true}).click();await mode('/play/emberhaven/blacksmith');
  assert.equal(await page.getByRole('link',{name:'Open Character →',exact:true}).getAttribute('href'),'/character?preview=1');
  await page.getByRole('navigation',{name:'Back navigation',exact:true}).getByRole('link').click();await mode('/play/emberhaven');
  await locations.getByRole('link',{name:'Visit Waystone',exact:true}).click();await mode('/play/emberhaven/waystone');
  await page.getByRole('link',{name:'Open Hub →',exact:true}).click();await mode('/play');
  await page.getByRole('link',{name:'Continue run',exact:true}).waitFor();
  assert.equal(await read(),before,'Town excursion never rewrites preview Crypt save');
  // Map-node entry and Trail Gate use the same mode contract as the text links.
  await page.getByRole('button',{name:'Town, open Emberhaven',exact:true}).click();await mode('/play/emberhaven');
  await locations.getByRole('link',{name:'Visit Trail Gate',exact:true}).click();await mode('/play');
  await page.getByRole('link',{name:'Continue run',exact:true}).click();await mode('/play/delve');
  await page.getByRole('heading',{name:'Choose your path',exact:true}).waitFor();
  const continued=JSON.parse(await read());assert.equal(continued.owner,'preview');assert.deepEqual(continued.state,JSON.parse(before).state);
  // Normal-mode Town links remain plain and do not claim the preview-owned run.
  await page.goto(base+'/play/emberhaven');
  await page.getByRole('heading',{name:'Emberhaven',exact:true}).waitFor();
  for(const link of await locations.getByRole('link').all())assert.equal(new URL(await link.getAttribute('href'),origin).searchParams.has('preview'),false);
  await locations.getByRole('link',{name:'Visit Trail Gate',exact:true}).click();
  await page.getByRole('heading',{name:'Hub',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Continue run',exact:true}).count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
  console.log(`PASS ${width}px Town mode continuity: real preview run→browserBack→Hub→Town→Hearth→Blacksmith→Waystone→Hub→Town map→TrailGate→Continue; preview owner/state retained;normal paths plain;zero external/write requests`);
  await context.close();
 }
}finally{await browser.close();}
