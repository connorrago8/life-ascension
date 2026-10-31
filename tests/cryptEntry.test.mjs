import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Adventure map Forgotten Crypt entry opens the new delve', () => {
  const hub = read('components/play/AdventureHub.tsx');
  assert.match(hub, /export const CRYPT_ENTRY_HREF = '\/play\/delve';/);
  // Tapping the map node and the Enter button both target the delve.
  assert.match(hub, /if \(location\.kind === 'preview'\) router\.push\(entryHref\)/);
  assert.match(hub, /<Link className="btn adv-enter" href=\{entryHref\}>\{hasRun \? 'Continue run' : HUB\.enter\}<\/Link>/);
  assert.match(hub, /useState\(CRYPT_ENTRY_HREF\)/);
  assert.doesNotMatch(hub, /href="\/play\/crypt"|push\('\/play\/crypt'\)/);
});

test('no app entry point links to the legacy /play/crypt route', () => {
  const roots = ['app', 'components', 'lib'];
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(tsx?|mjs|js)$/.test(name)) continue;
      const src = readFileSync(full, 'utf8');
      if (/href=["'{`]*\/play\/crypt|push\(\s*['"`]\/play\/crypt/.test(src)) offenders.push(full);
    }
  };
  for (const root of roots) walk(new URL(`../${root}`, import.meta.url).pathname);
  assert.deepEqual(offenders, []);
});

test('Character route does not show the sample LEVEL 7 title on the gear panel', () => {
  const screen = read('components/preview/CharacterScreen.tsx');
  assert.match(screen, /\{!displayName && gearView\.canChange && <p className="level-line">/);
  const page = read('app/(app)/character/page.tsx');
  assert.match(page, /<CharacterScreen displayName=\{state\.name\}/);
});
