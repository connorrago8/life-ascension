import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const compile = (source, jsx = ts.JsxEmit.None) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx },
}).outputText;
const execute = (js, resolver) => {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(resolver, module, module.exports);
  return module.exports;
};

async function loadCharacter() {
  const stage = execute(compile(await readFile(new URL('../lib/preview/beltProgression.ts', import.meta.url), 'utf8')), require);
  const waist = execute(compile(await readFile(new URL('../components/preview/BeltWaistLayer.tsx', import.meta.url), 'utf8'), ts.JsxEmit.ReactJSX),
    (name) => name.includes('beltProgression') ? stage : require(name));
  return execute(compile(await readFile(new URL('../components/preview/HomeCharacter.tsx', import.meta.url), 'utf8'), ts.JsxEmit.ReactJSX),
    (name) => name.includes('BeltWaistLayer') ? waist : name.includes('characterRender') ? { homeAriaLabel: () => 'Adventurer' } : require(name)).HomeCharacter;
}
const model = {
  name: 'Adventurer', skin: '#ccb18d', skinShadow: '#a78469', hair: '#63422e',
  hairHighlight: '#ab8765', eye: '#332a25', tunic: '#386147',
  tunicLight: '#72957b', trousers: '#5c4c3b', trousersLight: '#81715e',
  boots: '#413329', bootsLight: '#706052', belt: '#76533b',
  hood: null, hoodLight: null, mainHand: 'staff',
  mainHandAccent: '#60422b', mainHandAccentLight: '#bba587',
};

test('default character remains unchanged and shows neither proof stage', async () => {
  const HomeCharacter = await loadCharacter();
  const html = renderToStaticMarkup(React.createElement(HomeCharacter, { model }));
  assert.doesNotMatch(html, /data-belt-stage=/);
  assert.match(html, /M96 111 L141 216/);
});

test('preview starter renders tie instead of inherited hardware', async () => {
  const HomeCharacter = await loadCharacter();
  const html = renderToStaticMarkup(React.createElement(HomeCharacter, { model, beltPreviewStage: 'starter' }));
  assert.match(html, /data-belt-stage="starter"/);
  assert.match(html, /data-waist-part="starter-tie"/);
  assert.doesNotMatch(html, /data-waist-part="earned-buckle"/);
  assert.doesNotMatch(html, /M96 111 L141 216/);
});

test('preview equipped renders one belt and buckle, not inherited straps or pouches', async () => {
  const HomeCharacter = await loadCharacter();
  const html = renderToStaticMarkup(React.createElement(HomeCharacter, { model, beltPreviewStage: 'equipped' }));
  assert.match(html, /data-belt-stage="equipped"/);
  assert.match(html, /data-waist-part="earned-belt"/);
  assert.match(html, /data-waist-part="earned-buckle"/);
  assert.doesNotMatch(html, /data-waist-part="starter-tie"/);
  assert.doesNotMatch(html, /M96 111 L141 216/);
});
