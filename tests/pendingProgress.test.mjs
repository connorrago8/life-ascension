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

test('reload checks the journal before enabling retry and fails closed on corrupt storage', async () => {
  const component = await readFile(new URL('../components/QuestProgressControls.tsx', import.meta.url), 'utf8');
  const effect = component.slice(component.indexOf('useEffect(() => {'), component.indexOf('}, [storageKey]);') + '}, [storageKey]);'.length);
  assert.match(effect, /parsePendingProgress\(localStorage\.getItem\(storageKey\)\)/);
  assert.match(effect, /setRetrying\(pending !== null\)/);
  assert.match(effect, /catch\s*\{\s*setRetrying\(false\);\s*setStorageError\(true\);/);
  assert.match(effect, /window\.addEventListener\('storage', refresh\)/);
  assert.doesNotMatch(effect, /!!localStorage\.getItem\(storageKey\)/);
  assert.match(component, /pending save record is unreadable/);
});


test('mock-only duplicate delivery of one persisted operation does not double-credit', async () => {
  // Contract-level mock, NOT evidence of the actual Supabase RPC or XP ledger.
  const { parsePendingProgress } = await loadParser();
  const journal = JSON.stringify({ id: 'stable-request-id', delta: 3 });
  const applied = new Map();
  let credited = 0;
  function mockApply(raw) {
    const operation = parsePendingProgress(raw);
    assert.ok(operation);
    if (!applied.has(operation.id)) {
      applied.set(operation.id, operation.delta);
      credited += operation.delta;
    } else {
      assert.equal(applied.get(operation.id), operation.delta);
    }
    return { requestId: operation.id, credited };
  }
  const ambiguousFirst = mockApply(journal);
  const retriedAfterRefresh = mockApply(journal);
  assert.deepEqual(retriedAfterRefresh, ambiguousFirst);
  assert.equal(credited, 3);
  assert.equal(applied.size, 1);
});

test('parser rejects nonfinite and nonnumeric JSON deltas without minting a replacement ID', async () => {
  const { parsePendingProgress } = await loadParser();
  const invalid = [
    '{"id":"same-id","delta":1e400}',
    '{"id":"same-id","delta":null}',
    '{"id":"same-id","delta":true}',
    '{"id":"same-id","delta":{}}',
    '{"id":"same-id","delta":[]}',
    '{"id":"same-id","delta":-9007199254740992}',
    '{"id":"same-id","delta":0}',
  ];
  for (const raw of invalid) assert.throws(() => parsePendingProgress(raw), Error, raw);
  const valid = parsePendingProgress('{"id":"same-id","delta":-9007199254740991}');
  assert.deepEqual(valid, { id: 'same-id', delta: -9007199254740991 });
});
