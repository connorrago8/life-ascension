import {checkpointSaveBarrier} from './brain-rot-save-barrier.mjs';
/** Real-component, local-only route-exit persistence checks; no account fixture. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {chromium} from 'playwright';

const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:3136');
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname), 'local QA only');
assert.equal(base.protocol, 'http:');
const core = {};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/brainRot/core.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText, {exports: core, structuredClone});
let seed = 1;
while (core.currentGame(core.newRun(seed)) !== 'rune-fusion') seed++;
const run = core.newRun(seed); // Rune idle is safe; this test awards no progress.
const browser = await chromium.launch({headless: true, chromiumSandbox: true,
  ...(process.env.CHROMIUM_BIN ? {executablePath: process.env.CHROMIUM_BIN} : {})});
try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({viewport: {width, height: 844}});
    const page = await context.newPage();
    const unexpected = [];
    const errors = [];
    await context.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== base.origin || !['GET', 'HEAD'].includes(request.method())) {
        unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
        return route.abort();
      }
      return route.continue();
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({key, run}) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(run));
    }, {key: core.SAVE_KEY, run});
    const time = new Date('2026-11-04T18:00:00Z');
    await page.clock.install({time});
    await page.clock.pauseAt(time);
    await page.goto(new URL('/play/brain-rot', base).href);
    await page.getByRole('button', {name: 'Start Challenge', exact: true}).click();
    await page.clock.runFor(250); // Exit before the 60-frame periodic checkpoint.
    await page.getByRole('link', {name: '← Back to Hub', exact: true}).click();
    await page.getByRole('heading', {name: 'Hub', exact: true}).waitFor();
    await checkpointSaveBarrier(page);
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), core.CHECKPOINT_KEY);
    assert.ok(saved?.active?.state.tick > 0 && saved.active.state.tick < 60,
      'route exit must save the latest sub-second state');
    assert.equal(saved.run.level, 1);
    assert.equal(saved.run.hearts, 3);
    assert.equal(saved.active.state.progress, 0);
    await page.getByRole('link', {name: 'Enter Brain Rot', exact: true}).click();
    await page.getByRole('button', {name: 'Resume / Retry', exact: true}).waitFor();
    await page.reload();
    const resume = page.getByRole('button', {name: 'Resume / Retry', exact: true});
    await resume.waitFor();
    await page.clock.runFor(250);
    const paused = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), core.CHECKPOINT_KEY);
    assert.equal(paused.active.state.tick, saved.active.state.tick, 'reload must remain paused');
    await resume.click();
    await page.clock.runFor(250);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await resume.waitFor();
    await checkpointSaveBarrier(page);
    const hidden = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), core.CHECKPOINT_KEY);
    assert.ok(hidden.active.state.tick > paused.active.state.tick);
    assert.equal(hidden.run.level, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, [], 'no account writes or external requests');
    console.log(`PASS ${width}px: route exit, Hub return, paused reload, synthetic pagehide; zero external/write requests`);
    await context.close();
  }
} finally { await browser.close(); }
