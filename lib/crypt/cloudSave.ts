import { supabase } from '../supabase';
import { CRYPT_SAVE_VERSION, parseCryptSave, serializeCryptSave } from './saveContract';
import type { RunState } from './run';

export type CloudCryptSave = { run: RunState; revision: number };
export class CryptSaveConflict extends Error {
  constructor() { super('This run changed on another device. Reload before saving.'); this.name = 'CryptSaveConflict'; }
}

/** Read only the authenticated account's saved Crypt run; RLS also enforces ownership. */
export async function loadCloudCryptRun(): Promise<CloudCryptSave | null> {
  const client = supabase();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('Sign in to load your cloud run.');
  const { data, error } = await client.from('adventure_run_saves')
    .select('state,version,revision').eq('owner_id', user.id).eq('adventure_id', 'crypt').maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.version !== CRYPT_SAVE_VERSION) throw new Error('Unsupported cloud save version.');
  const parsed = parseCryptSave(JSON.stringify(data.state));
  if (!parsed) throw new Error('Cloud save is incompatible. Nothing was overwritten.');
  return { run: parsed.run, revision: Number(data.revision) };
}

/** Atomic compare-and-swap. Never automatically overwrite another device's revision. */
export async function saveCloudCryptRun(run: RunState, expectedRevision: number): Promise<number> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('Invalid save revision');
  const client = supabase();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('Sign in to save your run.');
  const state = JSON.parse(serializeCryptSave(run));
  const { data, error } = await client.rpc('save_adventure_run', {
    p_adventure_id: 'crypt', p_state: state,
    p_version: CRYPT_SAVE_VERSION, p_expected_revision: expectedRevision,
  });
  if (error) {
    if (error.code === '40001' || /stale save revision/i.test(error.message)) throw new CryptSaveConflict();
    throw error;
  }
  const revision = Number(data);
  if (!Number.isSafeInteger(revision) || revision <= expectedRevision) throw new Error('Unexpected cloud save receipt');
  return revision;
}
