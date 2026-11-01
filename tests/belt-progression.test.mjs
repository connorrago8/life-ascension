import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadBeltStage() {
  const source = await readFile(new URL('../lib/preview/beltProgression.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import('data:text/javascript;charset=utf-8,' + encodeURIComponent(compiled.outputText));
}

test('starter waist treatment has no prematurely displayed earned hardware', async () => {
  const { beltVisual } = await loadBeltStage();
  assert.deepEqual(beltVisual('starter'), {
    stage: 'starter',
    showTie: true,
    showLeather: false,
    showBuckle: false,
    showPouch: false,
    showDiagonalStrap: false,
  });
});

test('first belt upgrade changes silhouette without adding future-stage accessories', async () => {
  const { beltVisual } = await loadBeltStage();
  assert.deepEqual(beltVisual('equipped'), {
    stage: 'equipped',
    showTie: false,
    showLeather: true,
    showBuckle: true,
    showPouch: false,
    showDiagonalStrap: false,
  });
  assert.notDeepEqual(beltVisual('equipped'), beltVisual('starter'));
  assert.ok(Object.isFrozen(beltVisual('starter')));
  assert.ok(Object.isFrozen(beltVisual('equipped')));
});
