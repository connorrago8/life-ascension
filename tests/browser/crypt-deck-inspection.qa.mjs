import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createDelve, reduceDelve } from '../../lib/crypt/delve/run.ts';
import { ZERO_ATTRIBUTES } from '../../lib/crypt/delve/stats.ts';
if (process.getuid?.() === 0) throw Error('Use a sandboxed non-root browser.');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3148';
assert.equal(new URL(base).hostname, '127.0.0.1');
const origin = new URL(base).origin, key = 'la.crypt.activeRun.v1';
const initial = createDelve({ runId: '12345678-abcd-1234-abcd-123456789012', seed: 12, level: 1, allocated: ZERO_ATTRIBUTES, deckSelect: true });
let combat = reduceDelve(initial, { type: 'pick-deck', deckId: 'bruiser' });
combat = reduceDelve(combat, { type: 'pick-start', cardId: combat.startPick[0] });
combat = reduceDelve(combat, { type: 'choose-room', row: 0, index: 0 });
assert.equal(combat.phase, 'combat');
// Authored near-victory fixture goes through the actual reducer to create reward state.
const near = { ...combat, battle: { ...combat.battle, foe: { ...combat.battle.foe, hp: 1 } } };
const reward = reduceDelve(near, { type: 'play', uid: near.battle.hand[0].uid });
assert.equal(reward.phase, 'reward');
await mkdir('artifacts/crypt-inspection', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN, chromiumSandbox: true });
try {
  for (const width of [320, 375, 390, 430]) {
    for (const [label, state, names] of [
      ['combat', combat, [/^Draw pile:/, /^Discard pile:/, /^Exhaust pile:/]],
      ['starter', initial, [/^View the Bruiser deck's cards$/]],
      ['reward', reward, [/^View deck$/]],
    ]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
      const errors = [], forbidden = [];
      await context.route('**/*', route => {
        const r = route.request();
        if (new URL(r.url()).origin !== origin || !['GET', 'HEAD'].includes(r.method())) { forbidden.push(`${r.method()} ${r.url()}`); return route.abort(); }
        return route.continue();
      });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(({ key, state }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ v: 1, owner: 'guest', savedAt: Date.now(), state }));
      }, { key, state });
      await page.goto(base + '/play/delve');
      await page.getByRole('button', { name: names[0] }).waitFor();
      const before = await page.evaluate(key => localStorage.getItem(key), key);
      const overflow = await page.evaluate(() => document.body.style.overflow);
      for (const enlarged of [false, true]) {
        await page.evaluate(enlarged => { document.documentElement.style.fontSize = enlarged ? '32px' : ''; }, enlarged);
        for (const name of names) {
          const trigger = page.getByRole('button', { name });
          await trigger.focus(); await page.keyboard.press('Enter');
          const dialog = page.getByRole('dialog'); await dialog.waitFor();
          const close = dialog.getByRole('button', { name: 'Close', exact: true });
          assert.equal(await dialog.evaluate(el => el.matches(':modal')), true, 'native modal top layer');
          assert.ok(await dialog.getAttribute('aria-labelledby')); assert.ok(await dialog.getAttribute('aria-describedby'));
          assert.equal(await close.evaluate(el => document.activeElement === el), true, 'focus enters Close');
          for (const keypress of ['Tab', 'Tab', 'Shift+Tab']) {
            await page.keyboard.press(keypress);
            assert.equal(await close.evaluate(el => document.activeElement === el), true, 'focus stays inside inspection');
          }
          await trigger.evaluate(el => el.focus());
          assert.equal(await close.evaluate(el => document.activeElement === el), true, 'background trigger is inert');
          assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
          const rect = await close.boundingBox();
          assert.ok(rect && rect.width >= 44 && rect.height >= 44 && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width + 1 && rect.y + rect.height <= 845, 'Close target remains visible');
          assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'dialog fits horizontally');
          assert.equal(await dialog.evaluate(el => getComputedStyle(el).animationName), 'none');
          for (const item of await dialog.locator('.delve-pile-main').all()) assert.equal(await item.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'card text wraps');
          const list = dialog.getByRole('list');
          if (await list.count()) {
            await list.evaluate(el => { el.parentElement.scrollTop = el.parentElement.scrollHeight; });
            assert.equal(Math.round((await close.boundingBox()).y), Math.round(rect.y), 'Close stays visible while card content scrolls');
            await list.evaluate(el => { el.parentElement.scrollTop = 0; });
          }
          if (label === 'combat' && name.source.startsWith('^Draw')) {
            await dialog.getByText('Sorted by cost, then name. Not the order you will draw.', { exact: true }).waitFor();
            const bytes = await page.screenshot({ path: `artifacts/crypt-inspection/${width}-${enlarged ? 'text200' : 'normal'}.png` });
            if (width === 390) console.log(`CRYPT_INSPECTION_390_${enlarged ? 'TEXT200' : 'NORMAL'}_PNG=` + bytes.toString('base64'));
          }
          await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
          assert.equal(await trigger.evaluate(el => document.activeElement === el), true, 'Escape restores exact opener');
          assert.equal(await page.evaluate(() => document.body.style.overflow), overflow, 'body scroll restored');
          await trigger.click(); await dialog.waitFor(); await close.click(); await dialog.waitFor({ state: 'detached' });
          assert.equal(await trigger.evaluate(el => document.activeElement === el), true, 'Close restores opener');
        }
      }
      // Backdrop dismissal must not activate a page navigation behind the modal.
      const trigger = page.getByRole('button', { name: names[0] });
      await trigger.click(); const dialog = page.getByRole('dialog'); await dialog.waitFor();
      await page.mouse.click(2, 2); await dialog.waitFor({ state: 'detached' });
      assert.equal(await trigger.evaluate(el => document.activeElement === el), true);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before, 'inspection never rewrites the run');
      assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
      console.log(`PASS inspection ${label} ${width}px normal/200%roottext: modal, focus containment/restoration, inert background, 44px Close, scroll, Escape/Close/backdrop, unchanged raw save, no external/write requests`);
      await context.close();
    }
  }
} finally { await browser.close(); }
