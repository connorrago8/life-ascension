/**
 * Source-backed, mock-only L1 starter vs proposed L5 basic helmet QA.
 * Generates full-body comparisons at 320/375/390/430 CSS px, color and gray.
 * No Supabase client, level check, inventory grant, or persistence.
 * Run: node scripts/generate-helmet-mobile-qa.mjs [outdir] [--capture]
 * Capture requires sandboxed Chromium as an unprivileged user.
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
const modes = ['color', 'grayscale'];
const outArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const outDir = resolve(outArg || join(root, 'artifacts', 'helmet-mobile-qa'));
const capture = process.argv.includes('--capture');
if (capture && typeof process.getuid === 'function' && process.getuid() === 0) {
  throw new Error('Root Chromium capture forbidden: use a sandboxed non-root runner.');
}
const browser = process.env.CHROMIUM_BIN || 'chromium';
function compile(source) {
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
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
  const helmetSource = await readFile(join(root, 'components/preview/HelmetHeadLayer.tsx'), 'utf8');
  const characterSource = await readFile(join(root, 'components/preview/HomeCharacter.tsx'), 'utf8');
  assert.match(characterSource, /helmetPreviewStage/, 'requires opt-in helmet renderer');
  const stage = execute(compile(stageSource), require);
  const waist = execute(compile(waistSource), (name) => name.includes('beltProgression') ? stage : require(name));
  const helmet = execute(compile(helmetSource), require);
  const character = execute(compile(characterSource), (name) =>
    name.includes('BeltWaistLayer') ? waist :
    name.includes('HelmetHeadLayer') ? helmet :
    name.includes('characterRender') ? { homeAriaLabel: () => 'Adventurer — visual QA only' } :
    require(name));
  assert.equal(typeof character.HomeCharacter, 'function');
  return character.HomeCharacter;
}
const model = Object.freeze({
  name: 'Adventurer', skin: '#ccb18d', skinShadow: '#a78469',
  hair: '#63422e', hairHighlight: '#ab8765', eye: '#332a25',
  tunic: '#386147', tunicLight: '#72957b',
  trousers: '#5c4c3b', trousersLight: '#81715e',
  boots: '#413329', bootsLight: '#706052',
  belt: '#76533b', hood: null, hoodLight: null,
  mainHand: 'staff', mainHandAccent: '#60422b', mainHandAccentLight: '#bba587',
});
function renderStage(Component, stage) {
  const svg = renderToStaticMarkup(React.createElement(Component, {
    model, beltPreviewStage: 'starter', helmetPreviewStage: stage, idPrefix: 'helmet-qa-' + stage,
  }));
  assert.match(svg, /viewBox="0 0 240 380"/);
  assert.match(svg, /data-prop="staff"/);
  assert.match(svg, /data-waist-part="starter-tie"/);
  assert.doesNotMatch(svg, /data-waist-part="earned-buckle"/);
  assert.match(svg, /role="img"/);
  if (stage === 'proposed') {
    assert.match(svg, /data-helmet-preview="proposed"/);
  } else {
    assert.doesNotMatch(svg, /data-helmet-preview/);
  }
  assert.doesNotMatch(svg, /data-helmet-preview="owned"|data-helmet-preview="equipped"/);
  return svg;
}
function makePage(width, mode, starter, helmet) {
  const gray = mode === 'grayscale' ? 'filter:grayscale(1);' : '';
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>PROPOSED L1 vs L5 helmet — ' + width + 'px ' + mode + '</title>',
    '<style>*{box-sizing:border-box}html,body{margin:0;background:#131923;color:#f4f0e8;font-family:system-ui,sans-serif}',
    'body{width:100%;min-height:100vh;padding:10px}h1{font-size:14px;margin:0 0 6px}',
    'p{font-size:11px;line-height:1.4;margin:0 0 10px}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
    '.card{min-width:0;border:1px solid #697580;border-radius:8px;background:#29323d;padding:4px}',
    'h2{text-align:center;font-size:12px;line-height:15px;min-height:30px;margin:4px 0}',
    '.card svg{display:block;width:100%;height:auto;' + gray + '}',
    '.warning{margin-top:12px;color:#ffd69a;font-weight:600}</style></head><body>',
    '<h1>Character evolution · ' + width + 'px · ' + mode + '</h1>',
    '<p>Identical pose, weapon, body scale and starter belt. Helmet preview is explicitly opt-in.</p>',
    '<main class="pair"><section class="card"><h2>Level 1 · starter</h2>' + starter + '</section>',
    '<section class="card"><h2>Level 5 · basic helmet</h2>' + helmet + '</section></main>',
    '<p class="warning">PROPOSED ART · NOT EARNED, OWNED, EQUIPPED OR SAVED.</p>',
    '</body></html>',
  ].join('\n');
}
const Character = await loadCharacter();
const starter = renderStage(Character, 'starter');
const helmet = renderStage(Character, 'proposed');
await mkdir(outDir, { recursive: true });
const manifest = { kind: 'source-backed-opt-in-helmet-visual-qa', status: 'proposed-only-no-entitlement',
  widths, modes, pose: 'identical', weapon: 'staff', belt: 'starter', files: [], browserScreenshotsCaptured: capture };
const profileDir = capture ? await mkdtemp(join(tmpdir(), 'helmet-qa-chromium-')) : null;
try {
  for (const width of widths) for (const mode of modes) {
    const name = 'helmet-' + width + '-' + mode;
    const html = join(outDir, name + '.html');
    await writeFile(html, makePage(width, mode, starter, helmet), 'utf8');
    const item = { width, mode, html: name + '.html' };
    if (capture) {
      const png = join(outDir, name + '.png');
      execFileSync(browser, ['--headless', '--disable-gpu', '--hide-scrollbars',
        '--disable-background-networking', '--no-first-run', '--user-data-dir=' + profileDir,
        '--force-device-scale-factor=1', '--window-size=' + width + ',760',
        '--screenshot=' + png, pathToFileURL(html).href], { stdio: 'pipe', timeout: 30000 });
      const bytes = await readFile(png);
      assert.ok(bytes.length >= 24 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
      assert.equal(bytes.readUInt32BE(16), width, 'Screenshot viewport width mismatch');
      item.png = name + '.png';
      item.pixelDimensions = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }
    manifest.files.push(item);
  }
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
} finally { if (profileDir) await rm(profileDir, { recursive: true, force: true }); }
console.log('HELMET_QA ' + JSON.stringify({ files: manifest.files.length, capture, widths, modes }));
