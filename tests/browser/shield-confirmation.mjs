// Real component in Chromium; RPC responses are isolated fixtures, never hosted Supabase.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const bundle = await build({
  stdin: {contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {StreakShieldNote} from './components/couple/StreakShieldNote'; createRoot(document.getElementById('root')).render(<StreakShieldNote/>);`, resolveDir: process.cwd(), loader: 'tsx'},
  bundle: true, write: false, format: 'iife', jsx: 'automatic', loader: {'.css':'empty'},
  define: {'process.env.NODE_ENV':'"production"'},
  plugins: [{name:'isolated-rpc',setup(b){b.onLoad({filter:/[/\\]lib[/\\]supabase\.ts$/},()=>({contents:'export function supabase(){return {rpc:(...args)=>window.shieldRpc(...args)}}',loader:'js'}));}}],
});
const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  async function mount(mode='ready') {
    await page.goto('about:blank');
    await page.setContent('<div id="root"></div>');
    await page.evaluate(mode => {
      window.spends = 0;
      window.shieldRpc = async name => {
        if(name === 'get_streak_shield') return {data:{status:mode==='used'?'used':'ready',notice:'Streak Shield ready · 1 this month',eligibleMissedDay:mode==='invalid'?'bad-date':'2026-11-10'},error:null};
        window.spends++;
        await new Promise(resolve=>setTimeout(resolve,80));
        if(mode==='offline') throw new Error('simulated transport loss');
        if(mode==='error') return {data:null,error:{message:'ambiguous result'}};
        return {data:{status:'used',notice:'Streak Shield used · 0 remaining'},error:null};
      };
    },mode);
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.getByRole('status').waitFor();
  }
  await mount();
  assert.equal(await page.evaluate(()=>window.spends),0);
  await page.getByRole('button',{name:'Review Streak Shield',exact:true}).click();
  await page.getByRole('button',{name:'Not Now',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.spends),0);
  await page.getByRole('button',{name:'Review Streak Shield',exact:true}).click();
  await page.getByRole('button',{name:'Use Shield',exact:true}).evaluate(button=>{button.click();button.click();});
  await page.getByText('Streak Shield used · 0 remaining',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.spends),1);
  for(const mode of ['offline','error']) {
    await mount(mode);
    await page.getByRole('button',{name:'Review Streak Shield',exact:true}).click();
    await page.getByRole('button',{name:'Use Shield',exact:true}).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('button',{name:'Use Shield',exact:true}).isDisabled(),true);
    assert.equal(await page.evaluate(()=>window.spends),1);
  }
  for(const mode of ['invalid','used']) {
    await mount(mode);
    assert.equal(await page.getByRole('button',{name:'Review Streak Shield',exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>window.spends),0);
  }
  console.log('PASS Chromium: read-only mount, valid candidate, cancel, explicit confirmation, duplicate taps, ambiguous retry lock, invalid/used states');
} finally { await browser.close(); }
