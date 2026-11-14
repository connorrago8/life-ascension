import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length - 4);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.subarray(y * width * 4, (y + 1) * width * 4).forEach((value, index) => {
      raw[y * (width * 4 + 1) + 1 + index] = value;
    });
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', Buffer.from([
      (width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255,
      (height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255,
      8, 6, 0, 0, 0,
    ])),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function render(size, inset) {
  const px = new Uint8Array(size * size * 4);
  const set = (x, y, r, g, b) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= size || iy >= size) return;
    const i = (iy * size + ix) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) set(x, y, 12, 14, 18);
  }
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radius = size * (0.34 - inset);
  const stroke = Math.max(2, size * 0.018);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - radius) <= stroke) set(x, y, 201, 162, 39);
      else if (Math.abs(d - radius * 0.86) <= stroke * 0.55) set(x, y, 0, 240, 255);
    }
  }
  const thick = Math.max(3, size * 0.045);
  const top = cy - radius * 0.42;
  const foot = cy + radius * 0.38;
  const span = radius * 0.46;
  for (let t = 0; t <= 1; t += 0.5 / size) {
    const x = cx - span * (1 - t);
    const y = foot - (foot - top) * t;
    for (let w = -thick; w <= thick; w += 1) set(x + w, y, 255, 43, 214);
    const xr = cx + span * (1 - t);
    for (let w = -thick; w <= thick; w += 1) set(xr + w, y, 255, 43, 214);
  }
  return png(size, size, px);
}

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/icons/icon-512.png', import.meta.url), render(512, 0));
writeFileSync(new URL('../public/icons/icon-maskable-512.png', import.meta.url), render(512, 0.06));
writeFileSync(new URL('../public/icons/icon-192.png', import.meta.url), render(192, 0));
writeFileSync(new URL('../public/icons/apple-touch-icon.png', import.meta.url), render(180, 0));
