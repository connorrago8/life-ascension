import assert from 'node:assert/strict';
import { chromium } from 'playwright';
if (process.getuid?.() === 0) throw Error('Use a sandboxed non-root browser.');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3148';
const origin = new URL(base).origin;
assert.equal(new URL(base).hostname, '127.0.0.1');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN, chromiumSandbox: true });
try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true });
    const errors = [], forbidden = [], notFound = [];
    await context.route('**/*', route => {
      const r = route.request();
      if (new URL(r.url()).origin !== origin || !['GET', 'HEAD'].includes(r.method())) {
        forbidden.push(`${r.method()} ${r.url()}`); return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', response => { if (response.status() === 404 && new URL(response.url()).pathname.startsWith('/play/emberhaven')) notFound.push(response.url()); });
    await page.goto(`${base}/play/emberhaven`);
    await page.getByRole('button', { name: 'Begin the Lantern Route', exact: true }).click();
    for (const [index, path, person, stop] of [
      [0, '/play/emberhaven/hearth', 'Hearth keeper', 'hearth'],
      [1, '/play/emberhaven/blacksmith', 'Mara Venn', 'forge'],
      [2, '/play/emberhaven/market', 'Lantern keeper', 'market'],
    ]) {
      const next = page.getByRole('link', { name: 'Seek the next clue →', exact: true });
      assert.equal(await next.getAttribute('href'), path, 'logical clue id must map to an actual route');
      await next.tap();
      await page.waitForURL(url => url.pathname === path);
      await page.getByRole('button', { name: `Talk to ${person}`, exact: true }).click();
      await page.getByRole('button', { name: 'Ask about the Lantern Route', exact: true }).click();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('life-ascension:lantern-route:v1')));
      assert.ok(saved.clues.includes(stop)); assert.equal(saved.clues.length, index + 1);
      await page.getByRole('link', { name: '← Back to Town', exact: true }).click();
      await page.getByText(`${index + 1} of 3 clues found.`, { exact: true }).waitFor();
      if (index === 0) {
        await page.getByRole('link', { name: '← Back to Hub', exact: true }).click();
        await page.getByRole('link', { name: 'Visit Emberhaven town →', exact: true }).click();
        await page.getByText('1 of 3 clues found.', { exact: true }).waitFor();
      }
    }
    await page.getByRole('link', { name: 'Arrange the signs at the Waystone →', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/play/emberhaven/waystone');
    for (const name of ['Warmth', 'Craft', 'Light']) await page.getByRole('button', { name: `Place ${name}`, exact: true }).click();
    await page.getByRole('link', { name: 'Return to Emberhaven →', exact: true }).click();
    await page.getByText('Lantern Route complete.', { exact: true }).waitFor();
    const final = await page.evaluate(() => JSON.parse(localStorage.getItem('life-ascension:lantern-route:v1')));
    assert.equal(final.solved, true); assert.equal(final.kept, true);
    assert.deepEqual(final.clues, ['hearth', 'forge', 'market']);
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []); assert.deepEqual(notFound, []);
    console.log(`PASS ${width}px guided Lantern: Hearth→Hub→Town→Blacksmith→Market→Waystone uses real links,no404,three saved clues,solved keepsake,no external/write requests`);
    await context.close();
  }
} finally { await browser.close(); }
