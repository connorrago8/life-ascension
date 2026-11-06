import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const base='http://127.0.0.1:3148';
const ids={connor:'00000000-0000-0000-0000-00000000ce01',izzy:'00000000-0000-0000-0000-00000000ce02'};
function session(name){const user={id:ids[name],aud:'authenticated',role:'authenticated',email:name+'@fixture.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return{user,access_token:[b64({alg:'HS256',typ:'JWT'}),b64({sub:user.id,role:'authenticated',aud:'authenticated',exp:4102444800}),'fixture-not-a-real-signature'].join('.'),refresh_token:'fixture-not-a-real-refresh-token',expires_at:4102444800,expires_in:3600,token_type:'bearer'};}
if(process.getuid?.()===0)throw Error('Sandboxed non-root Chromium required');
await mkdir('artifacts/companion',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,chromiumSandbox:true});
const errors=[],forbidden=[],payloads=[],results=[];
async function account(name){
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session(name))).toString('base64url'),domain:'127.0.0.1',path:'/',sameSite:'Lax',httpOnly:false,secure:false}]);
 await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());const allowed=(u.origin===base&&['GET','HEAD'].includes(r.method()))||(u.origin==='http://127.0.0.1:54329'&&(r.method()==='OPTIONS'||(r.method()==='GET'&&u.pathname==='/auth/v1/user')||(r.method()==='POST'&&['/rest/v1/rpc/companion_command','/rest/v1/rpc/companion_activity'].includes(u.pathname))));if(!allowed){forbidden.push(r.method()+' '+u.pathname);return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 if(name==='connor')page.on('response',async response=>{if(response.url().includes('/rpc/companion_command'))payloads.push(await response.text());});
 await page.goto(base+'/companion');await page.getByRole('heading',{name:'Connection & consent',exact:true}).waitFor();return{context,page};
}
async function tabTo(page,target){
 await target.waitFor({state:'visible'});
 for(let step=0;step<160;step++){
  if(await target.evaluate(el=>el===document.activeElement)){
   const info=await target.evaluate(el=>{const e=el instanceof HTMLInputElement&&el.type==='checkbox'?el.closest('label'):el;const r=e.getBoundingClientRect(),f=el.getBoundingClientRect();const top=document.elementFromPoint(f.x+f.width/2,f.y+f.height/2);return{w:r.width,h:r.height,inView:f.x>=0&&f.right<=innerWidth+1,hit:top===e||e.contains(top)};});
   assert.ok(info.w>=44&&info.h>=44&&info.inView&&info.hit,'focused target must be usable and unobscured');return;
  }
  await page.keyboard.press('Tab');
 }
 throw Error('Keyboard could not reach '+await target.textContent());
}
async function enterText(page,target,value){await tabTo(page,target);await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type(value);}
async function activate(page,target,key='Enter'){await tabTo(page,target);await page.keyboard.press(key);}
try{
 const connor=await account('connor'),izzy=await account('izzy');
 for(const width of [320,375,390,430]){
  await connor.page.setViewportSize({width,height:844});await izzy.page.setViewportSize({width,height:844});
  const title='QA keyboard task '+width,secret='QA-HIDDEN-PROMISE-'+width;
  await enterText(izzy.page,izzy.page.getByLabel('What would you like them to do?'),title);
  await enterText(izzy.page,izzy.page.getByLabel('Real-world reward promise · optional'),secret);
  await activate(izzy.page,izzy.page.getByLabel('Mystery reward: show ??? until acceptance'),'Space');
  await activate(izzy.page,izzy.page.getByRole('button',{name:'Send to private inbox',exact:true}));
  await izzy.page.getByText('Quest delivered to the private inbox.',{exact:true}).waitFor();
  await activate(connor.page,connor.page.getByRole('button',{name:'Refresh shared status',exact:true}));
  const article=connor.page.locator('article').filter({has:connor.page.getByRole('heading',{name:title,exact:true})});
  await article.waitFor();assert.equal(await connor.page.getByText(secret,{exact:true}).count(),0);
  assert.ok(payloads.every(p=>!p.includes(secret)),'pending mystery promise absent from all recipient payloads');
  await activate(connor.page,article.getByRole('button',{name:'Decline',exact:true}));
  await connor.page.getByText('Quest declined. No XP was changed.',{exact:true}).waitFor();
  const after=await connor.page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement===document.body?'BODY':document.activeElement.textContent}));
  await connor.page.keyboard.press('Tab');
  const next=await connor.page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement.textContent,inSection:!!document.activeElement.closest('main section')}));
  const focusContinues=next.inSection;
  results.push({width,secretLeaked:false,focusAfterDecline:after,nextTab:next,focusContinues});
  assert.ok((await connor.page.locator('main').innerText()).includes('Your lifetime XP: 4'),'decline must not change earned XP');
  await connor.page.screenshot({path:`artifacts/companion/qa-keyboard-${width}.png`,fullPage:false});
 }
 // Existing active pair is fixture-only; revoke through actual keyboard controls.
 const summary=izzy.page.getByRole('main').locator('details > summary');
 if((await izzy.page.getByRole('main').locator('details').getAttribute('open'))===null)await activate(izzy.page,summary);
 await activate(izzy.page,izzy.page.getByRole('button',{name:'Revoke shared access',exact:true}));
 await activate(izzy.page,izzy.page.getByRole('button',{name:'Confirm revocation',exact:true}));
 await izzy.page.getByText('Shared access revoked. Earned XP was retained.',{exact:true}).waitFor();
 const since=payloads.length;
 await activate(connor.page,connor.page.getByRole('button',{name:'Refresh shared status',exact:true}));
 await connor.page.getByText('Connection ended. Your private history remains; new logging is paused.',{exact:true}).waitFor();
 assert.equal(await connor.page.getByRole('heading',{name:'QA keyboard task 430',exact:true}).count(),0);
 assert.ok(payloads.slice(since).every(p=>!p.includes('SECRET sunset picnic')&&!p.includes('QA-HIDDEN-PROMISE')),'revoked dashboard contains no shared reward');
 assert.ok((await connor.page.locator('main').innerText()).includes('Your lifetime XP: 4'));
 await connor.page.screenshot({path:'artifacts/companion/qa-keyboard-revoked.png',fullPage:true});
 await writeFile('artifacts/companion/qa-keyboard.json',JSON.stringify({evidence:'sandboxed Chromium + synthetic auth + actual PostgreSQL/RLS; not iPhone or live Auth',results,errors,forbidden},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 assert.ok(results.every(r=>r.focusContinues),'next Tab after decline must continue within page sections, not restart at global navigation');
 console.log('PASS keyboard Tab/typing/Space/Enter: mystery send→decline at four widths; consent revocation hides shared rewards and retains account XP. Synthetic authentication; not iPhone.');
}finally{await writeFile('artifacts/companion/qa-keyboard.json',JSON.stringify({results,errors,forbidden},null,2));await browser.close();}
