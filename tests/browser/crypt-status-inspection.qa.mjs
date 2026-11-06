/** Authored combat effects exercise read-only UI; no earned-account or device acceptance. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createDelve, reduceDelve } from '../../lib/crypt/delve/run.ts';
import { ZERO_ATTRIBUTES } from '../../lib/crypt/delve/stats.ts';
if (process.getuid?.() === 0) throw Error('Use a sandboxed non-root browser.');
const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:3148');
assert.equal(base.hostname, '127.0.0.1');
const key = 'la.crypt.activeRun.v1';
let fixture = createDelve({ runId: '12345678-abcd-1234-abcd-123456789012', seed: 12, level: 1, allocated: ZERO_ATTRIBUTES });
fixture = reduceDelve(fixture, { type: 'pick-start', cardId: fixture.startPick[0] });
fixture = reduceDelve(fixture, { type: 'choose-room', row: 0, index: 0 });
assert.equal(fixture.phase, 'combat');
Object.assign(fixture.battle.foe, { hp: 100, maxHp: 100, block: 5, weak: 2, burn: 3, bleed: 1, vulnerable: 2, strength: 2 });
Object.assign(fixture.battle, { block: 4, weak: 1, thorns: 2, retain: true, haste: 1, focused: true, critNext: true, dodgeNext: true, might: 2 });
await mkdir('artifacts/crypt-status', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN, chromiumSandbox: true });
try {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
    const errors = [], forbidden = [];
    await context.route('**/*', route => {
      const request = route.request();
      if (new URL(request.url()).origin !== base.origin || !['GET', 'HEAD'].includes(request.method())) {
        forbidden.push(request.method() + ' ' + request.url()); return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ key, fixture }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ v: 1, owner: 'guest', savedAt: Date.now(), state: fixture }));
    }, { key, fixture });
    await page.goto(new URL('/play/delve', base).href);
    const fight = page.getByRole('region', { name: /^Fight:/ }); await fight.waitFor();
    const snapshot = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).state, key);
    const before = await snapshot();
    const trigger = fight.getByRole('button', { name: /^Statuses/ });
    const panel = fight.getByRole('region', { name: 'Combat statuses', exact: true });
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'collapsed initial disclosure');
    for (const large of [false, true]) {
      await page.evaluate(large => { document.documentElement.style.fontSize = large ? '32px' : ''; }, large);
      await trigger.focus(); await page.keyboard.press('Enter'); await panel.waitFor();
      const target = await trigger.getAttribute('aria-controls');
      assert.ok(target && await panel.evaluate((el, id) => el.id === id, target), 'trigger controls existing panel');
      const enemy = panel.getByRole('group', { name: 'Enemy statuses', exact: true });
      const hero = panel.getByRole('group', { name: 'You statuses', exact: true });
      assert.equal(await enemy.getByRole('button').count(), 6);
      assert.equal(await hero.getByRole('button').count(), 10);
      await page.keyboard.press('Tab');
      const block = enemy.getByRole('button', { name: /^Enemy: Block 5\./ });
      assert.equal(await block.evaluate(el => document.activeElement === el && el.matches(':focus-visible')), true, 'real Tab reaches first effect');
      assert.notEqual(await block.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
      await page.keyboard.press('Enter');
      await enemy.getByRole('status').getByText('Enemy: Block 5', { exact: true }).waitFor();
      const burn = enemy.getByRole('button', { name: /^Enemy: Burn 3\./ });
      await burn.click();
      assert.equal(await block.getAttribute('aria-expanded'), 'false', 'one explanation at a time');
      assert.equal(await burn.getAttribute('aria-expanded'), 'true');
      const help = await burn.getAttribute('aria-controls');
      assert.ok(help && await enemy.getByRole('status').evaluate((el, id) => el.id === id, help));
      await enemy.getByRole('status').getByText('Burn: takes Burn damage at the start of its turn, then Burn −1. (INT)', { exact: true }).waitFor();
      for (const text of await panel.locator('p,strong,span').all()) assert.ok(await text.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'effect text not clipped');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      for (const action of await panel.getByRole('button').all()) {
        await action.scrollIntoViewIfNeeded();
        const r = await action.boundingBox();
        assert.ok(r && r.width >= 44 && r.height >= 44 && r.x >= 0 && r.x + r.width <= width + 1, '44px target fits');
        assert.ok(await action.evaluate(el => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === el; }), 'touch center not covered');
        assert.equal(await action.evaluate(el => getComputedStyle(el).animationName), 'none');
      }
      await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
      await page.screenshot({ path: `artifacts/crypt-status/${width}-${large ? 'text200' : 'normal'}.png`, fullPage: true });
      await burn.focus(); await page.keyboard.press('Escape');
      assert.equal(await panel.count(), 0);
      assert.equal(await trigger.evaluate(el => document.activeElement === el), true, 'Escape returns focus');
      assert.ok(await trigger.evaluate(el => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === el; }), 'returned keyboard focus is visible');
      await page.keyboard.press('Enter'); await panel.waitFor();
      assert.equal(await panel.getByRole('status').count(), 0, 'reopening clears old explanation');
      await panel.getByRole('button', { name: 'Hide statuses', exact: true }).click();
      assert.equal(await trigger.evaluate(el => document.activeElement === el), true, 'touch Hide returns focus');
      assert.ok(await trigger.evaluate(el => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === el; }), 'returned touch focus is visible');
      assert.deepEqual(await snapshot(), before, 'inspection does not change HP, energy, deck, RNG, effects or run');
    }
    await fight.getByRole('button', { name: 'End turn', exact: true }).click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).state.battle?.turn === 2, key);
    const next = await snapshot();
    assert.deepEqual(next, reduceDelve(before, { type: 'end-turn' }), 'turn and status timing stay engine-equivalent');
    await trigger.click(); await panel.waitFor();
    await panel.getByRole('button', { name: new RegExp(`^Enemy: Burn ${next.battle.foe.burn}\\.`) }).waitFor();
    // Empty enemy effects are an explicit display fixture, not a claim that the turn removed them.
    const empty = structuredClone(next);
    for (const field of ['block', 'weak', 'burn', 'bleed', 'vulnerable', 'strength']) empty.battle.foe[field] = 0;
    await page.evaluate(({ key, empty }) => localStorage.setItem(key, JSON.stringify({ v: 1, owner: 'guest', savedAt: Date.now(), state: empty })), { key, empty });
    await page.reload(); await fight.waitFor(); await trigger.click(); await panel.waitFor();
    const emptyEnemy = panel.getByRole('group', { name: 'Enemy statuses', exact: true });
    await emptyEnemy.getByText('No active effects.', { exact: true }).waitFor();
    assert.equal(await emptyEnemy.getByRole('button').count(), 0);
    if (width === 390) {
      await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: 'artifacts/crypt-status/390-empty-text200.png', fullPage: true });
    }
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    console.log(`PASS Crypt statuses ${width}px: normal/200% root text, owner groups, single effect help, real Tab/Enter/Escape, 44px unobscured targets, reduced motion, empty display, read-only checkpoint and engine-equivalent next turn; errors[]/forbidden[]`);
    await context.close();
  }
} finally { await browser.close(); }
