/**
 * Real CharacterScreen browser acceptance on an unprivileged local Chromium.
 * Uses a development-only synthetic ownership/equip fixture, NOT Supabase.
 * Does not prove authenticated database persistence or iPhone Safari behavior.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

if (typeof process.getuid === 'function' && process.getuid() === 0) {
  throw new Error('Refusing to run Chromium as root.');
}
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  throw new Error('Playwright required in isolated browser QA runner.');
}
const output = 'artifacts/character-gear';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  ...(process.env.CHROMIUM_BIN ? { executablePath: process.env.CHROMIUM_BIN } : {}),
});
const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:3000';

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const accountWrites = [];
  page.on('request', request => {
    if (request.method() !== 'GET' &&
        /supabase\.co|\/api\/(?:quests?|progress|xp|equipment|inventory)/i.test(request.url())) {
      accountWrites.push(request.method() + ' ' + request.url());
    }
  });
  await page.goto(baseURL + '/qa/character-gear');
  await page.getByRole('heading', { name: /Character gear interaction QA/ }).waitFor();
  await page.locator('[data-qa-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: 'Reset mock ownership' }).click();

  const avatar = page.locator('svg[data-character-style="home"]');
  await avatar.waitFor();
  const imageLabel = () => avatar.getAttribute('aria-label');
  assert.doesNotMatch(await imageLabel(), /Ashen Hood/i);
  assert.equal(await page.getByRole('button', { name: 'Equip Ashen Hood', exact: true }).count(), 0,
    'Unverified character must not offer equipment writes');

  await page.getByRole('button', { name: 'Mock server: invalid unowned equip' }).click();
  assert.equal(await page.getByRole('button', { name: 'Equip Ashen Hood', exact: true }).count(), 0,
    'Equipped-but-unowned mock must fail closed');
  assert.doesNotMatch(await imageLabel(), /Ashen Hood/i);

  await page.getByRole('button', { name: 'Mock server: grant Ashen Hood' }).click();
  await page.getByRole('button', { name: 'Equip Ashen Hood', exact: true }).waitFor();
  assert.doesNotMatch(await imageLabel(), /Ashen Hood/i,
    'Ownership alone must not draw armor before equip');

  await page.getByRole('button', { name: 'Equip Ashen Hood', exact: true }).click();
  await page.getByRole('button', { name: 'Unequip Ashen Hood', exact: true }).waitFor();
  assert.match(await imageLabel(), /Ashen Hood/i,
    'Confirmed equip must change the actual character SVG');
  await page.screenshot({ path: join(output, 'earned-hood-equipped-390.png'), fullPage: true });

  await page.reload();
  await page.locator('[data-qa-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: 'Unequip Ashen Hood', exact: true }).waitFor();
  assert.match(await imageLabel(), /Ashen Hood/i,
    'Reload must rehydrate the synthetic confirmed equipment snapshot');

  await page.getByRole('button', { name: 'Unequip Ashen Hood', exact: true }).click();
  await page.getByRole('button', { name: 'Equip Ashen Hood', exact: true }).waitFor();
  assert.doesNotMatch(await imageLabel(), /Ashen Hood/i,
    'Unequip must remove the visible hood');
  await page.reload();
  await page.locator('[data-qa-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: 'Equip Ashen Hood', exact: true }).waitFor();
  assert.doesNotMatch(await imageLabel(), /Ashen Hood/i,
    'Reload must preserve synthetic unequipped state');

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
      `Character equipment must not overflow the ${width}px viewport`);
    await page.screenshot({ path: join(output, `owned-unequipped-${width}.png`), fullPage: true });
  }
  assert.deepEqual(accountWrites, [], 'Local Character fixture must never write account data');
  console.log('PASS: real Chromium CharacterScreen unowned denial → earned → equip/visible hood →');
  console.log('mock refresh persistence → unequip/refresh, 320/390px, zero account writes.');
  console.log('NOT covered: real auth, server RPCs, hosted QA, physical iPhone or database persistence.');
} finally {
  await browser.close();
}
