import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

const require = createRequire(import.meta.url);

/** Transpile the isolated TSX under test without changing app runtime. */
async function loadBeltLayer() {
  const stageSource = await readFile(new URL('../lib/preview/beltProgression.ts', import.meta.url), 'utf8');
  const componentSource = await readFile(new URL('../components/preview/BeltWaistLayer.tsx', import.meta.url), 'utf8');
  const compile = (source, jsx) => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx },
    reportDiagnostics: true,
  });
  const stageJs = compile(stageSource, ts.JsxEmit.ReactJSX);
  const componentJs = compile(componentSource, ts.JsxEmit.ReactJSX);
  for (const compiled of [stageJs, componentJs]) {
    const errors = (compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  }
  const stage = { exports: {} };
  const run = (text, mod, resolver) => new Function('require', 'module', 'exports', text)(resolver, mod, mod.exports);
  run(stageJs.outputText, stage, require);
  const component = { exports: {} };
  run(componentJs.outputText, component, (specifier) =>
    specifier.includes('beltProgression') ? stage.exports : require(specifier));
  return component.exports.BeltWaistLayer;
}

test('starter waist HTML does not render first-upgrade hardware', async () => {
  const Layer = await loadBeltLayer();
  const html = renderToStaticMarkup(React.createElement('svg', null,
    React.createElement(Layer, { stage: 'starter' })));
  assert.match(html, /data-belt-stage="starter"/);
  assert.match(html, /data-waist-part="starter-tie"/);
  assert.doesNotMatch(html, /data-waist-part="earned-belt"/);
  assert.doesNotMatch(html, /data-waist-part="earned-buckle"/);
});

test('earned belt HTML renders leather and buckle, never later accessories', async () => {
  const Layer = await loadBeltLayer();
  const html = renderToStaticMarkup(React.createElement('svg', null,
    React.createElement(Layer, { stage: 'equipped', color: '#654321' })));
  assert.match(html, /data-belt-stage="equipped"/);
  assert.match(html, /data-waist-part="earned-belt"/);
  assert.match(html, /data-waist-part="earned-buckle"/);
  assert.match(html, /#654321/i);
  assert.doesNotMatch(html, /data-waist-part="starter-tie"/);
  assert.doesNotMatch(html, /pouch|diagonal-strap|charm/i);
});


test('waist stage remains visually distinguishable at compact avatar scales', async () => {
  const Layer = await loadBeltLayer();
  const starter = renderToStaticMarkup(React.createElement('svg', { viewBox: '0 0 240 380' },
    React.createElement(Layer, { stage: 'starter' })));
  const equipped = renderToStaticMarkup(React.createElement('svg', { viewBox: '0 0 240 380' },
    React.createElement(Layer, { stage: 'equipped' })));

  // The plain tie hangs below the upgraded waistline; the earned buckle must
  // remain large enough to identify when the entire avatar is displayed small.
  assert.match(starter, /M120 208 L117 220 121 231/);
  assert.doesNotMatch(equipped, /M120 208 L117 220 121 231/);
  assert.match(equipped, /M86 198 Q120 194 154 198/);
  assert.doesNotMatch(starter, /M86 198 Q120 194 154 198/);

  const buckle = equipped.match(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" rx="2" fill="#C8AC77"/);
  assert.ok(buckle, 'earned buckle must have an identifiable outer frame');
  const [x, y, width, height] = buckle.slice(1).map(Number);
  assert.ok(x >= 0 && y >= 0 && x + width <= 240 && y + height <= 380);
  for (const avatarWidth of [96, 120, 144, 160]) {
    assert.ok(width * avatarWidth / 240 >= 8,
      `buckle too narrow at ${avatarWidth}px avatar width`);
    assert.ok(height * avatarWidth / 240 >= 7,
      `buckle too short at ${avatarWidth}px avatar width`);
  }
  // Structural/scale regression only: actual 320/375/390/430 viewport
  // screenshots and grayscale/occlusion inspection remain separate QA gates.
});
