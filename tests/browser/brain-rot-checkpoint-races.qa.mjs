import {checkpointSaveBarrier} from './brain-rot-save-barrier.mjs';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { chromium } from 'playwright';
if (process.getuid?.() === 0) throw Error('Non-root sandboxed browser required.');
const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:3148');
assert.equal(base.hostname, '127.0.0.1');
const core = {}, games = {};
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(compile('lib/brainRot/core.ts'), { exports: core, structuredClone });
vm.runInNewContext(compile('lib/brainRot/games.ts'), { exports: games, require: () => core, structuredClone });
let browser;
before(async () => { browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN, chromiumSandbox: true }); });
after(async () => { await browser?.close(); });

function fixture(id) {
  const run = core.newRun(93), index = run.order.slice(0, 10).indexOf(id);
  [run.order[0], run.order[index]] = [run.order[index], run.order[0]];
  const state = games.createGame(id, 1, 123);
  if (id === 'rune-fusion') {
    state.grid = [64, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    state.progress = 64; state.score = 128;
  } else { state.player.y = .939; state.player.vy = .012; }
  assert.equal(core.validRun(run), true);
  assert.equal(core.validGameState(state), true);
  return { version: 1, revision: 1, run, active: { level: 1, state } };
}
async function session(checkpoint) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // Playwright clocks belong to the context and are shared by all its pages.
  const time = new Date('2026-11-05T09:30:00Z');
  await context.clock.install({ time }); await context.clock.pauseAt(time);
  const errors = [], forbidden = [];
  await context.route('**/*', route => {
    const r = route.request();
    if (new URL(r.url()).origin !== base.origin || !['GET', 'HEAD'].includes(r.method())) {
      forbidden.push(`${r.method()} ${r.url()}`); return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(({ key, checkpoint, origin }) => {
    if (location.origin !== origin) return;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(checkpoint));
  }, { key: core.CHECKPOINT_KEY, checkpoint, origin: base.origin });
  async function page() {
    const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(new URL('/play/brain-rot', base).href);
    await p.getByRole('heading', { name: 'Brain Rot', exact: false }).waitFor();
    await p.getByText(/^❤️\s*[123]$/u).waitFor();
    // A rendered checkpoint-derived level distinguishes hydration from the SSR defaults.
    await p.getByText(`Level ${JSON.parse(await p.evaluate(key => localStorage.getItem(key), core.CHECKPOINT_KEY)).run.level}/31`, { exact: true }).waitFor();
    return p;
  }
  const read = async p => {await checkpointSaveBarrier(p);return p.evaluate(key => JSON.parse(localStorage.getItem(key)), core.CHECKPOINT_KEY);};
  return { context, page, read, errors, forbidden };
}
async function completeRune(page) {
  await page.getByRole('button', { name: 'Resume / Retry', exact: true }).click();await checkpointSaveBarrier(page);
  await page.keyboard.down('ArrowLeft'); await page.clock.runFor(18); await page.keyboard.up('ArrowLeft');
  await page.getByText('Level 2/31', { exact: true }).waitFor();
}

test('a stale paused tab cannot roll back a level unlocked in another tab', async () => {
  const s = await session(fixture('rune-fusion'));
  try {
    const a = await s.page(), stale = await s.page();
    await stale.getByRole('button', { name: 'Resume / Retry', exact: true }).waitFor();
    await completeRune(a);
    const before = await s.read(a); assert.equal(before.run.level, 2);
    // The second tab never plays: ordinary lifecycle persistence is sufficient.
    await stale.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const after = await s.read(a), recovered = await s.page();
    const restored = Number((await recovered.locator('main').innerText()).match(/Level (\d+)\/31/)[1]);
    console.log(JSON.stringify({ case: 'stale-tab-level-rollback', beforeLevel: before.run.level, afterLevel: after.run.level, restoredLevel: restored, beforeRevision: before.revision, afterRevision: after.revision, errors: s.errors, forbidden: s.forbidden }));
    assert.deepEqual(s.errors, []); assert.deepEqual(s.forbidden, []);
    assert.equal(after.run.level, 2, 'a later revision must not restore a stale earlier level');
    assert.equal(restored, 2);
  } finally { await s.context.close(); }
});

test('a stale paused tab cannot resurrect a heart spent by another tab', async () => {
  const s = await session(fixture('flappy-wyvern'));
  try {
    const a = await s.page(), stale = await s.page();
    await stale.getByRole('button', { name: 'Resume / Retry', exact: true }).waitFor();
    await a.getByRole('button', { name: 'Resume / Retry', exact: true }).click();await checkpointSaveBarrier(a);
    await a.clock.runFor(18);
    const before = await s.read(a); assert.equal(before.run.hearts, 2);
    await stale.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const after = await s.read(a), recovered = await s.page();
    const restored = Number((await recovered.locator('main').innerText()).match(/❤️\s*(\d+)/u)[1]);
    console.log(JSON.stringify({ case: 'stale-tab-heart-rollback', beforeHearts: before.run.hearts, afterHearts: after.run.hearts, restoredHearts: restored, beforeRevision: before.revision, afterRevision: after.revision, errors: s.errors, forbidden: s.forbidden }));
    assert.deepEqual(s.errors, []); assert.deepEqual(s.forbidden, []);
    assert.equal(after.run.hearts, 2, 'stale lifecycle save must not undo an accepted loss');
    assert.equal(restored, 2);
  } finally { await s.context.close(); }
});

test('a fresh inactive tab reads the unlocked level and pagehide leaves its checkpoint unchanged', async () => {
  const s = await session(fixture('rune-fusion'));
  try {
    const a = await s.page(); await completeRune(a);
    const before = await s.read(a); assert.equal(before.run.level, 2);
    const fresh = await s.page();
    await fresh.getByText('Level 2/31', { exact: true }).waitFor();
    await fresh.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    assert.deepEqual(await s.read(a), before);
    assert.deepEqual(s.errors, []); assert.deepEqual(s.forbidden, []);
    console.log(JSON.stringify({ case: 'fresh-tab-control', level: before.run.level, revision: before.revision, unchanged: true }));
  } finally { await s.context.close(); }
});
