import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'public/assets/ashen-march');

test('Ashen March concept manifest references existing SVG assets', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'asset-manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'proposed_visual_concepts_only');
  assert.ok(Array.isArray(manifest.assets) && manifest.assets.length >= 2);
  for (const asset of manifest.assets) {
    assert.ok(asset.file.endsWith('.svg'), `unexpected asset type: ${asset.file}`);
    await access(resolve(root, asset.file));
    assert.ok(Array.isArray(asset.states) && asset.states.length > 0);
  }
});

test('concept SVGs are standalone and include accessible descriptions', async () => {
  const files = ['ashen-march-telegraph-concepts.svg', 'ashen-march-active-recovery-concepts.svg'];
  for (const file of files) {
    const svg = await readFile(resolve(root, file), 'utf8');
    assert.match(svg, /^<svg\b/);
    assert.match(svg, /<title>/);
    assert.match(svg, /<desc>/);
    assert.match(svg, /<\/svg>\s*$/);
    assert.doesNotMatch(svg, /<script\b/i);
  }
});

test('review page stays a static asset review and does not claim game integration', async () => {
  const html = await readFile(resolve(root, 'review.html'), 'utf8');
  assert.match(html, /PROPOSED — NOT GAMEPLAY/);
  assert.match(html, /reduced-motion/i);
  assert.match(html, /320–430 CSS px/);
  assert.doesNotMatch(html, /<script\b/i);
});
