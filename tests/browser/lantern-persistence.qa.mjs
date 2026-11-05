import assert from 'node:assert/strict';
import { chromium } from 'playwright';

if (process.getuid?.() === 0) throw new Error('Run sandboxed browser as a non-root user.');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3142';
const origin = new URL(base).origin;
assert.equal(new URL(base).hostname, '127.0.0.1');
const key = 'life-ascension:lantern-route:v1';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN, chromiumSandbox: true });
try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true });
    const errors = [], forbidden = [];
    await context.route('**/*', route => {
      const r = route.request();
      if (new URL(r.url()).origin !== origin || !['GET', 'HEAD'].includes(r.method())) {
        forbidden.push(`${r.method()} ${r.url()}`);
        return route.abort();
      }
      return route.continue();
    });
    await context.addInitScript(() => {
      const key = 'life-ascension:lantern-route:v1';
      const original = Storage.prototype.setItem;
      window.__blockLantern = false;
      Storage.prototype.setItem = function (name, value) {
        if (name === key && window.__blockLantern) throw new DOMException('Quota full', 'QuotaExceededError');
        return original.call(this, name, value);
      };
      if (!sessionStorage.getItem('lantern-fixture')) {
        localStorage.setItem('qa:unrelated', 'unchanged');
        sessionStorage.setItem('lantern-fixture', 'yes');
      }
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    await page.goto(`${base}/play/emberhaven`);
    const begin = page.getByRole('button', { name: 'Begin the Lantern Route', exact: true });
    await begin.waitFor();
    await page.getByText('Town story loaded. Progress saves on this device when you make a choice.', { exact: true }).waitFor();
    assert.equal(await read(), null, 'hydration must not write an empty record');
    await begin.tap();
    assert.equal((await read()).started, true, 'action persists before following navigation');
    await page.getByRole('link', { name: '← Back to Hub', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/play');
    await page.goto(`${base}/play/emberhaven`);
    await page.getByText('0 of 3 clues found.', { exact: true }).waitFor();
    for (const [place, npc] of [['Hearth', 'Hearth keeper'], ['Blacksmith', 'Mara Venn'], ['Market', 'Lantern keeper']]) {
      await page.getByRole('link', { name: `Visit ${place}`, exact: true }).click();
      await page.getByRole('button', { name: `Talk to ${npc}`, exact: true }).click();
      await page.getByRole('button', { name: 'Ask about the Lantern Route', exact: true }).tap();
      await page.getByRole('link', { name: '← Back to Town', exact: true }).click();
    }
    await page.getByRole('link', { name: 'Visit Waystone', exact: true }).click();
    // Save failure must keep the latest in-memory choice and suppress success claims.
    const beforeFailure = await read();
    await page.evaluate(() => { window.__blockLantern = true; });
    await page.getByRole('button', { name: 'Place Warmth', exact: true }).tap();
    const warning = page.getByText(/^Device save unavailable\./);
    await warning.waitFor();
    assert.deepEqual(await read(), beforeFailure, 'failed write preserves last durable save');
    assert.equal(await page.getByText('Progress is saved on this device and kept when you leave or reload.', { exact: true }).count(), 0);
    const retry = page.getByRole('button', { name: 'Retry device save', exact: true });
    const box = await retry.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44);
    await page.evaluate(() => { window.__blockLantern = false; });
    await retry.tap();
    await page.getByText('Progress is saved on this device and kept when you leave or reload.', { exact: true }).waitFor();
    assert.deepEqual((await read()).placed, ['hearth']);
    for (const title of ['Craft', 'Light']) await page.getByRole('button', { name: `Place ${title}`, exact: true }).tap();
    assert.equal((await read()).solved, true);
    await page.reload();
    await page.getByText('Lantern Route complete. No rewards or account changes were made.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reset the Lantern Route', exact: true }).click();
    assert.deepEqual(await read(), { started: false, clues: [], placed: [], solved: false, kept: true });
    await page.getByRole('link', { name: '← Back to Town', exact: true }).click();
    await page.reload();
    await page.getByText('Lantern kept. The square lantern stays lit. This is a keepsake, not XP.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('qa:unrelated')), 'unchanged');
    assert.deepEqual(errors, []);
    assert.deepEqual(forbidden, []);
    console.log(`PASS ${width}px: no hydration write; action→Hub→return; three clues; quota failure→retry; solve→reload; reset keeps lantern; unrelated storage unchanged; zero external/write requests`);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [], forbidden = [];
  await context.route('**/*', route => {
    const r = route.request();
    if (new URL(r.url()).origin !== origin || !['GET', 'HEAD'].includes(r.method())) {
      forbidden.push(`${r.method()} ${r.url()}`); return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(() => Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage denied', 'SecurityError'); } }));
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/play/emberhaven`);
  await page.getByText(/^Device save unavailable\./).waitFor();
  await page.getByRole('button', { name: 'Begin the Lantern Route', exact: true }).click();
  await page.getByText('0 of 3 clues found.', { exact: true }).waitFor();
  await page.getByRole('link', { name: '← Back to Hub', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/play');
  assert.deepEqual(errors, []);
  assert.deepEqual(forbidden, []);
  console.log('PASS 390px denied storage getter: warning, playable visit, Hub exit, no renderer error/external/write request');
  await context.close();
} finally { await browser.close(); }
