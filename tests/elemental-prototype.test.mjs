import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

// The repo test script discovers tests/*.test.mjs. Execute the TypeScript
// prototype test with Node's type stripping, without changing production code.
test('elemental Fire/Ice TypeScript prototype suite', () => {
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--test',
    'lib/crypt/elemental.test.ts',
  ], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, [
    result.stdout, result.stderr,
  ].filter(Boolean).join('\n'));
});
