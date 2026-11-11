import test from 'node:test';
import assert from 'node:assert/strict';
import { imageStillHasExif, stripImageMeta } from '../lib/stripImageMeta.ts';

test('JPEG EXIF is removed and the photo markers stay', () => {
  const exif = new TextEncoder().encode('Exif\u0000\u0000GPS');
  const segment = new Uint8Array(4 + exif.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = (exif.length + 2) >> 8;
  segment[3] = (exif.length + 2) & 0xff;
  segment.set(exif, 4);
  const bytes = new Uint8Array([0xff, 0xd8, ...segment, 0xff, 0xd9]);
  const clean = stripImageMeta(bytes, 'image/jpeg');
  assert.equal(imageStillHasExif(clean), false);
  assert.equal(clean[0], 0xff);
  assert.equal(clean[1], 0xd8);
  assert.equal(clean.at(-2), 0xff);
  assert.equal(clean.at(-1), 0xd9);
});
