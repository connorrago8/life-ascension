import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const exports = {};
const source = readFileSync(new URL('../lib/localRunLifecycle.ts', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, {exports});
const {subscribeLocalRunCheckpoint} = exports;

function fixture() {
  const documentTarget = new EventTarget();
  documentTarget.hidden = false;
  const pageTarget = new EventTarget();
  let latest = {tick: 0, segmentMs: 0};
  let saved = null;
  let calls = 0;
  const dispose = subscribeLocalRunCheckpoint(documentTarget, pageTarget, () => {
    saved = {...latest};
    calls++;
  });
  return {documentTarget, pageTarget, dispose,
    update: value => { latest = value; }, saved: () => saved, calls: () => calls};
}

test('route unmount flushes the latest frame before the periodic save', () => {
  const f = fixture();
  f.update({tick: 17, segmentMs: 283});
  assert.equal(f.saved(), null);
  f.dispose();
  assert.deepEqual(f.saved(), {tick: 17, segmentMs: 283});
  assert.equal(f.calls(), 1);
});

test('pagehide flushes while the document is still visible', () => {
  const f = fixture();
  f.update({tick: 29, segmentMs: 483});
  f.pageTarget.dispatchEvent(new Event('pagehide'));
  assert.deepEqual(f.saved(), {tick: 29, segmentMs: 483});
  f.dispose();
});

test('backgrounding flushes; returning to visibility does not resume or write', () => {
  const f = fixture();
  f.documentTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.calls(), 0);
  f.documentTarget.hidden = true;
  f.documentTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.calls(), 1);
  f.documentTarget.hidden = false;
  f.documentTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.calls(), 1);
  f.dispose();
});

test('cleanup removes listeners, is idempotent and can be subscribed again', () => {
  const f = fixture();
  f.dispose();
  f.dispose();
  f.documentTarget.hidden = true;
  f.documentTarget.dispatchEvent(new Event('visibilitychange'));
  f.pageTarget.dispatchEvent(new Event('pagehide'));
  assert.equal(f.calls(), 1);
  let next = 0;
  const dispose = subscribeLocalRunCheckpoint(f.documentTarget, f.pageTarget, () => next++);
  f.pageTarget.dispatchEvent(new Event('pagehide'));
  assert.equal(next, 1);
  dispose();
});
