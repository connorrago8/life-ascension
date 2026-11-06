import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
// Import session fixture without starting another gateway.
const users={connor:'00000000-0000-0000-0000-00000000ce01',izzy:'00000000-0000-0000-0000-00000000ce02'};
function session(name) {
 const user={id:users[name],aud:'authenticated',role:'authenticated',email:name+'@fixture.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 return {user,access_token:[b64({alg:'HS256',typ:'JWT'}),b64({sub:user.id,role:'authenticated',aud:'authenticated',exp:4102444800}),'fixture-not-a-real-signature'].join('.'),refresh_token:'fixture-not-a-real-refresh-token',expires_at:4102444800,expires_in:3600,token_type:'bearer'};
}
if(process.getuid?.()===0) throw Error('Non-root sandboxed browser required');
const base='http://127.0.0.1:3148';
await mkdir('artifacts/companion',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,chromiumSandbox:true});
const errors=[],forbidden=[],receiverPayloads=[];
async function account(name) {
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
 const value='base64-'+Buffer.from(JSON.stringify(session(name))).toString('base64url');
 await context.addCookies([{name:'sb-127-auth-token',value,domain:'127.0.0.1',path:'/',sameSite:'Lax',httpOnly:false,secure:false}]);
 await context.route('**/*',route=>{
  const r=route.request(),u=new URL(r.url());
  const allowedApp=u.origin===base && ['GET','HEAD'].includes(r.method());
  const allowedDb=u.origin==='http://127.0.0.1:54329' && (r.method()==='OPTIONS' || (r.method()==='GET' && ['/auth/v1/user','/rest/v1/quests','/rest/v1/quest_instances'].includes(u.pathname)) || (r.method()==='POST' && /^\/rest\/v1\/rpc\/(companion_command|get_lifetime_xp|create_scheduled_quest|ensure_quest_instance|set_quest_instance_status)$/.test(u.pathname)));
  if(!allowedApp&&!allowedDb) {forbidden.push(r.method()+' '+u.origin+u.pathname);return route.abort();}return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 if(name==='connor') page.on('response',async r=>{if(r.url().includes('/rpc/companion_command')) receiverPayloads.push(await r.text());});
 await page.goto(base+'/companion');await page.getByRole('heading',{name:'Connection & consent',exact:true}).waitFor();
 return {context,page};
}
try {
 const connor=await account('connor'),izzy=await account('izzy');
 // Real Home APIs, not canned data: create/complete personal task before companion assignment.
 await connor.page.getByRole('link',{name:'← Back to Home',exact:true}).click();
 await connor.page.getByRole('heading',{name:'Today’s Quests',exact:true}).waitFor();
 assert.equal(await connor.page.getByRole('link',{name:'Home',exact:true}).getAttribute('aria-current'),'page');
 await connor.page.getByRole('button',{name:'+ Create a quest',exact:true}).click();
 await connor.page.getByLabel('What real-world action will you take?').fill('Put away the laundry');
 await connor.page.getByLabel('Frequency',{exact:true}).selectOption('once');
 await connor.page.getByRole('button',{name:'Schedule quest',exact:true}).click();
 await connor.page.getByText('Put away the laundry',{exact:true}).waitFor();
 connor.page.once('dialog',dialog=>dialog.accept());
 await connor.page.getByRole('button',{name:'Complete',exact:true}).click();
 await connor.page.locator('.xp').filter({hasText:'1 lifetime XP'}).waitFor();
 await connor.page.getByRole('link',{name:'Open companion inbox',exact:true}).focus();
 await connor.page.keyboard.press('Enter');
 await connor.page.getByRole('heading',{name:'Connection & consent',exact:true}).waitFor();
 await connor.page.getByRole('button',{name:'Create private invitation',exact:true}).click();
 const field=connor.page.getByLabel('Invitation code · expires in 7 days');await field.waitFor();const code=await field.inputValue();assert.equal(code.length,64);
 await izzy.page.getByLabel('Have a companion’s code?').fill(code);
 await izzy.page.getByRole('button',{name:'Review invitation',exact:true}).click();
 await izzy.page.getByRole('button',{name:'I consent · request to join',exact:true}).click();
 await izzy.page.getByText('Waiting for the inviter to confirm your account.',{exact:true}).waitFor();
 await connor.page.getByRole('button',{name:'Refresh shared status',exact:true}).click();
 await connor.page.getByRole('button',{name:'Confirm this companion account',exact:true}).click();
 await connor.page.getByText('Private companionship confirmed.',{exact:true}).waitFor();
 await izzy.page.getByRole('button',{name:'Refresh shared status',exact:true}).click();
 await izzy.page.getByLabel('What would you like them to do?').fill('<b>Take a real walk</b>');
 await izzy.page.getByLabel('Real-world reward promise · optional').fill('SECRET sunset picnic');
 await izzy.page.getByLabel('Mystery reward: show ??? until acceptance').check();
 await izzy.page.getByRole('button',{name:'Send to private inbox',exact:true}).click();
 await izzy.page.getByText('Quest delivered to the private inbox.',{exact:true}).waitFor();
 await connor.page.getByRole('button',{name:'Refresh shared status',exact:true}).click();
 await connor.page.getByRole('heading',{name:'<b>Take a real walk</b>',exact:true}).waitFor();
 assert.equal(await connor.page.locator('h3 b').count(),0,'user markup is text, not HTML');
 assert.equal(await connor.page.getByText('SECRET sunset picnic',{exact:true}).count(),0);
 assert.ok(receiverPayloads.every(p=>!p.includes('SECRET sunset picnic')),'hidden promise absent from ALL pre-accept receiver RPC payloads');
 await connor.page.getByRole('button',{name:'Accept + reveal reward',exact:true}).click();
 await connor.page.getByText('SECRET sunset picnic',{exact:true}).waitFor();
 await connor.page.getByRole('button',{name:'I completed this in real life · 2 XP total',exact:true}).dblclick();
 await connor.page.getByText('Completed · 2 XP total for this task, retained across reloads.',{exact:true}).waitFor();
 await connor.page.reload();await connor.page.getByRole('heading',{name:'Connection & consent',exact:true}).waitFor();
 await connor.page.getByText('Completed · 2 XP total for this task, retained across reloads.',{exact:true}).waitFor();
 assert.ok((await connor.page.locator('main').innerText()).includes('Your lifetime XP: 3'));
 await izzy.page.getByRole('button',{name:'Refresh shared status',exact:true}).click();
 await izzy.page.getByText('Completed · 2 XP total for this task, retained across reloads.',{exact:true}).waitFor();
 assert.ok((await izzy.page.locator('main').innerText()).includes('Your lifetime XP: 0'),'separate actor totals');
 // A second offer overlaps the already-completed personal task: upgrade 1→2, not 1+2.
 await izzy.page.getByLabel('What would you like them to do?').fill('Put away the laundry');
 await izzy.page.getByRole('button',{name:'Send to private inbox',exact:true}).click();
 await izzy.page.getByText('Quest delivered to the private inbox.',{exact:true}).waitFor();
 await connor.page.getByRole('button',{name:'Refresh shared status',exact:true}).click();
 await connor.page.getByRole('heading',{name:'Put away the laundry',exact:true}).waitFor();
 await connor.page.getByRole('button',{name:'Accept quest',exact:true}).click();
 await connor.page.getByText('Completed · 2 XP total for this task, retained across reloads.',{exact:true}).nth(1).waitFor();
 assert.ok((await connor.page.locator('main').innerText()).includes('Your lifetime XP: 4'));
 await connor.page.getByRole('link',{name:'← Back to Home',exact:true}).click();
 await connor.page.locator('.xp').filter({hasText:'4 lifetime XP'}).waitFor();
 await connor.page.reload();
 await connor.page.locator('.xp').filter({hasText:'4 lifetime XP'}).waitFor();
 // Home and More provide usable entries at each requested width, including enlarged text.
 for (const width of [320,375,390,430]) {
  await connor.page.setViewportSize({width,height:844});
  await connor.page.evaluate(()=>{document.documentElement.style.fontSize='32px';});
  const entry=connor.page.getByRole('link',{name:'Open companion inbox',exact:true});
  await entry.scrollIntoViewIfNeeded();const box=await entry.boundingBox();
  assert.equal(await entry.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),32,'Home companion body/action text actually scales');
  assert.ok(await entry.evaluate(el=>{const r=el.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return top===el||el.contains(top);}), 'Home companion entry not obscured');
  assert.ok(box&&box.width>=44&&box.height>=44&&box.x>=0&&box.x+box.width<=width+1);
  assert.equal(await connor.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await connor.page.screenshot({path:`artifacts/companion/${width}-home-text200.png`,fullPage:true});
 }
 await connor.page.evaluate(()=>{document.documentElement.style.fontSize='';});
 await connor.page.getByRole('button',{name:'More',exact:true}).click();
 const more=connor.page.getByRole('dialog',{name:'More',exact:true});
 await more.getByRole('link',{name:'Companion inbox',exact:true}).click();
 await connor.page.getByRole('heading',{name:'Connection & consent',exact:true}).waitFor();
 assert.equal(await connor.page.getByRole('button',{name:'More',exact:true}).getAttribute('aria-current'),'page');
 assert.ok((await connor.page.locator('main').innerText()).includes('Your lifetime XP: 4'));
 await izzy.page.getByRole('button',{name:'Refresh shared status',exact:true}).click();
 assert.ok((await izzy.page.locator('main').innerText()).includes('Your lifetime XP: 0'));
 for(const [name,account] of [['connor',connor],['izzy',izzy]]) {
  for(const width of [320,375,390,430]) {
   await account.page.setViewportSize({width,height:844});
   for(const large of [false,true]) {
    await account.page.evaluate(large=>{document.documentElement.style.fontSize=large?'32px':'';},large);
    const main=account.page.getByRole('main');
    assert.equal(await main.locator('header > p').last().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),large?32:16,'body copy scales with root text, not just headings');
    const connection=main.locator('details');
    if((await connection.getAttribute('open'))===null) await connection.locator('summary').click();
    assert.equal(await account.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no horizontal overflow');
    for(const action of await main.locator('button,a,summary,input:not([type=radio]):not([type=checkbox]),textarea,select').all()) {
     await action.scrollIntoViewIfNeeded();const r=await action.boundingBox();assert.ok(r&&r.width>=44&&r.height>=44&&r.x>=0&&r.x+r.width<=width+1,'44px target fits');
     assert.ok(await action.evaluate(el=>{const r=el.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return top===el||el.contains(top);}), 'control not obscured');
    }
    await connection.locator('summary').click();
    assert.equal(await connection.getAttribute('open'),null,'connected management can collapse to prioritize inbox');
    await account.page.evaluate(()=>scrollTo(0,0));await account.page.screenshot({path:`artifacts/companion/${width}-${name}-${large?'text200':'normal'}.png`,fullPage:true});
   }
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 console.log('PASS actual companion UI → synthetic test auth → actual PostgreSQL/RLS: invite/request/confirm, send, pre-accept payload secrecy, accept/reveal, double completion, Home personal completion + overlap upgrade, Home/More round-trip/reload, separate XP/shared status, HTML-as-text, four widths/200% root text. Not live Supabase Auth, hosted preview, native zoom or iPhone evidence.');
 await connor.context.close();await izzy.context.close();
} catch(error) {
 for(const [index,context] of browser.contexts().entries()) {
  const page=context.pages().at(-1); if(page) await page.screenshot({path:`artifacts/companion/failure-${index}.png`,fullPage:true}).catch(()=>{});
 }
 throw error;
} finally {await browser.close();}
