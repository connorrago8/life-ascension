import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

if (process.getuid?.() === 0) throw new Error('Use a sandboxed non-root browser.');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3148';
const origin = new URL(base).origin;
assert.equal(new URL(base).hostname, '127.0.0.1');
await mkdir('artifacts/town', { recursive: true });
const routes = [
  ['Noticeboard', '/quests'], ['Blacksmith', '/play/emberhaven/blacksmith'],
  ['Hearth', '/play/emberhaven/hearth'], ['Market', '/play/emberhaven/market'],
  ['Waystone', '/play/emberhaven/waystone'], ['Trail Gate', '/play'],
];
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
      if (!localStorage.getItem('visual-save-sentinel')) localStorage.setItem('visual-save-sentinel', 'retain-me');
    });
    await page.goto(`${base}/play/emberhaven`);
    await page.getByRole('heading', { name: 'Emberhaven', exact: true }).waitFor();
    await page.getByText('1 of 3 clues found.', { exact: true }).waitFor();
    const before = await page.evaluate(() => ({ lantern: localStorage.getItem('life-ascension:lantern-route:v1'), sentinel: localStorage.getItem('visual-save-sentinel') }));
    const nav = page.getByRole('navigation', { name: 'Emberhaven locations', exact: true });
    assert.equal(await nav.getByRole('link').count(), 6);
    assert.equal(await nav.locator('svg[aria-hidden="true"]').count(), 6);
    async function checkCards(enlarged) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'no horizontal overflow');
      const columns = await nav.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.equal(columns, enlarged ? 1 : 2, 'cards reflow instead of compressing large text');
      for (const [name, href] of routes) {
        const link = nav.getByRole('link', { name: `Visit ${name}`, exact: true });
        assert.equal(await link.getAttribute('href'), href);
        const description = await link.getAttribute('aria-describedby');
        assert.ok(description && await page.locator(`#${description}`).innerText());
        const rect = await link.boundingBox();
        assert.ok(rect && rect.width >= 44 && rect.height >= 44 && rect.x >= 0 && rect.x + rect.width <= width + 1);
        assert.equal(await link.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
        assert.ok(await link.evaluate(el => [...el.querySelectorAll('strong, [id]')].every(text => text.scrollWidth <= text.clientWidth + 1)), 'name and description wrap within their card');
        await link.focus();
        await link.scrollIntoViewIfNeeded();
        assert.equal(await link.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
        assert.equal(await link.evaluate(el => {
          const r = el.getBoundingClientRect();
          return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('a') === el;
        }), true, 'focused destination stays above navigation overlays');
      }
    }
    await checkCards(false);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/town/${width}-normal.png`, fullPage: true });
    if (width === 390) console.log('TOWN_RENDER_390_PNG=' + (await page.screenshot({ fullPage: true })).toString('base64'));
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    await checkCards(true);
    const titleLines = await page.locator('#emberhaven-title').evaluate(el => {
      const lines = [];
      for (const node of el.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        // Each compound part must remain whole; avoid a single orphan letter.
        lines.push([...range.getClientRects()].length);
      }
      return lines;
    });
    assert.deepEqual(titleLines, [1, 1], 'Ember and haven must each remain intact at200%text');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/town/${width}-text200.png`, fullPage: true });
    if (width === 390) console.log('TOWN_RENDER_390_TEXT200_PNG=' + (await page.screenshot({ fullPage: true })).toString('base64'));
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    // Glyph failure must leave named, working destinations.
    await nav.locator('svg').evaluateAll(icons => icons.forEach(icon => { icon.style.display = 'none'; }));
    await nav.getByRole('link', { name: 'Visit Blacksmith', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(url => url.pathname === '/play/emberhaven/blacksmith');
    await page.getByRole('link', { name: '← Back to Town', exact: true }).click();
    await page.getByRole('link', { name: 'Visit Hearth', exact: true }).tap();
    await page.waitForURL(url => url.pathname === '/play/emberhaven/hearth');
    await page.getByRole('link', { name: '← Back to Town', exact: true }).click();
    const after = await page.evaluate(() => ({ lantern: localStorage.getItem('life-ascension:lantern-route:v1'), sentinel: localStorage.getItem('visual-save-sentinel') }));
    assert.deepEqual(after, before);
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    console.log(`PASS ${width}px Town: six named links, crisp decorative SVGs, two-to-one-column text reflow,44px targets,focus,zero-motion,keyboard/touch,missing art and storage preservation`);
    await context.close();
  }
} finally { await browser.close(); }
