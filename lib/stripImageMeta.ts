/** Remove EXIF, XMP, and text metadata. Pixel data is left in place. */

const JPEG_EXIF = [0xff, 0xe1];

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let text = '';
  for (let i = 0; i < length && start + i < bytes.length; i += 1) text += String.fromCharCode(bytes[start + i]);
  return text;
}

function stripJpeg(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const parts: Uint8Array[] = [bytes.slice(0, 2)];
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) {
      parts.push(bytes.slice(offset));
      break;
    }
    if (offset + 4 > bytes.length) break;
    const size = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (size < 2 || offset + 2 + size > bytes.length) break;
    const header = ascii(bytes, offset + 4, 64);
    const drop = marker === JPEG_EXIF[1] && (header.startsWith('Exif\u0000') || header.startsWith('http://ns.adobe.com/xap'));
    if (!drop) parts.push(bytes.slice(offset, offset + 2 + size));
    offset += 2 + size;
  }
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function stripPng(bytes: Uint8Array): Uint8Array {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 8 || signature.some((value, index) => bytes[index] !== value)) return bytes;
  const parts: Uint8Array[] = [bytes.slice(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const type = ascii(bytes, offset + 4, 4);
    const chunk = 12 + length;
    if (offset + chunk > bytes.length) break;
    if (!['eXIf', 'tEXt', 'zTXt', 'iTXt'].includes(type)) parts.push(bytes.slice(offset, offset + chunk));
    offset += chunk;
    if (type === 'IEND') break;
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function stripWebp(bytes: Uint8Array): Uint8Array {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return bytes;
  const parts: Uint8Array[] = [bytes.slice(0, 12)];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const tag = ascii(bytes, offset, 4);
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true);
    const chunk = 8 + size + (size % 2);
    if (offset + chunk > bytes.length) break;
    if (tag !== 'EXIF' && tag !== 'XMP ') parts.push(bytes.slice(offset, offset + chunk));
    offset += chunk;
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  const view = new DataView(out.buffer);
  view.setUint32(4, out.length - 8, true);
  return out;
}

export function stripImageMeta(bytes: Uint8Array, type: string): Uint8Array {
  if (type === 'image/jpeg') return stripJpeg(bytes);
  if (type === 'image/png') return stripPng(bytes);
  if (type === 'image/webp') return stripWebp(bytes);
  throw new Error('Use a JPEG, PNG, or WebP photo.');
}

export function imageStillHasExif(bytes: Uint8Array): boolean {
  return ascii(bytes, 0, bytes.length).includes('Exif\u0000');
}
