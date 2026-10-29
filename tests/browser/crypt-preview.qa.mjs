/**
 * Real-component Forgotten Crypt browser smoke on a local, unprivileged Chromium.
 * Exercises the full unsaved preview at iPhone viewport widths. No credentials,
 * hosted database, account XP, or persistent rewards are involved.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cryptPreviewRequestViolation } from './crypt-network-policy.mjs';

if (typeof process.getuid === 'function' && process.getuid() === 0) {
  throw new Error('Refusing to run Chromium as root.');
}
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  throw new Error('Playwright is required in the isolated browser QA runner.');
}
const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:3000';
const output = 'artifacts/crypt-preview';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  ...(process.env.CHROMIUM_BIN ? { executablePath: process.env.CHROMIUM_BIN } : {}),
});

async function winBattle(page) {
  // Heavy Strike opens the fight; repeat Attack until the actual victory state.
  await page.getByRole('button', { name: /^Heavy Strike/ }).click();
  for (let turn = 0; turn < 6 && await page.getByText('Victory', { exact: true }).count() === 0; turn++) {
    await page.getByRole('button', { name: /^Attack/ }).click();
    await page.waitForFunction(() => /Victory|Turn \d+/.test(document.querySelector('.turn-line')?.textContent ?? ''));
  }
  await page.getByText('Victory', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('[data-phase="map"]').waitFor();
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const unexpectedRequests = [];
  page.on('request', request => {
    const reason = cryptPreviewRequestViolation(
      { method: request.method(), url: request.url() }, baseURL);
    if (reason) {
      let origin = 'invalid-url';
      try { origin = new URL(request.url()).origin; } catch {}
      // Do not record query strings, tokens, or full request URLs.
      let safePath = '/';
      try { safePath = new URL(request.url()).pathname; } catch {}
      // Path only: never include query strings, tokens, or full request URLs.
      unexpectedRequests.push(`${request.method()} ${origin}${safePath} (${reason})`);
    }
  });

  await page.goto(baseURL + '/play/crypt');
  await page.locator('[data-phase="intro"]').waitFor();
  await page.getByText('Preview — progress is not saved and earns no XP').waitFor();
  await page.getByRole('button', { name: 'Walk to the gate' }).click();
  await page.locator('[data-phase="gate"]').waitFor();
  await page.getByRole('button', { name: 'Enter the crypt' }).click();
  await page.locator('[data-phase="map"]').waitFor();
  assert.equal(await page.getByRole('button', { name: /^Event: Ancient inscription/ }).isDisabled(), true,
    'Inscription must remain locked until the Crypt Rat is defeated');

  await page.getByRole('button', { name: /^Fight: Crypt Rat\./ }).click();
  await page.locator('[data-phase="fight"]').waitFor();
  await winBattle(page);
  await page.getByText('Next objective: Read the ancient inscription').waitFor();

  await page.getByRole('button', { name: /^Event: Ancient inscription/ }).click();
  await page.locator('[data-phase="event"]').waitFor();
  await page.getByRole('button', { name: 'Read the warning' }).click();
  await page.getByText(/broken compass/i).first().waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('[data-phase="map"]').waitFor();
  await page.getByRole('button', { name: 'Open Wayfarer field journal' }).click();
  const journal = page.getByRole('complementary', { name: 'Wayfarer field journal' });
  assert.match(await journal.innerText(), /broken compass/i,
    'Inscription clue must remain visible after Continue');

  await page.getByRole('button', { name: /^Treasure: Ember Charm/ }).click();
  await page.locator('[data-phase="treasure"]').waitFor();
  await page.getByRole('button', { name: /^Take the Ember Charm/ }).click();
  await page.locator('[data-phase="map"]').waitFor();
  await page.getByText(/Run damage \+2/).first().waitFor();
  await page.screenshot({ path: join(output, 'crypt-map-390.png'), fullPage: true });

  await page.getByRole('button', { name: /^Guardian: Crypt Sentinel/ }).click();
  await page.locator('[data-phase="fight"]').waitFor();
  await page.getByText(/run-only damage bonus is \+2/).waitFor();
  await winBattle(page);
  await page.getByRole('button', { name: 'Approach the sealed door' }).click();
  await page.locator('[data-phase="end"]').waitFor();
  await page.getByText(/You recovered the Sentinel Sigil/).waitFor();
  await page.getByRole('button', { name: 'Inspect the compass' }).click();
  await page.getByText(/needle points downward/).waitFor();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.locator('[data-phase="map"]').waitFor();
  await page.getByRole('button', { name: 'Approach the sealed door' }).click();
  await page.locator('[data-phase="end"]').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Inspect the compass' }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Return to Brackenlight' }).count(), 1,
    'Both endings must return when revisiting the sealed door');

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
      `Crypt end card must not overflow the ${width}px viewport`);
    await page.screenshot({ path: join(output, `crypt-end-${width}.png`), fullPage: true });
  }
  // The screenshot/overflow check alone cannot catch fixed-bottom-nav overlap.
  // Exercise both ending buttons, the alternate-choice control and restart at
  // the narrowest supported iPhone viewport, scrolling as a real user would.
  await page.setViewportSize({ width: 320, height: 844 });
  const inspect = page.getByRole('button', { name: 'Inspect the compass' });
  await inspect.scrollIntoViewIfNeeded();
  await inspect.click();
  await page.getByRole('status').filter({ hasText: /needle points downward/ }).waitFor();
  const chooseAgain = page.getByRole('button', { name: 'Choose another ending' });
  await chooseAgain.scrollIntoViewIfNeeded();
  await chooseAgain.click();
  const leave = page.getByRole('button', { name: 'Return to Brackenlight' });
  await leave.scrollIntoViewIfNeeded();
  await leave.click();
  await page.getByRole('status').filter({ hasText: /return to Mira/ }).waitFor();
  await chooseAgain.scrollIntoViewIfNeeded();
  await chooseAgain.click();
  assert.equal(await inspect.count(), 1, 'Both ending choices must be reachable again at 320px');
  assert.equal(await leave.count(), 1, 'Alternate ending must remain reachable at 320px');
  assert.deepEqual(unexpectedRequests, [], 'Unsaved Crypt preview must not request backend or off-origin resources');
  const restart = page.getByRole('button', { name: 'Restart preview' });
  await restart.scrollIntoViewIfNeeded();
  await restart.click();
  await page.locator('[data-phase="intro"]').waitFor();
  // Independently exercise the Leave branch through Sentinel victory and the unsaved ending.
  const leavePage = await context.newPage();
  const leaveRequests = [];
  leavePage.on('request', request => {
    const reason = cryptPreviewRequestViolation(
      { method: request.method(), url: request.url() }, baseURL);
    if (reason) {
      let origin = 'invalid-url';
      try { origin = new URL(request.url()).origin; } catch {}
      leaveRequests.push(`${request.method()} ${origin} (${reason})`);
    }
  });
  await leavePage.goto(baseURL + '/play/crypt');
  await leavePage.locator('[data-phase="intro"]').waitFor();
  await leavePage.getByRole('button', { name: 'Walk to the gate' }).click();
  await leavePage.getByRole('button', { name: 'Enter the crypt' }).click();
  await leavePage.locator('[data-phase="map"]').waitFor();
  await leavePage.getByRole('button', { name: /^Fight: Crypt Rat\./ }).click();
  await leavePage.locator('[data-phase="fight"]').waitFor();
  await winBattle(leavePage);
  // winBattle already advanced the victory screen back to the map.
  await leavePage.getByRole('button', { name: /^Event: Ancient inscription/ }).click();
  await leavePage.getByRole('button', { name: 'Read the warning' }).click();
  await leavePage.getByRole('button', { name: 'Continue', exact: true }).click();
  await leavePage.getByRole('button', { name: /^Treasure: Ember Charm/ }).click();
  await leavePage.locator('[data-phase="treasure"]').waitFor();
  await leavePage.getByRole('button', { name: /^Leave the Ember Charm/ }).click();
  await leavePage.locator('[data-phase="map"]').waitFor();
  await leavePage.getByText(/Sentinel will be harder/i).waitFor();
  assert.equal(await leavePage.getByText(/Run damage \+2/).count(), 0,
    'Leaving the Ember Charm must not grant the run-only bonus');
  await leavePage.getByRole('button', { name: /^Guardian: Crypt Sentinel/ }).click();
  await leavePage.locator('[data-phase="fight"]').waitFor();
  await leavePage.locator('.crypt-status').filter({ hasText: /Wayfarer \d+\/\d+/ }).first().waitFor();
  assert.equal(await leavePage.locator('.crypt-status').filter({ hasText: /Run damage \+2/ }).count(), 0,
    'Sentinel fight status must not show the unchosen charm bonus');
  await winBattle(leavePage);
  await leavePage.getByRole('button', { name: 'Approach the sealed door' }).click();
  await leavePage.locator('[data-phase="end"]').waitFor();
  await leavePage.getByText(/You recovered the Sentinel Sigil/).waitFor();
  assert.deepEqual(leaveRequests, [], 'Leave branch must remain an unsaved, backend-free preview');
  await leavePage.close();

  console.log('PASS: real Chromium Crypt Rat → inscription → Ember Charm → Sentinel → sealed door,');
  console.log('clue retention, 320px scroll/tap both endings and restart, 320/390px no overflow, no unexpected network requests.');
  console.log('NOT covered: hosted QA, authenticated rewards, physical iPhone Safari or permanent loot.');
} finally {
  await browser.close();
}
