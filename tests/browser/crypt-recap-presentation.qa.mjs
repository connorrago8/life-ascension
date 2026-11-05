/** Display fixtures only; does not certify a natural victory or account save. */
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
if(process.getuid?.()===0)throw Error('Non-root sandboxed browser required');
const base=new URL(process.env.QA_BASE_URL||'http://127.0.0.1:3148');assert.equal(base.hostname,'127.0.0.1');
await mkdir('artifacts/crypt-recap',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,chromiumSandbox:true});
try{
 for(const width of [320,375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,reducedMotion:'reduce'}),errors=[],forbidden=[];
  await context.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin!==base.origin||!['GET','HEAD'].includes(r.method())){forbidden.push(r.method()+' '+r.url());return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const view of ['victory','defeat']){
   await page.goto(new URL(`/qa/crypt-recap?view=${view}&mode=preview`,base).href);
   await page.getByRole('heading',{name:view==='victory'?'Floor 1 Conquered':'The Road Continues',exact:true}).waitFor();
   const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
   const recap=page.locator('.recap');
   await recap.getByText('Preview: this run isn’t saved to your account.',{exact:true}).waitFor();
   for(const large of [false,true]){
    if(large)await page.evaluate(()=>{document.documentElement.style.fontSize='32px';});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no horizontal overflow');
    for(const element of await recap.locator('h2,p,dd').all())assert.ok(await element.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'text is not clipped');
    for(const action of await recap.locator('.recap-actions .btn').all()){
     await action.scrollIntoViewIfNeeded();const r=await action.boundingBox();assert.ok(r&&r.width>=44&&r.height>=44&&r.x>=0&&r.x+r.width<=width+1,'reachable 44px action');
     assert.ok(await action.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button,a')===el;}),'not obscured by navigation');
    }
    assert.equal(await recap.locator('.recap-title').evaluate(el=>getComputedStyle(el).animationName),'none');
    if(view==='victory'){
     await recap.getByText("Warden's Glaive",{exact:true}).waitFor();
     const glyph=recap.locator('svg.recap-gear-glyph');assert.equal(await glyph.getAttribute('aria-hidden'),'true');assert.equal(await glyph.getAttribute('focusable'),'false');
     assert.equal(await recap.locator('.recap-reward').evaluate(el=>getComputedStyle(el).animationName),'none');
     for(const selector of ['.recap-reward-label','.recap-reward-name','.recap-reward-status']){
      const ratio=await recap.locator(selector).evaluate(el=>{
       const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
       const text=luminance(getComputedStyle(el).color),background=luminance(getComputedStyle(el.closest('.recap-reward')).backgroundColor);return(Math.max(text,background)+.05)/(Math.min(text,background)+.05);
      });assert.ok(ratio>=4.5,`reward text contrast ${selector}: ${ratio}`);
     }
    }else assert.equal(await recap.locator('.recap-reward-art').count(),0,'defeat has no boss reward emblem');
    const primary=recap.getByRole('button',{name:'Continue to camp',exact:true});await primary.focus();assert.notEqual(await primary.evaluate(el=>getComputedStyle(el).outlineStyle),'none');await page.keyboard.press('Tab');assert.ok(await recap.getByRole('link',{name:'Leave the Crypt',exact:true}).evaluate(el=>el===document.activeElement));
    await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});
    const bytes=await page.screenshot({path:`artifacts/crypt-recap/${width}-${view}-${large?'text200':'normal'}.png`,fullPage:true});
    if(width===390)console.log(`RECAP_RENDER_390_${view}_${large?'TEXT200':'NORMAL'}_PNG=`+bytes.toString('base64'));
    assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),before,'display/focus never changes persistence');
   }
  }
  if(width===390){
   await page.goto(new URL('/qa/crypt-recap?mode=vault&pending=1',base).href);await page.getByText('Saving to your vault…',{exact:true}).waitFor();assert.equal(await page.getByText('Saved to your vault',{exact:true}).count(),0);
   for(const reward of ['hollow-crown','warden-mantle','warden-aegis']){await page.goto(new URL('/qa/crypt-recap?mode=visit&reward='+reward,base).href);await page.locator('.recap-gear-glyph').waitFor();await page.screenshot({path:`artifacts/crypt-recap/390-${reward}.png`,fullPage:true});}
  }
  assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);console.log(`PASS recap ${width}px: victory/defeat, normal/200% root text, 44px unobscured actions, keyboard order/focus, reduced motion, read-only display; errors[]/forbidden[]`);await context.close();
 }
}finally{await browser.close();}
