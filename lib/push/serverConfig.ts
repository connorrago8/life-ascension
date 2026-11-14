/**
 * Server-only VAPID and cron configuration.
 * Never import this module from a client component. Never log the values.
 */

const PUBLIC_KEY = /^[A-Za-z0-9_-]{40,200}$/;
const PRIVATE_KEY = /^[A-Za-z0-9_-]{20,200}$/;

export type PushEnv = {
  configured: boolean;
  publicKey: string | null;
  subject: string | null;
};

function clean(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function readPushEnv(env: NodeJS.ProcessEnv = process.env): PushEnv & { privateKey: string | null } {
  const publicKey = clean(env.VAPID_PUBLIC_KEY) || clean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const privateKey = clean(env.VAPID_PRIVATE_KEY);
  const subject = clean(env.VAPID_SUBJECT);
  const keysOk = PUBLIC_KEY.test(publicKey) && PRIVATE_KEY.test(privateKey);
  const subjectOk = subject.startsWith('mailto:') || subject.startsWith('https://');
  const configured = keysOk && subjectOk;
  return {
    configured,
    publicKey: configured ? publicKey : (PUBLIC_KEY.test(publicKey) ? publicKey : null),
    privateKey: configured ? privateKey : null,
    subject: configured ? subject : null,
  };
}

export function pushIsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return readPushEnv(env).configured;
}

/** Public key for the browser. Safe to return from an API. Never the private key. */
export function publicVapidKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const state = readPushEnv(env);
  return state.configured ? state.publicKey : null;
}
