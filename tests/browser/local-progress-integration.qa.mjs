/** Combined Jetpack lifecycle and Lantern storage isolation; localhost only. */
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
while (core.currentGame(core.newRun(seed)) !== 'goblin-jetpack') seed++;
const run = core.newRun(seed); // Seed a new Jetpack run; no reward is claimed.
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
    await page.keyboard.down('Space');
    await page.clock.runFor(250);
    await page.getByRole('link', {name: '← Back to Hub', exact: true}).click();
    await page.keyboard.up('Space');
    await page.getByRole('heading', {name: 'Hub', exact: true}).waitFor();
    const checkpoint = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), core.CHECKPOINT_KEY);
    const saved = await checkpoint();
    assert.equal(saved.active.state.id, 'goblin-jetpack');
    assert.ok(saved.active.state.tick > 0 && saved.active.state.tick < 60);
    assert.ok(saved.active.state.player.y < .5, 'held Space was applied before route exit');
    assert.equal(saved.run.hearts, 3);
    await page.getByRole('link', {name: 'Visit Emberhaven town →', exact: true}).click();
    await page.getByRole('button', {name: 'Begin the Lantern Route', exact: true}).click();
    await page.getByRole('link', {name: 'Visit Hearth', exact: true}).click();
    await page.getByRole('button', {name: 'Talk to Hearth keeper', exact: true}).click();
    await page.getByRole('button', {name: 'Ask about the Lantern Route', exact: true}).click();
    await page.getByRole('link', {name: '← Back to Town', exact: true}).click();
    await page.getByRole('link', {name: '← Back to Hub', exact: true}).click();
    await page.getByRole('heading', {name: 'Hub', exact: true}).waitFor();
    assert.deepEqual(await checkpoint(), saved, 'Town choices must not rewrite Brain Rot checkpoint');
    const lanternKey = 'life-ascension:lantern-route:v1';
    const lantern = await page.evaluate(key => localStorage.getItem(key), lanternKey);
    assert.deepEqual(JSON.parse(lantern).clues, ['hearth']);
    await page.getByRole('link', {name: 'Enter Brain Rot', exact: true}).click();
    await page.getByRole('button', {name: 'Resume / Retry', exact: true}).waitFor();
    const rocket = page.getByText('🚀', {exact: true});
    const y = await rocket.evaluate(el => parseFloat(el.style.top));
    assert.ok(Math.abs(y - saved.active.state.player.y * 100) < .001, 'Jetpack loads its saved position');
    await page.clock.runFor(1000);
    assert.equal(await rocket.evaluate(el => parseFloat(el.style.top)), y, 'Hub/Town return remains paused');
    await page.reload();
    await page.getByRole('button', {name: 'Resume / Retry', exact: true}).waitFor();
    assert.equal(await rocket.evaluate(el => parseFloat(el.style.top)), y);
    assert.deepEqual((await checkpoint()).active.state, saved.active.state);
    assert.equal((await checkpoint()).run.hearts, saved.run.hearts);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), lanternKey), lantern, 'Brain Rot reload must not rewrite Lantern progress');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, [], 'no account writes or external requests');
    console.log(`PASS ${width}px: held Jetpack thrust→Hub→Town clue→Hub→Jetpack paused reload; both saves preserved; zero external/write requests`);
    await context.close();
  }
} finally { await browser.close(); }
