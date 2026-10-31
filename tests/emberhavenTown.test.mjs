import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/(app)/play/emberhaven/page.tsx', import.meta.url), 'utf8');

test('Emberhaven connects to existing quest, character, and adventure routes', () => {
  for (const route of ['/quests', '/play/emberhaven/blacksmith', '/play']) {
    assert.match(source, new RegExp(`href: '${route.replaceAll('/', '\\/')}'`));
  }
});

test('Emberhaven has three unique destinations and does not promise a live shop', () => {
  for (const title of ['The Noticeboard', 'The Blacksmith', 'The Trail Gate']) {
    assert.equal(source.split(`name: '${title}'`).length - 1, 1);
  }
  assert.match(source, /No shop, crafting, or rewards are active here/);
});

test('Emberhaven is navigation-only with no account or run mutations', () => {
  assert.doesNotMatch(source, /supabase\(|\.rpc\(|localStorage\.|sessionStorage\.|fetch\(|router\.push\(/);
});

test('Emberhaven exposes landmarks and respects mobile safe areas', () => {
  assert.match(source, /aria-labelledby="emberhaven-title"/);
  assert.match(source, /aria-label="Town destinations"/);
  assert.match(source, /safe-area-inset-bottom/);
  assert.match(source, /minHeight: 44/);
});

const forge = readFileSync(new URL('../app/(app)/play/emberhaven/blacksmith/page.tsx', import.meta.url), 'utf8');

test('Blacksmith makes no false account-inventory promises', () => {
  assert.match(forge, /demonstration content, not verified account inventory/);
  assert.match(forge, /href="\/character"/);
  assert.match(forge, /href="\/play\/emberhaven"/);
  assert.doesNotMatch(forge, /supabase\(|\.rpc\(|localStorage\.|sessionStorage\.|fetch\(/);
});

test('Town adventure gate does not assert Crypt unlock state', () => {
  assert.match(source, /Crypt availability depends on the deployed game version/);
  assert.match(source, /No shop, crafting, or rewards are active here/);
});
