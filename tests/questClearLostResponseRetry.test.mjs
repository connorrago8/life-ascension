/** Beta #43: source-backed browser-journal regression, mocked persistence only.
 * Exercises the real QuestProgressControls submit/retryPending handler bodies.
 * Not authenticated Supabase, PostgreSQL, browser rendering, or iPhone evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { nextProgressDelta } from '../lib/preview/progressDelta.mjs';

async function parser() {
  const source = readFileSync(new URL('../lib/preview/pendingProgress.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal((compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  return (await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(compiled.outputText))).parsePendingProgress;
}

function actualHandlers() {
  const source = readFileSync(new URL('../components/QuestProgressControls.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('QuestProgressControls.tsx', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const handlers = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ['submit', 'retryPending'].includes(node.name.getText(tree))) {
      assert.ok(node.initializer, 'Expected a real handler body');
      const compiled = ts.transpileModule('(' + node.initializer.getText(tree) + ')', {
        compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
        reportDiagnostics: true,
      });
      assert.equal((compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
      handlers.set(node.name.getText(tree), compiled.outputText);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.equal(handlers.size, 2, 'Both production handlers must be source-extracted');
  return handlers;
}

test('Clear 7/10 → lost acknowledgement → refresh → original-ID retry stays at zero without XP', async () => {
  const parsePendingProgress = await parser();
  const handlers = actualHandlers();
  const storageKey = 'life-progress-pending:quest-1';
  const journal = new Map();
  const localStorage = {
    getItem: key => journal.get(key) ?? null,
    setItem: (key, value) => { journal.set(key, value); },
    removeItem: key => { journal.delete(key); },
  };
  const operations = new Map();
  const calls = [];
  let persistedAmount = 7;
  let xp = 0;
  let generated = 0;
  let loseAcknowledgement = true;
  const onLog = async (instanceId, requestId, delta) => {
    calls.push({ instanceId, requestId, delta });
    if (!operations.has(requestId)) {
      operations.set(requestId, { instanceId, delta });
      persistedAmount += delta;
      assert.ok(persistedAmount >= 0 && persistedAmount <= 10);
      if (persistedAmount === 10) xp++;
    } else {
      assert.deepEqual(operations.get(requestId), { instanceId, delta }, 'Idempotent retry payload cannot change');
    }
    if (loseAcknowledgement) {
      loseAcknowledgement = false;
      return 'retry'; // Server applied Clear, but browser never confirmed it.
    }
    return 'saved';
  };
  function mount(amount) {
    const state = {
      instance: { id: 'quest-1', status: 'available' },
      amount, target: 10, disabled: false, saving: false, storageError: false,
      retrying: parsePendingProgress(localStorage.getItem(storageKey)) !== null,
      storageKey, localStorage, parsePendingProgress, onLog,
      onJournalResolved: () => {},
      crypto: { randomUUID: () => 'request-' + ++generated },
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
  const delta = nextProgressDelta({ target: 10, amount: 7, increment: 2 }, 'clear');
  assert.equal(delta, -7, 'Clear must reverse the full persisted amount, not one increment');
  let ui = mount(7);
  ui.submit(delta);
  await settle();
  assert.equal(persistedAmount, 0, 'Server applied the first Clear');
  assert.equal(ui.state.retrying, true);
  assert.equal(ui.state.saveState, 'failed');
  assert.deepEqual(parsePendingProgress(localStorage.getItem(storageKey)), { id: 'request-1', delta: -7 });
  assert.equal(xp, 0);

  // The authenticated reload has the new server amount, but the unresolved journal remains.
  ui = mount(persistedAmount);
  assert.equal(ui.state.retrying, true);
  ui.submit(2); // A new operation must be blocked until the original resolves.
  assert.equal(generated, 1);
  ui.retryPending();
  await settle();
  assert.equal(ui.state.saveState, 'saved');
  assert.equal(ui.state.retrying, false);
  assert.equal(localStorage.getItem(storageKey), null);
  assert.equal(persistedAmount, 0, 'Retry must not apply -7 a second time');
  assert.equal(operations.size, 1);
  assert.equal(xp, 0, 'Clearing partial progress never awards XP');
  assert.deepEqual(calls, [
    { instanceId: 'quest-1', requestId: 'request-1', delta: -7 },
    { instanceId: 'quest-1', requestId: 'request-1', delta: -7 },
  ]);
});
