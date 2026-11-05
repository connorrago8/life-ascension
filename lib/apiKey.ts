import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const PREFIX = 'la_live_';
const SECRET_BYTES = 32;
const PREFIX_IDENTIFYING_CHARS = 8;

const API_KEY_PATTERN = /^la_live_[A-Za-z0-9_-]{43,128}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

export type GeneratedApiKey = {
  token: string;
  prefix: string;
  keyHash: string;
};

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(SECRET_BYTES).toString('base64url');
  const token = `${PREFIX}${secret}`;
  return {
    token,
    prefix: token.slice(0, PREFIX.length + PREFIX_IDENTIFYING_CHARS),
    keyHash: hashApiKey(token),
  };
}

export function hashApiKey(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isPersonalApiKey(token: string): boolean {
  return API_KEY_PATTERN.test(token);
}

export function looksLikeApiKeyAttempt(token: string): boolean {
  return token.startsWith(PREFIX);
}

export function secureCompareHex(left: string, right: string): boolean {
  if (!SHA256_HEX.test(left) || !SHA256_HEX.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function readBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

export function cleanKeyName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 80) return null;
  if (/[\u0000-\u001F\u007F]/.test(name)) return null;
  return name;
}
