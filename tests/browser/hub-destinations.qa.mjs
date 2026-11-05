import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
if (process.getuid?.() === 0) throw new Error('Use a sandboxed non-root browser.');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3142';
const origin = new URL(base).origin;
assert.equal(new URL(base).hostname, '127.0.0.1');
await mkdir('artifacts/hub', { recursive: true });
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
    await page.addInitScript(() => {
      const key = 'life-ascension:lantern-route:v1';
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ started: true, clues: ['hearth'], placed: [], solved: false, kept: false }));
    });
    await page.goto(`${base}/play?preview=1`);
    const lantern = await page.evaluate(() => localStorage.getItem('life-ascension:lantern-route:v1'));
    const group = page.getByRole('group', { name: 'Adventure destinations', exact: true });
    await group.waitFor();
    const town = group.getByRole('button', { name: 'Town, open Emberhaven', exact: true });
    const crypt = group.getByRole('button', { name: 'Open Forgotten Crypt preview', exact: true });
    const locked = group.getByRole('button', { name: 'Whispering Woods, Locked', exact: true });
    assert.equal(await town.getAttribute('aria-pressed'), null, 'direct navigation is not toggle selection');
    assert.equal(await crypt.getAttribute('aria-pressed'), null);
    assert.equal(await page.locator('.adv-web').isVisible(), false);
    for (const control of [town, crypt, locked]) {
      const rect = await control.boundingBox();
      assert.ok(rect && rect.width >= 44 && rect.height >= 44 && rect.x >= 0 && rect.x + rect.width <= width + 1);
      assert.equal(await control.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    }
    const bounds = await group.getByRole('button').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
    for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i], b = bounds[j];
      assert.ok(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, 'destination targets must not overlap');
    }
    await town.focus();
    assert.equal(await town.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    await page.screenshot({ path: `artifacts/hub/${width}-normal.png`, fullPage: true });
    if (width === 390) console.log('HUB_RENDER_390_PNG=' + (await page.screenshot({ fullPage: true })).toString('base64'));
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    for (const name of await page.locator('.adv-node-name').all()) {
      assert.ok(await name.evaluate(el => el.scrollWidth <= el.clientWidth + 1), '200% text names must wrap');
    }
    const textBounds = await group.getByRole('button').evaluateAll(elements => elements.map(el => ({ left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })));
    assert.ok(textBounds.every(b => b.left >= 0 && b.right <= width + 1));
    await page.screenshot({ path: `artifacts/hub/${width}-text200.png`, fullPage: true });
    if (width === 390) console.log('HUB_RENDER_390_TEXT200_PNG=' + (await page.screenshot({ fullPage: true })).toString('base64'));
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await locked.tap();
    assert.equal(new URL(page.url()).pathname, '/play');
    assert.equal(await locked.getAttribute('aria-pressed'), 'true');
    await town.tap();
    await page.waitForURL(url => url.pathname === '/play/emberhaven');
    await page.getByText('1 of 3 clues found.', { exact: true }).waitFor();
    await page.getByRole('link', { name: '← Back to Hub', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/play');
    assert.equal(await page.evaluate(() => localStorage.getItem('life-ascension:lantern-route:v1')), lantern);
    // Reopen the preview Hub to exercise its existing query propagation.
    await page.goto(`${base}/play?preview=1`);
    await crypt.click();
    await page.waitForURL(url => url.pathname === '/play/delve' && url.searchParams.get('preview') === '1');
    assert.deepEqual(errors, []);
    assert.deepEqual(forbidden, []);
    console.log(`PASS ${width}px: readable nonoverlapping44px cards,200% text wrap,focus,reduced motion,locked selection,Town return/storage and Crypt preview route`);
    await context.close();
  }
} finally { await browser.close(); }
