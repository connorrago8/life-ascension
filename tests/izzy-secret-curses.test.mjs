import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/izzy/secret-curses.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', output)(mod, mod.exports);
const { shouldRevealCurse, visibleCursePayload } = mod.exports;

const now = new Date('2026-11-02T03:00:00Z');
const occurrence = {
  assignmentSource: 'izzy',
  dueAt: '2026-11-02T02:00:00Z',
  completedAt: null,
  curseStatus: 'sealed',
  consentActive: true,
};

test('reveals a missed Izzy quest only after deadline', () => {
  assert.equal(shouldRevealCurse(occurrence, now), true);
  assert.equal(shouldRevealCurse(occurrence, new Date(occurrence.dueAt)), false);
});

test('never curses ordinary or completed quests', () => {
  assert.equal(shouldRevealCurse({ ...occurrence, assignmentSource: 'auto' }, now), false);
  assert.equal(shouldRevealCurse({ ...occurrence, completedAt: '2026-11-02T01:59:00Z' }, now), false);
  assert.equal(shouldRevealCurse({ ...occurrence, consentActive: false }, now), false);
  assert.equal(shouldRevealCurse({ ...occurrence, curseStatus: 'revealed' }, now), false);
});

test('sealed curse text is never sent to Connor', () => {
  const sealed = visibleCursePayload({ status: 'sealed', consequenceText: 'Secret', seenAt: null });
  assert.equal(Object.hasOwn(sealed, 'consequenceText'), false);
  assert.equal(sealed.showReveal, false);
});

test('revealed card appears once and then stays readable', () => {
  const first = visibleCursePayload({ status: 'revealed', consequenceText: 'Watch Drag Race', seenAt: null });
  const seen = visibleCursePayload({ status: 'revealed', consequenceText: 'Watch Drag Race', seenAt: now.toISOString() });
  assert.equal(first.showReveal, true);
  assert.equal(seen.showReveal, false);
  assert.equal(seen.consequenceText, 'Watch Drag Race');
});
