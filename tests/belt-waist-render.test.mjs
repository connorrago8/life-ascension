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
  const stageJs = compile(stageSource, ts.JsxEmit.None);
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
