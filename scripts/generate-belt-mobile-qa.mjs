/**
 * Source-backed, unauthenticated belt screenshot fixture.
 * Run only on a branch containing Beta's optional beltPreviewStage renderer.
 * This script renders React to static HTML; it never opens a Supabase session.
 *
 * Usage:
 *   node scripts/generate-belt-mobile-qa.mjs [output-dir]
 *   CHROMIUM_BIN=chromium node scripts/generate-belt-mobile-qa.mjs [output-dir] --capture
 * Generates 16 self-contained HTML pages (4 widths x 2 hand props x 2 color modes).
 * --capture additionally saves 16 actual browser PNGs when Chromium is available.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const widths = [320, 375, 390, 430];
const hands = ['staff', 'lantern'];
const modes = ['color', 'grayscale'];
const outputArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const outDir = resolve(outputArg || join(root, 'artifacts', 'belt-mobile-qa'));
const capture = process.argv.includes('--capture');
const browser = process.env.CHROMIUM_BIN || 'chromium';

function compile(source) {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  return result.outputText;
}

function execute(js, resolver) {
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)(resolver, mod, mod.exports);
  return mod.exports;
}

async function loadCharacter() {
  const stageSource = await readFile(join(root, 'lib/preview/beltProgression.ts'), 'utf8');
  const waistSource = await readFile(join(root, 'components/preview/BeltWaistLayer.tsx'), 'utf8');
  const characterSource = await readFile(join(root, 'components/preview/HomeCharacter.tsx'), 'utf8');
  assert.match(characterSource, /beltPreviewStage/, 'requires Beta opt-in renderer; do not fake an unlocked belt');
  const stage = execute(compile(stageSource), require);
  const waist = execute(compile(waistSource), (name) =>
    name.includes('beltProgression') ? stage : require(name));
  const character = execute(compile(characterSource), (name) =>
    name.includes('BeltWaistLayer') ? waist :
    name.includes('characterRender') ? { homeAriaLabel: () => 'Adventurer — visual QA only' } :
    require(name));
  assert.equal(typeof character.HomeCharacter, 'function');
  return character.HomeCharacter;
}

const baseModel = Object.freeze({
  name: 'Adventurer',
  skin: '#ccb18d', skinShadow: '#a78469',
  hair: '#63422e', hairHighlight: '#ab8765', eye: '#332a25',
  tunic: '#386147', tunicLight: '#72957b',
  trousers: '#5c4c3b', trousersLight: '#81715e',
  boots: '#413329', bootsLight: '#706052',
  belt: '#76533b', hood: null, hoodLight: null,
  mainHand: 'staff',
  mainHandAccent: '#60422b', mainHandAccentLight: '#bba587',
});

function renderStage(Component, width, hand, stage) {
  const model = { ...baseModel, mainHand: hand };
  const svg = renderToStaticMarkup(React.createElement(Component, {
    model, beltPreviewStage: stage, idPrefix: 'qa-' + width + '-' + hand + '-' + stage,
  }));
  assert.match(svg, new RegExp('data-belt-stage="' + stage + '"'));
  assert.match(svg, new RegExp('data-prop="' + hand + '"'));
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label=/);
  assert.match(svg, /viewBox="0 0 240 380"/);
  assert.doesNotMatch(svg, /M96 111 L141 216/, 'old diagonal strap must not stack');
  if (stage === 'starter') {
    assert.match(svg, /data-waist-part="starter-tie"/);
    assert.doesNotMatch(svg, /data-waist-part="earned-buckle"/);
  } else {
    assert.match(svg, /data-waist-part="earned-belt"/);
    assert.match(svg, /data-waist-part="earned-buckle"/);
    assert.doesNotMatch(svg, /data-waist-part="starter-tie"/);
  }
  return svg;
}

function makePage(width, hand, mode, starter, equipped) {
  const gray = mode === 'grayscale' ? 'filter:grayscale(1);' : '';
  const title = width + 'px — ' + hand + ' — ' + mode;
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Preview only — ' + title + '</title>',
    '<style>',
    '*{box-sizing:border-box}html,body{margin:0;padding:0;background:#131923;color:#f3f0e9;font-family:system-ui,sans-serif}',
    'body{width:100%;min-height:100vh;padding:10px}',
    'h1{font-size:15px;margin:0 0 6px}p{font-size:10px;margin:0 0 10px;color:#c7c9cc}',
    '.pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}',
    '.card{min-width:0;padding:4px;border:1px solid #67717c;border-radius:8px;background:#28313c}',
    '.card h2{text-align:center;font-size:12px;margin:4px 0}',
    '.card svg{display:block;width:100%;height:auto;' + gray + '}',
    '.warning{margin-top:12px;font-size:11px;color:#ffd69a}',
    '</style></head><body>',
    '<h1>Full-character belt comparison · ' + title + '</h1>',
    '<p>Same model and avatar scale. Visual QA only. Not earned, saved or unlocked.</p>',
    '<main class="pair">',
    '<section class="card"><h2>Starter tie</h2>' + starter + '</section>',
    '<section class="card"><h2>Level 2 belt — concept</h2>' + equipped + '</section>',
    '</main>',
    '<p class="warning">PROPOSED ART — NO SERVER ENTITLEMENT OR XP CLAIM.</p>',
    '</body></html>',
  ].join('\n');
}

await mkdir(outDir, { recursive: true });
const HomeCharacter = await loadCharacter();
const manifest = {
  kind: 'unauthenticated-static-belt-visual-qa',
  basedOn: 'HomeCharacter opt-in beltPreviewStage + BeltWaistLayer',
  status: 'proposed-only-not-owned-or-saved',
  widths, hands, modes, files: [],
  browserScreenshotsCaptured: capture,
};
for (const width of widths) {
  for (const hand of hands) {
    const starter = renderStage(HomeCharacter, width, hand, 'starter');
    const equipped = renderStage(HomeCharacter, width, hand, 'equipped');
    for (const mode of modes) {
      const name = 'belt-' + width + '-' + hand + '-' + mode;
      const htmlPath = join(outDir, name + '.html');
      await writeFile(htmlPath, makePage(width, hand, mode, starter, equipped), 'utf8');
      const item = { width, hand, mode, html: name + '.html' };
      if (capture) {
        const pngPath = join(outDir, name + '.png');
        execFileSync(browser, [
          '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
          '--force-device-scale-factor=1', '--window-size=' + width + ',760',
          '--screenshot=' + pngPath, pathToFileURL(htmlPath).href,
        ], { stdio: 'pipe', timeout: 30000 });
        item.png = name + '.png';
      }
      manifest.files.push(item);
    }
  }
}
await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Created ' + manifest.files.length + ' static full-character QA pages in ' + outDir);
console.log(capture ? 'Captured browser screenshots; inspect actual pixels and clipping.' :
  'No screenshots captured. Rerun with --capture and Chromium to generate PNG evidence.');
