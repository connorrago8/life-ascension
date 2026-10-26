import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const demoDir = join(root, 'app/(app)/character/demo');

function listFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...listFiles(path));
    else files.push(path);
  }
  return files;
}

function resolveImport(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, join(base, 'index.ts'), join(base, 'index.tsx')];
  const found = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  assert.ok(found, `${relative(root, fromFile)} imports ${specifier}, which did not resolve`);
  return found;
}

function specifiers(source) {
  const found = [];
  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

function walk(file, seen) {
  const rel = relative(root, file);
  if (seen.has(rel)) return;
  seen.add(rel);
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /supabase/i, `${rel} mentions a database client`);
  assert.doesNotMatch(source, /\bfetch\s*\(/, `${rel} fetches`);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|EventSource/, `${rel} opens a network client`);
  assert.doesNotMatch(source, /get_lifetime_xp|\.rpc\s*\(/, `${rel} reads or writes XP`);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie/, `${rel} stores demo state`);
  assert.doesNotMatch(source, /from\(\s*['"]profiles['"]\s*\)/, `${rel} reads a profile`);
  for (const specifier of specifiers(source)) {
    assert.doesNotMatch(specifier, /supabase/i, `${rel} imports ${specifier}`);
    if (!specifier.startsWith('.')) continue;
    walk(resolveImport(file, specifier), seen);
  }
}

test('the item demo imports no database client and does no fetch', () => {
  const seen = new Set();
  for (const file of listFiles(demoDir)) walk(file, seen);
  const rels = [...seen];
  assert.ok(rels.includes('components/DemoCharacter.tsx'));
  assert.ok(rels.includes('lib/demoGear.ts'));
  assert.ok(rels.includes('components/spriteArt.ts'));
  assert.ok(rels.includes('components/AdventurerSprite.tsx'));
  assert.ok(rels.includes('components/CharacterViewer.tsx'));
  assert.equal(rels.some((file) => file.includes('supabase')), false);
  assert.equal(rels.some((file) => file.startsWith('supabase/migrations')), false);

  const server = readFileSync(join(root, 'lib/supabaseServer.ts'), 'utf8');
  const refresh = server.slice(server.indexOf('export async function refreshSession'));
  const guard = refresh.indexOf("pathname === '/character/demo'");
  const client = refresh.indexOf('createServerClient');
  assert.equal(guard !== -1 && guard < client, true);

  const nav = readFileSync(join(root, 'app/components/AppNav.tsx'), 'utf8');
  const skip = nav.indexOf('if (itemDemo)');
  const userLookup = nav.indexOf('auth.getUser');
  assert.equal(skip !== -1 && skip < userLookup, true);

  const character = readFileSync(join(root, 'app/(app)/character/page.tsx'), 'utf8');
  assert.match(character, /const owned: OwnedItem\[\] = \[\]/);
  assert.match(character, /href="\/character\/demo"/);
  assert.match(character, /Preview items demo/);
  assert.match(character, /demo-pill">Demo</);
});
