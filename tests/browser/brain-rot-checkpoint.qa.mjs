/** Independent real-component checkpoint acceptance. No game/account writes. */
import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import {chromium} from 'playwright';
const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:3138');
assert.ok(['localhost', '127.0.0.1'].includes(base.hostname));
assert.equal(base.protocol, 'http:');
const core = {}, games = {};
const compile = path => ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText;
vm.runInNewContext(compile('lib/brainRot/core.ts'), {exports: core, structuredClone});
vm.runInNewContext(compile('lib/brainRot/games.ts'), {exports: games, require: () => core, structuredClone});
let browser;
before(async () => { browser = await chromium.launch({headless: true, chromiumSandbox: true,
  ...(process.env.CHROMIUM_BIN ? {executablePath: process.env.CHROMIUM_BIN} : {})}); });
after(async () => { await browser?.close(); });

async function pageWith(checkpoint) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  const forbidden = [], errors = [];
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base.origin || !['GET', 'HEAD'].includes(request.method())) {
      forbidden.push(`${request.method()} ${url.origin}${url.pathname}`);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({key, checkpoint}) => {
    // Deliberately only the complete atomic record, with no older split keys.
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(checkpoint));
  }, {key: core.CHECKPOINT_KEY, checkpoint});
  const time = new Date('2026-11-04T18:00:00Z');
  await page.clock.install({time});
  await page.clock.pauseAt(time);
  return {context, page, errors, forbidden};
}

test('valid checkpoint-only Rune resume retains the board shown before Resume', async () => {
  let seed = 1;
  while (core.currentGame(core.newRun(seed)) !== 'rune-fusion') seed++;
  const run = core.newRun(seed);
  let state = games.createGame('rune-fusion', 1, seed + 17);
  for (const input of ['left', 'up', 'right', 'down', 'left', 'up', 'right', 'down']) {
    state = games.step(state, input);
  }
  assert.equal(state.lost, false);
  assert.equal(state.won, false);
  const f = await pageWith({version: 1, revision: 1, run, active: {level: 1, state}});
  try {
    await f.page.goto(new URL('/play/brain-rot', base).href);
    const resume = f.page.getByRole('button', {name: 'Resume / Retry', exact: true});
    await resume.waitFor();
    const grid = () => f.page.evaluate(() => {
      const board = [...document.querySelectorAll('div')].find(el =>
        el.children.length === 16 && el.style.display === 'grid');
      return board ? [...board.children].map(el => Number(el.textContent || 0)) : null;
    });
    assert.deepEqual(await grid(), [...state.grid], 'checkpoint initially renders its saved board');
    await resume.click(); // Clock remains frozen: no legitimate game action can alter the board.
    const afterResume = await grid();
    console.log(JSON.stringify({case: 'checkpoint-only-resume', saved: [...state.grid], afterResume,
      savedTick: state.tick, frozenClock: true, errors: f.errors, forbidden: f.forbidden}));
    assert.deepEqual(f.errors, []);
    assert.deepEqual(f.forbidden, []);
    assert.deepEqual(afterResume, [...state.grid], 'Resume must not replace a valid atomic board with a fresh game');
  } finally { await f.context.close(); }
});

test('malformed atomic active state falls back without crashing the game page', async () => {
  const run = core.newRun(71);
  const f = await pageWith({version: 1, revision: 1, run,
    active: {level: 1, state: {id: core.currentGame(run)}}});
  try {
    await f.page.goto(new URL('/play/brain-rot', base).href);
    // Allow hydration's error boundary to report; this does not advance gameplay.
    await new Promise(resolve => setTimeout(resolve, 400));
    console.log(JSON.stringify({case: 'malformed-checkpoint', errors: f.errors, forbidden: f.forbidden}));
    assert.deepEqual(f.errors, [], 'malformed device state must not crash the renderer');
    assert.deepEqual(f.forbidden, []);
    await f.page.getByRole('button', {name: 'Start Challenge', exact: true}).waitFor({timeout: 5000});
  } finally { await f.context.close(); }
});
