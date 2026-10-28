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
      amount, target: 10, instance: { id: 'q1', status: 'available' }, storageKey: 'life-progress-pending:q1',
      parsePendingProgress, localStorage: storage, onLog, onJournalResolved: () => {},
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


test('actual submit handler fails closed when journal is corrupt or storage persistence is denied', async () => {
  const { parsePendingProgress } = await loadParser();
  const handlers = await loadProgressHandlers();
  let minted = 0;
  let sent = 0;
  function attempt(raw, denyWrite) {
    const state = {
      disabled: false, saving: false, storageError: false, retrying: false,
      amount: 0, target: 10, instance: { id: 'q1', status: 'available' },
      storageKey: 'life-progress-pending:q1', parsePendingProgress,
      localStorage: {
        getItem: () => raw,
        setItem: () => { if (denyWrite) throw new Error('Simulated quota/storage denial'); },
        removeItem: () => {},
      },
      onLog: () => { sent++; return Promise.resolve('saved'); },
      onJournalResolved: () => {},
      crypto: { randomUUID: () => `new-id-${++minted}` },
      setStorageError: value => { state.storageError = value; },
      setRetrying: value => { state.retrying = value; },
      setSaving: value => { state.saving = value; },
      setSaveState: value => { state.saveState = value; },
      setCustom: () => {},
    };
    vm.runInNewContext(handlers.get('submit'), state)(1);
    return state;
  }

  const corrupt = attempt('{"id":', false);
  assert.equal(corrupt.storageError, true, 'Corrupt pending journal blocks new submission');
  assert.equal(minted, 0, 'No replacement ID minted for corrupt journal');
  assert.equal(sent, 0, 'Corrupt journal must not reach onLog');

  const denied = attempt(null, true);
  assert.equal(denied.storageError, true, 'Storage denial blocks new submission');
  assert.equal(minted, 1, 'UUID may be generated but cannot be sent without durable journal');
  assert.equal(denied.saving, false);
  assert.equal(sent, 0, 'No RPC attempt without successfully persisted journal');
});


test('completed and deferred instances cannot mint new progress operations; completed pending retry stays recoverable', async () => {
  const { parsePendingProgress } = await loadParser();
  const handlers = await loadProgressHandlers();
  const key = 'life-progress-pending:q1';
  for (const status of ['completed', 'deferred']) {
    const journal = new Map();
    let minted = 0;
    let sent = 0;
    const state = {
      disabled: false, saving: false, storageError: false, retrying: false,
      amount: 2, target: 10, instance: { id: 'q1', status }, storageKey: key,
      parsePendingProgress,
      localStorage: {
        getItem: name => journal.get(name) ?? null,
        setItem: (name, value) => journal.set(name, value),
        removeItem: name => journal.delete(name),
      },
      crypto: { randomUUID: () => `unexpected-${++minted}` },
      onLog: async () => { sent++; return 'saved'; },
      onJournalResolved: () => {},
      setRetrying: value => { state.retrying = value; },
      setSaving: value => { state.saving = value; },
      setStorageError: value => { state.storageError = value; },
      setSaveState: value => { state.saveState = value; },
      setCustom: () => {},
    };
    vm.runInNewContext(handlers.get('submit'), state)(2);
    assert.equal(minted, 0, `${status} must not mint a new request ID`);
    assert.equal(sent, 0, `${status} must not call the progress RPC`);
    assert.equal(journal.size, 0);
    if (status === 'completed') {
      journal.set(key, JSON.stringify({ id: 'original-pending-id', delta: 2 }));
      vm.runInNewContext(handlers.get('retryPending'), state)();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(sent, 1, 'Completed pending retry may replay its original operation');
      assert.equal(minted, 0, 'Retry must not mint another request ID');
      assert.equal(journal.has(key), false, 'Confirmed retry clears the pending journal');
    }
  }
});


test('completed quest with pending or malformed journal is discoverable after refresh', async () => {
  const { hasPendingCompletedRecovery } = await loadParser();
  const completed = [{ id: 'done', status: 'completed' }];
  const available = [{ id: 'active', status: 'available' }];
  const read = key => key === 'life-progress-pending:done' ? '{broken-journal' : null;
  assert.equal(hasPendingCompletedRecovery(completed, read), true,
    'Even a malformed pending receipt must reveal the Completed recovery path');
  assert.equal(hasPendingCompletedRecovery(available, read), false,
    'Active quests must not automatically open Completed');
  assert.equal(hasPendingCompletedRecovery(completed, () => null), false,
    'No pending receipt should preserve the collapsed default');
  assert.equal(hasPendingCompletedRecovery(completed, () => { throw new Error('Storage blocked'); }), true,
    'Unreadable storage must reveal recovery controls rather than hide them');
});

