import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createDelve, reduceDelve } from '../../lib/crypt/delve/run.ts';
import { ZERO_ATTRIBUTES } from '../../lib/crypt/delve/stats.ts';

if (process.getuid?.() === 0) throw Error('Use a sandboxed non-root browser.');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3148';
assert.equal(new URL(base).hostname, '127.0.0.1');
const origin = new URL(base).origin;
const key = 'la.crypt.activeRun.v1';
let fixture = createDelve({ runId: '12345678-abcd-1234-abcd-123456789012', seed: 12, level: 1, allocated: ZERO_ATTRIBUTES });
fixture = reduceDelve(fixture, { type: 'pick-start', cardId: fixture.startPick[0] });
fixture = reduceDelve(fixture, { type: 'choose-room', row: 0, index: 0 });
assert.equal(fixture.phase, 'combat');
assert.equal(fixture.battle.hand.length, 5);
await mkdir('artifacts/crypt', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN, chromiumSandbox: true });
try {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
    const errors = [], forbidden = [];
    await context.route('**/*', route => {
      const r = route.request();
      if (new URL(r.url()).origin !== origin || !['GET', 'HEAD'].includes(r.method())) {
        forbidden.push(`${r.method()} ${r.url()}`); return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ key, fixture }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ v: 1, owner: 'guest', savedAt: Date.now(), state: fixture }));
    }, { key, fixture });
    await page.goto(`${base}/play/delve`);
    const fight = page.getByRole('region', { name: /^Fight:/ });
    await fight.waitFor();
    const snapshot = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).state, key);
    const before = await snapshot();
    const hand = fight.getByRole('group', { name: 'Your hand', exact: true });
    async function check(enlarged) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'no horizontal overflow');
      await fight.getByText('Energy 3', { exact: true }).waitFor();
      assert.equal(await hand.locator('button').count(), 5);
      const columns = await hand.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.ok(enlarged ? columns === 1 : columns >= 2, 'hand adapts to text size');
      const controls = fight.locator('.delve-card, .delve-pile-btn, .delve-status-pill, .delve-end-turn');
      for (const control of await controls.all()) {
        const rect = await control.boundingBox();
        assert.ok(rect && rect.width >= 44 && rect.height >= 44 && rect.x >= 0 && rect.x + rect.width <= width + 1, '44px target fits viewport');
        assert.equal(await control.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'control text not clipped');
        await control.scrollIntoViewIfNeeded();
        assert.equal(await control.evaluate(el => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === el; }), true, 'control reachable without overlay');
      }
      const end = fight.getByRole('button', { name: 'End turn', exact: true });
      await end.focus();
      assert.equal(await end.evaluate(el => document.activeElement === el), true);
      assert.equal(await fight.locator('.delve-card').first().evaluate(el => getComputedStyle(el).animationName), 'none');
      await page.evaluate(() => scrollTo(0, 0));
      const bytes = await page.screenshot({ path: `artifacts/crypt/${width}-${enlarged ? 'text200' : 'normal'}.png`, fullPage: true });
      if (width === 390) console.log(`CRYPT_RENDER_390_${enlarged ? 'TEXT200' : 'NORMAL'}_PNG=` + bytes.toString('base64'));
    }
    await check(false);
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    await check(true);
    assert.deepEqual(await snapshot(), before, 'presentation and focus do not mutate progress');
    const draw = fight.getByRole('button', { name: /^Draw pile:/ });
    await draw.click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    assert.deepEqual(await snapshot(), before, 'inspection does not spend energy or alter piles');
    await fight.getByRole('button', { name: 'End turn', exact: true }).click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).state.battle.turn === 2, key);
    const next = await snapshot();
    assert.deepEqual(next, reduceDelve(before, { type: 'end-turn' }), 'actual End turn matches unchanged pure engine');
    await fight.getByText(`Energy ${next.battle.energy}`, { exact: true }).waitFor();
    // Display fixtures explicitly exercise zero and overflow without asserting either is naturally earned.
    for (const energy of [0, 7]) {
      await page.evaluate(({ key, next, energy }) => localStorage.setItem(key, JSON.stringify({ v: 1, owner: 'guest', savedAt: Date.now(), state: { ...next, battle: { ...next.battle, energy } } })), { key, next, energy });
      await page.reload();
      await fight.getByText(`Energy ${energy}`, { exact: true }).waitFor();
      assert.equal((await snapshot()).battle.energy, energy);
    }
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    console.log(`PASS Crypt ${width}px: five cards, numeric energy, zero/overflow display fixtures, normal/200% root text, 44px controls, reachable End turn, reduced motion, read-only inspection, engine-equivalent turn, no external/write requests`);
    await context.close();
  }
} finally { await browser.close(); }
