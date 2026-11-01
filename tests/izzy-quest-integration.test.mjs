import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/izzy/quest-integration.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', output)(mod, mod.exports);
const { evaluateIzzyCurseEligibility, questXpLabel } = mod.exports;
const now = new Date('2026-11-02T03:00:00Z');
const assignment = {
  assignmentId: 'assignment-1',
  ownerId: 'owner-1',
  questId: 'quest-1',
  instanceId: 'instance-1',
  origin: 'izzy',
  approved: true,
  consentActive: true,
  dueAt: '2026-11-02T02:00:00Z',
  completedAt: null,
};

test('verified missed Izzy occurrence is eligible', () => {
  assert.deepEqual(evaluateIzzyCurseEligibility(assignment, now), {
    eligible: true, instanceId: 'instance-1', dueAt: assignment.dueAt,
  });
});

test('ordinary quests and unapproved proposals are ineligible', () => {
  assert.equal(evaluateIzzyCurseEligibility({ ...assignment, origin: 'manual' }, now).eligible, false);
  assert.equal(evaluateIzzyCurseEligibility({ ...assignment, origin: 'auto' }, now).eligible, false);
  assert.equal(evaluateIzzyCurseEligibility({ ...assignment, approved: false }, now).eligible, false);
  assert.equal(evaluateIzzyCurseEligibility(null, now).eligible, false);
});

test('on-time completion, lack of consent and future deadlines block reveal', () => {
  assert.equal(evaluateIzzyCurseEligibility({ ...assignment, completedAt: '2026-11-02T02:00:00Z' }, now).eligible, false);
  assert.equal(evaluateIzzyCurseEligibility({ ...assignment, consentActive: false }, now).eligible, false);
  assert.equal(evaluateIzzyCurseEligibility({ ...assignment, dueAt: '2026-11-03T02:00:00Z' }, now).eligible, false);
});

test('invalid completion evidence blocks reveal', () => {
  assert.equal(evaluateIzzyCurseEligibility({ ...assignment, completedAt: 'invalid' }, now).eligible, false);
});

test('Izzy XP label is distinct from ordinary quests', () => {
  assert.equal(questXpLabel('izzy'), '+2 XP');
  assert.equal(questXpLabel('manual'), '+1 XP');
  assert.equal(questXpLabel('auto'), '+1 XP');
});
