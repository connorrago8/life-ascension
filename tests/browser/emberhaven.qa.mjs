import assert from 'node:assert/strict';
import { chromium } from 'playwright';

if (process.getuid?.() === 0) throw new Error('Run Chromium as an unprivileged user.');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3128';
const origin = new URL(base).origin;
assert.equal(new URL(base).hostname, '127.0.0.1');
const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
try {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const violations = [];
    const errors = [];
    await context.route('**/*', route => {
      const request = route.request();
      if (new URL(request.url()).origin !== origin || !['GET', 'HEAD'].includes(request.method())) {
        violations.push(`${request.method()} ${new URL(request.url()).origin}`);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/play/emberhaven`);
    await page.getByRole('heading', { name: 'Emberhaven', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const avatar = page.locator('[data-facing]');
    const point = () => avatar.evaluate(el => [parseFloat(el.style.left), parseFloat(el.style.top)]);
    assert.deepEqual(await point(), [47, 43]);
    await page.getByRole('button', { name: 'Walk north', exact: true }).click();
    assert.deepEqual(await point(), [47, 35]);
    const map = page.getByLabel('Interactive Emberhaven map. Focus here and use arrow keys to walk.', { exact: true });
    await map.focus();
    await page.keyboard.press('ArrowLeft');
    assert.deepEqual(await point(), [39, 35]);
    await page.keyboard.press('ArrowUp'); // obstacle centered at (35, 22)
    assert.deepEqual(await point(), [39, 35]);
    assert.match(await page.getByRole('status').innerText(), /Steps 2\./);
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft');
    assert.deepEqual(await point(), [8, 35]);
    const steps = await page.getByRole('status').innerText();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByRole('status').innerText(), steps);
    for (const [name, path] of [
      ['Noticeboard', '/quests'], ['Blacksmith', '/play/emberhaven/blacksmith'],
      ['Hearth', '/play/emberhaven/hearth'], ['Market', '/play/emberhaven/market'],
      ['Waystone', '/play/emberhaven/waystone'], ['Trail Gate', '/play'],
    ]) {
      const landmark = page.getByRole('button', { name: `Inspect ${name}`, exact: true });
      await landmark.click();
      assert.equal(await landmark.getAttribute('aria-pressed'), 'true');
      const talk = page.getByRole('button', { name: `Talk / inspect ${name}`, exact: true });
      await talk.click();
      assert.equal(await talk.getAttribute('aria-expanded'), 'true');
      await page.getByRole('note').waitFor();
      await talk.click();
      assert.equal(await page.getByRole('note').count(), 0);
      const enter = page.getByRole('link', { name: `Enter ${name} →`, exact: true });
      assert.equal(await enter.getAttribute('href'), path);
      await enter.click();
      await page.waitForURL(url => url.pathname === path);
      if (path.startsWith('/play/emberhaven/')) {
        await page.locator('main a[href="/play/emberhaven"]').click();
      } else if (path === '/play') {
        await page.getByRole('link', { name: 'Visit Emberhaven town →', exact: true }).click();
      } else {
        await page.goBack();
      }
      await page.getByRole('heading', { name: 'Emberhaven', exact: true }).waitFor();
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await avatar.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.match(await avatar.evaluate(el => getComputedStyle(el).transitionDuration), /0\.16s/);

    // Create a real guest run through the UI, then leave via browser history.
    // "End run" deliberately destroys the run and is not a resume route.
    await page.getByRole('button', { name: 'Inspect Trail Gate', exact: true }).click();
    await page.getByRole('link', { name: 'Enter Trail Gate →', exact: true }).click();
    await page.getByRole('link', { name: 'Enter →', exact: true }).click();
    await page.getByRole('button', { name: 'Enter Floor 1', exact: true }).click();
    await page.getByRole('button', { name: /^Start with the Bruiser deck/ }).click();
    await page.getByRole('heading', { name: 'Choose your opening card', exact: true }).waitFor();
    await page.getByRole('button', { name: /^Take .* costs / }).first().click();
    await page.getByRole('heading', { name: 'Choose your path', exact: true }).waitFor();
    const readRun = () => page.evaluate(() => JSON.parse(localStorage.getItem('la.crypt.activeRun.v1')));
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('la.crypt.activeRun.v1'))?.state?.phase === 'map');
    const original = await readRun();
    assert.equal(original.owner, 'guest');
    await page.goBack();
    await page.getByRole('link', { name: 'Visit Emberhaven town →', exact: true }).click();
    assert.deepEqual(await readRun(), original, 'entering town must not change the saved run');
    for (const name of ['Blacksmith', 'Hearth', 'Market', 'Waystone']) {
      await page.getByRole('button', { name: `Inspect ${name}`, exact: true }).click();
      await page.getByRole('link', { name: `Enter ${name} →`, exact: true }).click();
      await page.locator('main a[href="/play/emberhaven"]').click();
      await page.getByRole('heading', { name: 'Emberhaven', exact: true }).waitFor();
      assert.deepEqual(await readRun(), original, `${name} must not change the saved run`);
    }
    await page.getByRole('button', { name: 'Inspect Trail Gate', exact: true }).click();
    await page.getByRole('link', { name: 'Enter Trail Gate →', exact: true }).click();
    await page.getByRole('link', { name: 'Continue run', exact: true }).click();
    await page.getByRole('heading', { name: 'Choose your path', exact: true }).waitFor();
    assert.deepEqual((await readRun()).state, original.state, 'resume must preserve the complete run state');
    await page.reload();
    await page.getByRole('heading', { name: 'Choose your path', exact: true }).waitFor();
    assert.deepEqual((await readRun()).state, original.state, 'reload must preserve the complete run state');
    assert.deepEqual(errors, []);
    assert.deepEqual(violations, []);
    console.log(`PASS ${width}px: movement, collision, dialogue, return links, reduced motion, guest Crypt resume and reload, no external requests or network writes`);
    await context.close();
  }
} finally {
  await browser.close();
}
