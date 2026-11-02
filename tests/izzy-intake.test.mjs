import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = (path, dependencies = {}) => {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  const requireLocal = (name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error('Unexpected dependency');
  };
  new Function('module', 'exports', 'require', output)(mod, mod.exports, requireLocal);
  return mod.exports;
};

const parser = compile('../lib/izzy/tally-staging.ts');
const intake = compile('../lib/izzy/intake.ts', { './tally-staging': parser });
const headers = ['Submission ID', 'DAILY HABITS: question'];

test('intake delegates atomic duplicate protection to storage', async () => {
  const ids = new Set();
  const store = { async insertOnce(input) {
    assert.equal(input.proposals[0].status, 'review_required');
    if (ids.has(input.submissionId)) return false;
    ids.add(input.submissionId);
    return true;
  } };
  const first = await intake.stageTallyRow(headers, ['entry_1', 'Make bed'], store);
  const second = await intake.stageTallyRow(headers, ['entry_1', 'Make bed'], store);
  assert.equal(first.status, 'staged');
  assert.equal(second.status, 'already_received');
});

test('test submission is excluded', async () => {
  const store = { async insertOnce() { throw new Error('should not write'); } };
  const result = await intake.stageTallyRow(headers, ['KprXZ4A', 'Test questb'], store);
  assert.equal(result.status, 'already_received');
});

test('database failures propagate for retry', async () => {
  const store = { async insertOnce() { throw new Error('database unavailable'); } };
  await assert.rejects(
    intake.stageTallyRow(headers, ['entry_2', 'Make bed'], store),
    /database unavailable/,
  );
});
