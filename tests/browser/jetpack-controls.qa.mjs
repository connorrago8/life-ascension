/** Local Chromium input regression; no account data or hosted requests. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {chromium} from 'playwright';
const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:3137');
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname));
assert.equal(base.protocol, 'http:');
const core = {};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/brainRot/core.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText, {exports: core, structuredClone});
let seed = 1;
while (core.currentGame(core.newRun(seed)) !== 'goblin-jetpack') seed++;
const browser = await chromium.launch({headless: true, chromiumSandbox: true,
  ...(process.env.CHROMIUM_BIN ? {executablePath: process.env.CHROMIUM_BIN} : {})});
try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({viewport: {width, height: 844}});
    const forbidden = [], errors = [];
    await context.route('**/*', route => {
      const r = route.request(), url = new URL(r.url());
      if (url.origin !== base.origin || !['GET', 'HEAD'].includes(r.method())) {
        forbidden.push(`${r.method()} ${url.origin}${url.pathname}`);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({key, run}) => localStorage.setItem(key, JSON.stringify(run)),
      {key: core.SAVE_KEY, run: core.newRun(seed)});
    const time = new Date('2026-11-04T18:00:00Z');
    await page.clock.install({time});
    await page.clock.pauseAt(time);
    await page.goto(new URL('/play/brain-rot', base).href);
    await page.getByRole('button', {name: 'Start Challenge', exact: true}).click();
    await page.getByText('Objective: Collect 35 sparks', {exact: true}).waitFor();
    const rocket = page.getByText('🚀', {exact: true});
    const altitude = () => rocket.evaluate(el => parseFloat(el.style.top));
    const start = await altitude();
    await page.keyboard.down('Space');
    await page.clock.runFor(300);
    const rising = await altitude();
    assert.ok(rising < start, 'Space must sustain thrust');
    await page.keyboard.press('a'); // Unrelated keyup must not cancel thrust.
    await page.clock.runFor(100);
    assert.ok(await altitude() < rising);
    await page.keyboard.up('Space');
    await page.clock.runFor(1000);
    assert.ok(await altitude() > rising, 'Space release must allow descent');
    await page.getByText('Pickups: 0/35 · Score: 0', {exact: true}).waitFor();
    await page.getByRole('button', {name: 'Pause & Save', exact: true}).click();
    // Space on the focused Resume button is a valid activation; test gameplay
    // input while focus is on the page instead.
    await page.evaluate(() => document.activeElement?.blur());
    const paused = await altitude();
    await page.keyboard.down('Space');
    await page.clock.runFor(300);
    await page.keyboard.up('Space');
    assert.equal(await altitude(), paused, 'paused keyboard input must not move the game');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.deepEqual(forbidden, []);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: Space thrust/release, unrelated key, paused input, pickup objective; zero external/write requests`);
    await context.close();
  }
} finally { await browser.close(); }
