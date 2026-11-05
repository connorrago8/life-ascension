import assert from 'node:assert/strict';
import { chromium } from 'playwright';

if (process.getuid?.() === 0) throw Error('Use a sandboxed non-root browser.');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3148';
const origin = new URL(base).origin;
assert.equal(new URL(base).hostname, '127.0.0.1');
const key = 'la.crypt.activeRun.v1';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN, chromiumSandbox: true });
try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true });
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
    const read = () => page.evaluate(key => localStorage.getItem(key), key);
    const entry = name => page.getByRole('link', { name, exact: true });
    async function beginRun(query = '') {
      await page.goto(`${base}/play/delve${query}`);
      await page.getByRole('button', { name: 'Enter Floor 1', exact: true }).click();
      await page.getByRole('button', { name: /^Start with the Bruiser deck/ }).click();
      await page.getByRole('heading', { name: 'Choose your opening card', exact: true }).waitFor();
      await page.getByRole('button', { name: /^Take .* costs / }).first().click();
      await page.getByRole('heading', { name: 'Choose your path', exact: true }).waitFor();
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.state?.phase === 'map', key);
      return JSON.parse(await read());
    }
    const guest = await beginRun();
    assert.equal(guest.owner, 'guest');
    await page.goto(`${base}/play`);
    await entry('Continue run').waitFor();
    const beforeHub = await read();
    await entry('Continue run').click();
    await page.getByRole('heading', { name: 'Choose your path', exact: true }).waitFor();
    const continued = JSON.parse(await read());
    assert.equal(continued.state.runId, guest.state.runId);
    assert.deepEqual(continued.state.deck, guest.state.deck);
    assert.equal(continued.state.hp, guest.state.hp);
    // A read of Hub must not rewrite or clear a rejected snapshot.
    const cases = [
      ['expired', { ...guest, savedAt: Date.now() - 24 * 60 * 60 * 1000 - 1000 }],
      ['other-account', { ...guest, owner: 'user:another-account' }],
      ['other-mode', { ...guest, owner: 'preview' }],
      ['ended', { ...guest, state: { ...guest.state, phase: 'defeat' } }],
      ['malformed', { v: 1, owner: 'guest', savedAt: Date.now(), state: { runId: 'invalid' } }],
    ];
    await page.goto(`${base}/play`);
    for (const [label, record] of cases) {
      const raw = JSON.stringify(record);
      await page.evaluate(({ key, raw }) => {
        localStorage.setItem(key, raw);
        window.dispatchEvent(new StorageEvent('storage', { key }));
      }, { key, raw });
      await entry('Enter →').waitFor();
      assert.equal(await entry('Continue run').count(), 0, label);
      assert.equal(await read(), raw, `${label} save must remain untouched`);
    }
    // A storage notification can make an actually valid guest run resumable again.
    await page.evaluate(({ key, raw }) => {
      localStorage.setItem(key, raw);
      window.dispatchEvent(new StorageEvent('storage', { key }));
    }, { key, raw: beforeHub });
    await entry('Continue run').waitFor();
    // Returning focus must recheck expiry, even without a cross-tab event.
    const expired = JSON.stringify({ ...guest, savedAt: 1 });
    await page.evaluate(({ key, raw }) => { localStorage.setItem(key, raw); window.dispatchEvent(new Event('focus')); }, { key, raw: expired });
    await entry('Enter →').waitFor();
    assert.equal(await read(), expired);
    // A real development-preview run is a separate owner and keeps its query.
    const preview = await beginRun('?preview=1');
    assert.equal(preview.owner, 'preview');
    await page.goto(`${base}/play`);
    await entry('Enter →').waitFor();
    assert.equal(await entry('Continue run').count(), 0, 'guest Hub must not claim preview continuation');
    await page.goto(`${base}/play?preview=1`);
    await entry('Continue run').waitFor();
    assert.equal(await entry('Continue run').getAttribute('href'), '/play/delve?preview=1');
    await entry('Continue run').click();
    await page.getByRole('heading', { name: 'Choose your path', exact: true }).waitFor();
    assert.equal(JSON.parse(await read()).state.runId, preview.state.runId);
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    console.log(`PASS ${width}px Crypt continuation: real guest/preview runs resume unchanged; expired,other-owner,other-mode,ended,malformed records show neutral entry; focus/storage refresh is read-only; zero external/write requests`);
    await context.close();
  }
} finally { await browser.close(); }
