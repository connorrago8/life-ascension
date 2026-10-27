import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadParser() {
  const source = await readFile(new URL('../lib/preview/pendingProgress.ts', import.meta.url), 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  return import('data:text/javascript;charset=utf-8,' + encodeURIComponent(result.outputText));
}

test('retry journal survives a simulated refresh with the exact request ID and delta', async () => {
  const { parsePendingProgress } = await loadParser();
  const stored = JSON.stringify({ id: 'a1d2b3c4-e5f6-47a8-9b01-cdef12345678', delta: 3 });
  const beforeRefresh = parsePendingProgress(stored);
  const afterRefresh = parsePendingProgress(stored);
  assert.deepEqual(beforeRefresh, { id: 'a1d2b3c4-e5f6-47a8-9b01-cdef12345678', delta: 3 });
  assert.deepEqual(afterRefresh, beforeRefresh);
  assert.equal(parsePendingProgress(null), null);
});

test('negative undo delta is retained without changing the retry operation', async () => {
  const { parsePendingProgress } = await loadParser();
  assert.deepEqual(parsePendingProgress('{"id":"undo-req","delta":-2}'), { id: 'undo-req', delta: -2 });
});

test('malformed pending journal cannot be mistaken for a fresh operation', async () => {
  const { parsePendingProgress } = await loadParser();
  const bad = [
    '', '{', 'null', '[]', '{}',
    '{"id":"","delta":1}', '{"id":"  ","delta":1}',
    '{"id":4,"delta":1}', '{"id":"request","delta":0}',
    '{"id":"request","delta":1.5}', '{"id":"request","delta":"1"}',
    '{"id":"request","delta":9007199254740992}',
  ];
  for (const raw of bad) {
    assert.throws(() => parsePendingProgress(raw), Error, raw);
  }
});
