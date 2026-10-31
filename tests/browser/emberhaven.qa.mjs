import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

if (process.getuid?.() === 0) throw new Error('Run browser QA as an unprivileged user.');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3128';
const origin = new URL(base).origin;
assert.equal(new URL(base).hostname, '127.0.0.1');
const engine = process.env.QA_BROWSER || 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine), 'QA_BROWSER must be chromium or webkit');
const browser = await (engine === 'webkit'
  ? webkit.launch({ headless: true })
  : chromium.launch({ headless: true, chromiumSandbox: true }));
try {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true });
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
    await page.goto(`${base}/`);
    const homeTab = page.getByRole('link', { name: 'Home', exact: true });
    assert.equal(await homeTab.getAttribute('aria-current'), 'page');
    const hubTab = page.getByRole('link', { name: 'Hub', exact: true });
    assert.equal(await hubTab.getAttribute('aria-current'), null);
    assert.equal(await page.locator('.nav-play-orb').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    await hubTab.click();
    await page.getByRole('heading', { name: 'Hub', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Town, open Emberhaven', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/play/emberhaven');

    await page.goto(`${base}/play/emberhaven`);
    await page.getByRole('heading', { name: 'Emberhaven', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.getByRole('button', { name: /^Walk / }).count(), 0);
    assert.equal(await page.locator('[data-facing]').count(), 0, 'walking prototype is not mounted');
    const forge = page.getByRole('link', { name: 'Visit Blacksmith', exact: true });
    await forge.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'The Blacksmith', exact: true }).waitFor();
    await page.getByRole('link', { name: '← Back to Town', exact: true }).click();
    await page.getByRole('link', { name: 'Visit Hearth', exact: true }).tap();
    await page.getByRole('heading', { name: 'The Hearth', exact: true }).waitFor();
    await page.getByRole('link', { name: '← Back to Town', exact: true }).click();
    for (const control of await page.locator('section[aria-labelledby="ember-map-title"] a').all()) {
      const box = await control.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44, 'town links have 44px touch targets');
    }
    for (const [name, path] of [
      ['Noticeboard', '/quests'], ['Blacksmith', '/play/emberhaven/blacksmith'],
      ['Hearth', '/play/emberhaven/hearth'], ['Market', '/play/emberhaven/market'],
      ['Waystone', '/play/emberhaven/waystone'], ['Trail Gate', '/play'],
    ]) {
      await page.getByRole('link', { name: `Visit ${name}`, exact: true }).click();
      await page.waitForURL(url => url.pathname === path);
      if (path.startsWith('/play/emberhaven/')) {
        assert.equal(await page.getByText(/0[123] · EMBERHAVEN/).count(), 0, 'no numbered placeholder cards');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const back = page.getByRole('link', { name: '← Back to Town', exact: true });
        const backBox = await back.boundingBox();
        assert.ok(backBox && backBox.y >= 0 && backBox.y < 844, 'Back to Town remains visible while scrolling');
        await back.click();
      } else if (path === '/play') {
        await page.getByRole('link', { name: 'Visit Emberhaven town →', exact: true }).click();
      } else {
        await page.goBack();
      }
      await page.getByRole('heading', { name: 'Emberhaven', exact: true }).waitFor();
    }
    // CSS layout zoom checks reflow; this is not native Safari zoom or VoiceOver.
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    const zoomOverflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => ({ tag: el.tagName, text: el.textContent?.slice(0, 50), right: el.getBoundingClientRect().right })) }));
    assert.ok(zoomOverflow.scroll <= zoomOverflow.width, `200% layout zoom overflow: ${JSON.stringify(zoomOverflow)}`);
    for (const control of await page.locator('section[aria-labelledby="ember-map-title"] a').all()) {
      assert.ok(await control.isVisible(), 'town controls must remain visible at 200% layout zoom');
    }
    await page.evaluate(() => { document.documentElement.style.zoom = ''; });

    // Create a real guest run through the UI, then leave via browser history.
    // "End run" deliberately destroys the run and is not a resume route.
    await page.getByRole('link', { name: 'Visit Trail Gate', exact: true }).click();
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
    await page.getByRole('button', { name: 'Begin the Lantern Route', exact: true }).click();
    for (const name of ['Blacksmith', 'Hearth', 'Market', 'Waystone']) {
      await page.getByRole('link', { name: `Visit ${name}`, exact: true }).click();
      if (name !== 'Waystone') {
        const npc = { Blacksmith: 'Mara Venn', Hearth: 'Hearth keeper', Market: 'Lantern keeper' }[name];
        await page.getByRole('button', { name: `Talk to ${npc}`, exact: true }).click();
        await page.getByRole('button', { name: 'Ask about the Lantern Route', exact: true }).click();
        await page.getByRole('button', { name: 'Ask about the Lantern Route', exact: true }).click();
      } else {
        for (const title of ['Light', 'Craft', 'Warmth']) await page.getByRole('button', { name: `Place ${title}`, exact: true }).click();
        await page.getByText(/Those signs do not match the clues/).waitFor();
        await page.getByRole('button', { name: 'Rearrange signs', exact: true }).click();
        for (const title of ['Warmth', 'Craft', 'Light']) await page.getByRole('button', { name: `Place ${title}`, exact: true }).click();
        await page.getByText(/The Lantern Route is complete/).waitFor();
      }
      await page.locator('main a[href="/play/emberhaven"]').first().click();
      await page.getByRole('heading', { name: 'Emberhaven', exact: true }).waitFor();
      assert.deepEqual(await readRun(), original, `${name} must not change the saved run`);
    }
    await page.getByText('Lantern Route complete.', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Visit Trail Gate', exact: true }).click();
    await page.getByRole('link', { name: 'Continue run', exact: true }).click();
    await page.getByRole('heading', { name: 'Choose your path', exact: true }).waitFor();
    assert.deepEqual((await readRun()).state, original.state, 'resume must preserve the complete run state');
    await page.reload();
    await page.getByRole('heading', { name: 'Choose your path', exact: true }).waitFor();
    assert.deepEqual((await readRun()).state, original.state, 'reload must preserve the complete run state');
    await page.goto(`${base}/play/emberhaven`);
    await page.getByRole('button', { name: 'Begin the Lantern Route', exact: true }).waitFor();
    await page.goto(`${base}/quests?preview=1`);
    await page.getByText('Layout preview. Sign in to load your quests.', { exact: true }).waitFor();
    assert.equal(await page.locator('header .streak-badge').count(), 0, 'no global daily streak');
    assert.ok(await page.locator('.quest-title .streak-badge').count() > 0, 'daily streaks appear next to quest titles');
    await page.getByRole('link', { name: 'Hub', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Play', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(violations, []);
    console.log(`PASS ${engine} ${width}px: one-tap town, touch, keyboard, 44px targets, 200% layout zoom, return links, walking unmounted, Lantern Route clue collection and puzzle retry/completion, guest Crypt resume and reload, per-quest badges, Home selection, open Town node and sticky Back navigation, no external requests or network writes`);
    await context.close();
  }
} finally {
  await browser.close();
}
