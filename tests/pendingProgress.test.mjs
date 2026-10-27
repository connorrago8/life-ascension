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

// Executes the actual submit/retryPending handler bodies extracted from the
// PR32 TSX source, with browser storage and RPC replaced by isolated mocks.
// No React rendering, network calls, database writes, or XP grants occur.
import vm from 'node:vm';

async function loadProgressHandlers() {
  const source = await readFile(new URL('../components/QuestProgressControls.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('QuestProgressControls.tsx', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const handlers = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ['submit', 'retryPending'].includes(node.name.getText(tree))) {
      const code = `(${node.initializer.getText(tree)})`;
      const compiled = ts.transpileModule(code, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
        reportDiagnostics: true,
      });
      assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
      handlers.set(node.name.getText(tree), compiled.outputText);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.equal(handlers.size, 2, 'Expected to extract both real component handlers');
  return handlers;
}

test('actual QuestProgressControls handlers preserve request IDs across ambiguous save, reload, retry and Undo', async () => {
  const { parsePendingProgress } = await loadParser();
  const handlers = await loadProgressHandlers();
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
  const ledger = new Map();
  const calls = [];
  let credited = 0;
  let loseNextResponse = true;
  async function onLog(instanceId, requestId, delta) {
    calls.push({ instanceId, requestId, delta });
    if (!ledger.has(requestId)) { ledger.set(requestId, delta); credited += delta; }
    else assert.equal(ledger.get(requestId), delta, 'Retry cannot mutate the original delta');
    if (loseNextResponse) { loseNextResponse = false; throw new Error('Simulated lost response'); }
    return 'saved';
  }
  let generated = 0;
  function mount(amount) {
    const state = { disabled: false, saving: false, storageError: false,
      retrying: parsePendingProgress(storage.getItem('life-progress-pending:q1')) !== null,
      amount, target: 10, instance: { id: 'q1' }, storageKey: 'life-progress-pending:q1',
      parsePendingProgress, localStorage: storage, onLog,
      crypto: { randomUUID: () => `generated-id-${++generated}` },
      setRetrying: value => { state.retrying = value; },
      setSaving: value => { state.saving = value; },
      setStorageError: value => { state.storageError = value; },
      setSaveState: value => { state.saveState = value; },
      setCustom: value => { state.custom = value; },
    };
    const context = vm.createContext(state);
    return {
      state,
      submit: vm.runInContext(handlers.get('submit'), context),
      retryPending: vm.runInContext(handlers.get('retryPending'), context),
    };
  }
  const settle = () => new Promise(resolve => setImmediate(resolve));

  // Server applied +3, but the browser never received the confirmation.
  let ui = mount(0);
  ui.submit(3);
  await settle();
  assert.equal(ui.state.retrying, true);
  assert.equal(ui.state.saveState, 'failed');
  assert.equal(credited, 3);
  assert.deepEqual(parsePendingProgress(storage.getItem(ui.state.storageKey)),
    { id: 'generated-id-1', delta: 3 });

  // A reload must not mint a second request ID or allow a new operation.
  ui = mount(0);
  assert.equal(ui.state.retrying, true);
  ui.submit(3);
  assert.equal(generated, 1);
  ui.retryPending();
  await settle();
  assert.equal(credited, 3, 'Same request ID must not double-credit');
  assert.equal(ui.state.saveState, 'saved');
  assert.equal(storage.getItem(ui.state.storageKey), null);
  assert.deepEqual(calls.map(call => [call.requestId, call.delta]),
    [['generated-id-1', 3], ['generated-id-1', 3]]);

  // Undo is a separate negative operation, and its ambiguous response is retried unchanged.
  loseNextResponse = true;
  ui = mount(3);
  ui.submit(-2);
  await settle();
  assert.equal(credited, 1);
  assert.deepEqual(parsePendingProgress(storage.getItem(ui.state.storageKey)),
    { id: 'generated-id-2', delta: -2 });
  ui = mount(3);
  ui.retryPending();
  await settle();
  assert.equal(credited, 1, 'Undo retry must not apply twice');
  assert.equal(storage.getItem(ui.state.storageKey), null);
  assert.equal(ledger.size, 2);
  assert.deepEqual(calls.map(call => [call.requestId, call.delta]),
    [['generated-id-1', 3], ['generated-id-1', 3],
     ['generated-id-2', -2], ['generated-id-2', -2]]);
});
