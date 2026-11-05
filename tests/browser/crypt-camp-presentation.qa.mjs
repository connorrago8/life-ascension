/** Actual Camp controls with demonstration gear. Not account-save or natural-run certification. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { pointsForLevel } from '../../lib/crypt/delve/stats.ts';
if (process.getuid?.() === 0) throw Error('Non-root sandboxed browser required');
const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:3148');
assert.equal(base.hostname, '127.0.0.1');
const budget = pointsForLevel(3);
await mkdir('artifacts/crypt-camp', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN, chromiumSandbox: true });
try {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
    const errors = [], forbidden = [];
    await context.route('**/*', route => {
      const r = route.request();
      if (new URL(r.url()).origin !== base.origin || !['GET', 'HEAD'].includes(r.method())) {
        forbidden.push(r.method() + ' ' + r.url()); return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(new URL('/qa/crypt-camp', base).href);
    const camp = page.getByRole('main', { name: 'Forgotten Crypt camp' });
    await camp.waitFor();
    const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    await camp.getByText(`${budget} of ${budget} points left`, { exact: true }).waitFor();
    await camp.getByText(`Only real quests level you up. Each level gives ${pointsForLevel(4) - budget} more points.`, { exact: true }).waitFor();
    assert.equal(await camp.locator('.delve-wear[aria-pressed="true"]').count(), 0, 'no automatic Wear');
    for (const large of [false, true]) {
      await page.evaluate(large => { document.documentElement.style.fontSize = large ? '32px' : ''; }, large);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'no horizontal overflow');
      for (const element of await camp.locator('h1,h2,p,.delve-attr-text,.camp-gear-copy').all()) {
        assert.ok(await element.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'text does not clip');
      }
      for (const action of await camp.locator('button,a.btn').all()) {
        await action.scrollIntoViewIfNeeded();
        const r = await action.boundingBox();
        assert.ok(r && r.width >= 44 && r.height >= 44 && r.x >= 0 && r.x + r.width <= width + 1, '44px action fits');
        assert.ok(await action.evaluate(el => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button,a') === el; }), 'action not covered by bottom navigation');
      }
      const raise = camp.getByRole('button', { name: 'Raise Strength', exact: true });
      // Establish keyboard modality through real navigation, including after mouse actions.
      await camp.getByRole('button', { name: 'Enter Floor 1', exact: true }).focus();
      await page.keyboard.press('Tab');
      assert.equal(await raise.evaluate(el => document.activeElement === el), true, 'Tab reaches Raise Strength, skipping disabled Lower');
      assert.equal(await raise.evaluate(el => el.matches(':focus-visible')), true, 'real keyboard focus');
      assert.notEqual(await raise.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
      await page.keyboard.press('Enter');
      await camp.getByText(`${budget - 1} of ${budget} points left`, { exact: true }).waitFor();
      await camp.getByRole('button', { name: 'Lower Strength', exact: true }).click();
      await camp.getByText(`${budget} of ${budget} points left`, { exact: true }).waitFor();
      assert.equal(await camp.getByRole('button', { name: 'Lower Strength', exact: true }).isDisabled(), true);
      assert.equal(await raise.evaluate(el => getComputedStyle(el).animationName), 'none');
      await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
      await page.screenshot({ path: `artifacts/crypt-camp/${width}-${large ? 'text200' : 'normal'}.png`, fullPage: true });
    }
    await camp.getByRole('button', { name: 'Wear Rusty Shortsword this run', exact: true }).click();
    assert.equal(await camp.getByRole('button', { name: 'Take off Rusty Shortsword', exact: true }).getAttribute('aria-pressed'), 'true');
    await camp.getByRole('button', { name: 'Wear Bone Cleaver this run', exact: true }).click();
    assert.equal(await camp.locator('.camp-gear-worn').count(), 1, 'one explicit Worn visual state');
    assert.equal(await camp.locator('.delve-wear[aria-pressed="true"]').count(), 1, 'same-slot replacement');
    await camp.getByRole('button', { name: 'Wear Rusty Shortsword this run', exact: true }).waitFor();
    await camp.getByRole('button', { name: 'Take off Bone Cleaver', exact: true }).click();
    assert.equal(await camp.locator('.camp-gear-worn').count(), 0);
    assert.equal(await camp.locator('.delve-wear[aria-pressed="true"]').count(), 0, 'Take off');
    await camp.getByRole('button', { name: 'Wear Bone Cleaver this run', exact: true }).click();
    await camp.getByRole('button', { name: 'Raise Strength', exact: true }).click();
    await camp.getByRole('button', { name: 'Save build', exact: true }).click();
    await camp.getByRole('status').filter({ hasText: 'Build kept for this visit only.' }).waitFor();
    await camp.getByRole('button', { name: 'Enter Floor 1', exact: true }).click();
    await page.getByRole('heading', { name: 'Choose your starting deck', exact: true }).waitFor();
    await page.waitForFunction(() => JSON.parse(document.querySelector('output[aria-label="Fixture run state"]').textContent)?.phase === 'deck-select');
    const state = JSON.parse(await page.getByLabel('Fixture run state').textContent());
    assert.equal(state.phase, 'deck-select'); assert.equal(state.allocated.strength, 1); assert.equal(state.loadout.weapon, 'bone-cleaver');
    assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))), before, 'fixture interactions do not rewrite persistence');
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    console.log(`PASS camp ${width}px: normal/200% root text, 44px unobscured controls, keyboard activation/focus, explicit Wear/replacement/Take off, visit-only save feedback, selected allocation/loadout reach actual deck selection; storage unchanged, errors[]/forbidden[]`);
    await context.close();
  }
} finally { await browser.close(); }
