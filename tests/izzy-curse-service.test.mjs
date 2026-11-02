import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadTs(path, deps = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', output)(mod, mod.exports, (name) => {
    if (!(name in deps)) throw new Error('Unexpected dependency: ' + name);
    return deps[name];
  });
  return mod.exports;
}
const policy = loadTs('../lib/izzy/secret-curses.ts');
const transitions = loadTs('../lib/izzy/curse-transitions.ts');
const service = loadTs('../lib/izzy/curse-service.ts', {
  './secret-curses': policy,
  './curse-transitions': transitions,
});
const now = new Date('2026-11-02T03:00:00Z');
function fixture(source = 'izzy') {
  return {
    curseId: 'curse1',
    ownerUserId: 'owner1',
    questId: 'quest1',
    questTitle: 'Dishes',
    consequenceText: 'Watch a show together',
    seenAt: null,
    revealedAt: null,
    occurrence: {
      assignmentSource: source,
      dueAt: '2026-11-02T02:00:00Z',
      completedAt: null,
      curseStatus: 'sealed',
      consentActive: true,
    },
  };
}
test('unknown curse fails closed without revealing', async () => {
  const result = await service.inspectCurse({ loadVerified: async () => null }, 'owner1', 'missing', now);
  assert.equal(result.status, 'not_found');
});
test('sealed curse text remains hidden before deadline', async () => {
  const record = fixture();
  record.occurrence.dueAt = '2026-11-03T02:00:00Z';
  const result = await service.inspectCurse({ loadVerified: async () => record }, 'owner1', 'curse1', now);
  assert.equal(result.status, 'ok');
  assert.equal(Object.hasOwn(result.curse, 'consequenceText'), false);
});
test('verified missed curse reveals only after authoritative adapter confirms', async () => {
  const record = fixture();
  let called = 0;
  const result = await service.inspectCurse({
    loadVerified: async () => record,
    revealIfStillMissed: async () => {
      called++;
      return {
        ...record,
        revealedAt: now.toISOString(),
        occurrence: { ...record.occurrence, curseStatus: 'revealed' },
      };
    },
  }, 'owner1', 'curse1', now);
  assert.equal(called, 1);
  assert.equal(result.curse.consequenceText, 'Watch a show together');
  assert.equal(result.curse.showReveal, true);
});
test('ordinary quest never calls reveal adapter', async () => {
  const record = fixture('manual');
  const result = await service.inspectCurse({
    loadVerified: async () => record,
    revealIfStillMissed: async () => { throw new Error('should not reveal'); },
  }, 'owner1', 'curse1', now);
  assert.equal(result.status, 'ok');
  assert.equal(Object.hasOwn(result.curse, 'consequenceText'), false);
});
test('acknowledgment uses conditional persistence', async () => {
  const record = fixture();
  record.occurrence.curseStatus = 'revealed';
  record.revealedAt = now.toISOString();
  let updated = 0;
  const result = await service.resolveCurse({
    loadVerified: async () => record,
    applyTransition: async (owner, id, before, after) => {
      assert.equal(owner, 'owner1');
      assert.equal(id, 'curse1');
      assert.equal(before.seenAt, null);
      assert.equal(after.seenAt, now.toISOString());
      updated++;
      return true;
    },
  }, 'owner1', 'curse1', 'acknowledge', now);
  assert.equal(updated, 1);
  assert.equal(result.status, 'ok');
  assert.equal(result.curse.showReveal, false);
});
test('failed compare-and-swap never claims successful acknowledgment', async () => {
  const record = fixture();
  record.occurrence.curseStatus = 'revealed';
  record.revealedAt = now.toISOString();
  const result = await service.resolveCurse({
    loadVerified: async () => record,
    applyTransition: async () => false,
  }, 'owner1', 'curse1', 'acknowledge', now);
  assert.equal(result.status, 'conflict');
});