test('Home exposes completed progress retry after refresh without creating another request', async () => {
  const home = await readFile(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /hasPendingCompletedRecovery\(instances,key=>localStorage\.getItem\(key\)\)/);
  assert.match(home, /setShowCompleted\(true\)/);
  assert.match(home, /completedQuests\.map\(\(\{quest,instance\}\)=>/);
  assert.match(home, /<QuestProgressControls quest=\{quest\} instance=\{instance!\}/);
});


test('older pending request discovery is bounded, UUID-filtered and fails closed', async () => {
  const { pendingProgressInstanceIds } = await loadParser();
  const first = 'c1234567-1234-4123-8123-123456789abc';
  const second = 'd1234567-1234-4123-8123-123456789abc';
  const keys = [
    'unrelated:' + first,
    'life-progress-pending:not-a-uuid',
    'life-progress-pending:' + first,
    'life-progress-pending:' + first.toUpperCase(),
    'life-progress-pending:' + second,
  ];
  const storage = { length: keys.length, key: i => keys[i] ?? null };
  assert.deepEqual(pendingProgressInstanceIds(storage), [first, second],
    'Only valid, distinct pending instance IDs may be queried');
  assert.deepEqual(pendingProgressInstanceIds({ length: 1, key: () => { throw Error('denied'); } }), [],
    'Unreadable storage must not trigger a broad history query');
  const many = Array.from({ length: 150 }, (_, i) =>
    'life-progress-pending:' + i.toString(16).padStart(8, '0') + '-1234-4123-8123-123456789abc');
  assert.equal(pendingProgressInstanceIds({ length: many.length, key: i => many[i] }).length, 100,
    'Do not exceed 100 owner-scoped recovery lookups');
});

test('Home loads only owner-scoped older completed journals and renders retry separately from daily completion', async () => {
  const home = await readFile(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /try\{pendingIds=pendingProgressInstanceIds\(localStorage\)\}catch/);
  assert.match(home, /pendingIds\.length\?s\.from\('quest_instances'\)\.select\([^\n]+\)\.eq\('owner_id',user\.id\)\.in\('id',pendingIds\)\.eq\('status','completed'\)/);
  assert.match(home, /earlierRecoveries=recoverableCompletedEntries\(instances,recoveryIds,quests,recoveryQuests,completedQuests\.map\(x=>x\.instance!\.id\)\)/);
  assert.match(home, /Completed quests with pending saves/);
  assert.match(home, /earlierRecoveries\.map\(\(\{quest,instance\}\)=>[\s\S]*?<QuestProgressControls quest=\{quest\} instance=\{instance\}/);
  assert.match(home, /const completed=completedQuests\.length;/,
    'Older recovery records must not inflate today completion totals');
});

test('archived completed quest keeps pending retry metadata owner-scoped', async () => {
  // Static integration contract: not an authenticated Supabase/browser test.
  const home = await readFile(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /missingRecoveryQuestIds=\[\.\.\.new Set\(\(recoveries\|\|\[\]\)\.map\(row=>row\.quest_id\)\)\]/);
  assert.match(home, /\.eq\('owner_id',user\.id\)\.in\('id',missingRecoveryQuestIds\)\.limit\(100\)/);
  assert.match(home, /setRecoveryQuests\(missingRecoveryQuests\|\|\[\]\)/);
  assert.match(home, /recoverableCompletedEntries\(instances,recoveryIds,quests,recoveryQuests/);
  assert.match(home, /earlierRecoveries=recoverableCompletedEntries\(instances,recoveryIds,quests,recoveryQuests,completedQuests\.map\(x=>x\.instance!\.id\)\)/);
  assert.match(home, /const completed=completedQuests\.length;/,
    'Recovered historical quests must not inflate today completion');
});

test('archived same-day and older completed pending saves remain visible without duplicate Today cards', async () => {
  const { recoverableCompletedEntries } = await loadParser();
  const instances = [
    { id: 'visible-today', quest_id: 'active', due_date: '2026-10-28', status: 'completed' },
    { id: 'archived-today', quest_id: 'archived', due_date: '2026-10-28', status: 'completed' },
    { id: 'archived-older', quest_id: 'archived', due_date: '2026-10-27', status: 'completed' },
    { id: 'active-older', quest_id: 'active', due_date: '2026-10-27', status: 'completed' },
    { id: 'unfinished', quest_id: 'active', due_date: '2026-10-28', status: 'available' },
    { id: 'no-journal', quest_id: 'archived', due_date: '2026-10-27', status: 'completed' },
    { id: 'missing-metadata', quest_id: 'missing', due_date: '2026-10-27', status: 'completed' },
  ];
  const pendingIds = ['visible-today', 'archived-today', 'archived-older', 'active-older', 'unfinished', 'missing-metadata'];
  const result = recoverableCompletedEntries(
    instances, pendingIds, [{ id: 'active', title: 'Current quest' }],
    [{ id: 'archived', title: 'Archived quest' }], ['visible-today'],
  );
  assert.deepEqual(result.map(({ quest, instance }) => [instance.id, quest.title]), [
    ['archived-today', 'Archived quest'],
    ['archived-older', 'Archived quest'],
    ['active-older', 'Current quest'],
  ]);
  assert.equal(result.some(({ instance }) => instance.id === 'visible-today'), false,
    'The current-day Completed Journal already renders this request');
  assert.equal(result.some(({ instance }) => instance.status !== 'completed'), false,
    'Never surface a new operation on an unfinished quest as a completed retry');
});

// Regression: Home's load() can snapshot a still-pending journal before the
// child receives RPC confirmation. The post-delete callback must remove the
// archived recovery row without a second network request or new operation ID.
test('completed archived retry removes stale recovery row only after confirmed journal deletion', async () => {
  const { parsePendingProgress, recoverableCompletedEntries } = await loadParser();
  const handlers = await loadProgressHandlers();
  const home = await readFile(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /function journalResolved\(instanceId:string\)\{setRecoveryIds\(ids=>ids\.filter\(id=>id!==instanceId\)\)\}/);
  assert.equal((home.match(/onJournalResolved=\{journalResolved\}/g) ?? []).length, 3,
    'Active, current-day Completed and archived recovery controls all notify Home');

  const id = 'archived-q', key = 'life-progress-pending:' + id;
  const request = { id: 'original-completion-id', delta: 2 };
  const values = new Map([[key, JSON.stringify(request)]]);
  const storage = {
    getItem: name => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
    removeItem: name => values.delete(name),
  };
  const instance = { id, quest_id: 'archived-quest', due_date: '2026-10-27', status: 'completed' };
  const recoverable = () => recoverableCompletedEntries([instance], recoveryIds, [],
    [{ id: 'archived-quest', title: 'Archived quest' }], []);
  let recoveryIds = [id], resolved = 0, backendApplies = 0, attempts = 0;
  const seenRequests = new Set();
  const state = {
    disabled: false, saving: false, storageError: false, retrying: true,
    amount: 2, target: 2, instance, storageKey: key,
    parsePendingProgress, localStorage: storage,
    onLog: async (instanceId, requestId, delta) => {
      assert.equal(instanceId, id);
      assert.deepEqual({ id: requestId, delta }, request);
      attempts++;
      if (!seenRequests.has(requestId)) { seenRequests.add(requestId); backendApplies++; }
      // Home.load() snapshots the pending journal before onLog resolves.
      recoveryIds = storage.getItem(key) ? [id] : [];
      return attempts === 1 ? 'retry' : 'saved';
    },
    onJournalResolved: instanceId => {
      assert.equal(instanceId, id);
      assert.equal(storage.getItem(key), null, 'Parent notification follows durable journal deletion');
      resolved++;
      recoveryIds = recoveryIds.filter(item => item !== instanceId);
    },
    setRetrying: value => { state.retrying = value; },
    setSaving: value => { state.saving = value; },
    setStorageError: value => { state.storageError = value; },
    setSaveState: value => { state.saveState = value; },
    setCustom: () => {},
  };
  const retryPending = vm.runInNewContext(handlers.get('retryPending'), state);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  assert.equal(recoverable().length, 1);
  retryPending();
  await settle();
  assert.equal(resolved, 0, 'Ambiguous response must retain the journal and recovery row');
  assert.equal(storage.getItem(key), JSON.stringify(request));
  assert.equal(recoverable().length, 1);
  retryPending();
  await settle();
  assert.equal(attempts, 2);
  assert.equal(backendApplies, 1, 'The same request ID is never treated as a new operation');
  assert.equal(resolved, 1);
  assert.equal(storage.getItem(key), null);
  assert.equal(recoverable().length, 0, 'Resolved archived recovery row disappears without manual refresh');
});
