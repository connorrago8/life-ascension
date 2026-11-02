import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/izzy/curse-transitions.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', output)(mod, mod.exports);
const { transitionCurse } = mod.exports;

const at = '2026-11-02T04:00:00Z';
const sealed = { state: 'sealed', revealedAt: null, seenAt: null };
const revealed = { state: 'revealed', revealedAt: '2026-11-02T03:00:00Z', seenAt: null };

test('sealed curses cannot be acknowledged or resolved', () => {
  for (const action of ['acknowledge', 'fulfill', 'forgive', 'decline']) {
    assert.equal(transitionCurse(sealed, action, at).ok, false);
  }
});

test('acknowledgment is idempotent and does not resolve curse', () => {
  const first = transitionCurse(revealed, 'acknowledge', at);
  assert.equal(first.ok, true);
  assert.equal(first.changed, true);
  assert.equal(first.next.state, 'revealed');
  assert.equal(first.next.seenAt, at);
  const second = transitionCurse(first.next, 'acknowledge', at);
  assert.equal(second.ok, true);
  assert.equal(second.changed, false);
});

test('voluntary decline and forgiveness resolve without XP side effects', () => {
  assert.equal(transitionCurse(revealed, 'decline', at).next.state, 'declined');
  assert.equal(transitionCurse(revealed, 'forgive', at).next.state, 'forgiven');
  assert.equal(transitionCurse(revealed, 'fulfill', at).next.state, 'fulfilled');
});

test('resolved consequences cannot be resurrected or overwritten', () => {
  const declined = transitionCurse(revealed, 'decline', at).next;
  assert.equal(transitionCurse(declined, 'fulfill', at).ok, false);
  assert.equal(transitionCurse(declined, 'cancel', at).ok, false);
});

test('cancellation before reveal is allowed, invalid timestamps are rejected', () => {
  assert.equal(transitionCurse(sealed, 'cancel', at).next.state, 'cancelled');
  assert.equal(transitionCurse(revealed, 'acknowledge', 'not-a-date').ok, false);
});
