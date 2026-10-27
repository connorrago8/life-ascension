'use client';
import { useEffect, useState } from 'react';

export type ProgressQuest = { title: string; target_amount: number | null; progress_unit: string | null; progress_increment: number | null };
export type ProgressInstance = { id: string; current_amount: number; status: 'available'|'completed'|'deferred' };
type Props = { quest: ProgressQuest; instance: ProgressInstance; disabled: boolean; onLog: (id: string, requestId: string, delta: number) => Promise<'saved'|'retry'|'rejected'> };

export function QuestProgressControls({ quest, instance, disabled, onLog }: Props) {
  const [custom, setCustom] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle'|'saved'|'failed'>('idle');
  const [storageError, setStorageError] = useState(false);
  const storageKey = `life-progress-pending:${instance.id}`;
  useEffect(() => {
    const refresh = () => { try { setRetrying(!!localStorage.getItem(storageKey)); setStorageError(false); } catch { setStorageError(true); } };
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [storageKey]);
  if (!quest.target_amount || !quest.progress_increment || !quest.progress_unit || instance.status !== 'available') return null;
  const target = quest.target_amount;
  const amount = instance.current_amount;
  const remaining = target - amount;
  const submit = (delta: number) => {
    if (disabled || saving || storageError || retrying || !Number.isInteger(delta) || !delta || amount + delta < 0 || amount + delta > target) return;
    // One UUID per user action; the RPC journal deduplicates network retries.
    let pending: { id: string; delta: number } | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !('id' in parsed) || !('delta' in parsed)
          || typeof parsed.id !== 'string' || !parsed.id || typeof parsed.delta !== 'number'
          || !Number.isInteger(parsed.delta) || parsed.delta === 0) {
          setStorageError(true); return;
        }
        pending = { id: parsed.id, delta: parsed.delta };
      }
    } catch { setStorageError(true); return; }
    // Never create a new ID while the previous operation outcome is unknown.
    if (pending) { setRetrying(true); return; }
    const operation = {id: crypto.randomUUID(), delta};
    try { localStorage.setItem(storageKey, JSON.stringify(operation)); } catch { setStorageError(true); return; }
    setSaveState('idle');
    setSaving(true);
    void onLog(instance.id, operation.id, operation.delta).then(outcome => {
      if(outcome !== 'retry') { try { localStorage.removeItem(storageKey); setRetrying(false); } catch { setStorageError(true); } }
      else setRetrying(true);
      if (outcome === 'saved') setCustom('');
      setSaveState(outcome === 'saved' ? 'saved' : 'failed');
    }).catch(() => { setRetrying(true); setSaveState('failed'); }).finally(() => setSaving(false));
  };
  const retryPending = () => {
    if (disabled || saving || storageError) return;
    let pending: { id: string; delta: number };
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) { setRetrying(false); setSaveState('failed'); return; }
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !('id' in parsed) || !('delta' in parsed)
        || typeof parsed.id !== 'string' || !parsed.id || typeof parsed.delta !== 'number'
        || !Number.isInteger(parsed.delta) || parsed.delta === 0) {
        // Keep the unknown operation intact: never silently replace its ID.
        setStorageError(true);
        setSaveState('failed');
        return;
      }
      pending = { id: parsed.id, delta: parsed.delta };
    } catch {
      // If storage is unreadable, prevent generating a different request ID.
      setStorageError(true);
      setSaveState('failed');
      return;
    }
    setSaveState('idle');
    setSaving(true);
    void onLog(instance.id, pending.id, pending.delta).then(outcome => {
      if (outcome !== 'retry') {
        try { localStorage.removeItem(storageKey); setRetrying(false); } catch { setStorageError(true); }
      } else setRetrying(true);
      setSaveState(outcome === 'saved' ? 'saved' : 'failed');
    }).catch(() => {
      // Network failures must preserve the original operation ID for retry.
      setRetrying(true);
      setSaveState('failed');
    }).finally(() => setSaving(false));
  };
  return <div className="quest-progress-controls">
    <label className="muted" htmlFor={`progress-${instance.id}`}>{amount} / {target} {quest.progress_unit}</label>
    <progress id={`progress-${instance.id}`} value={amount} max={target} style={{width:'100%'}} />
    {storageError && <p role="alert">Browser storage is unavailable. Progress logging is paused to prevent duplicate saves. Enable site storage and reload.</p>}
    {retrying && <p role="alert">Save not confirmed. Retry the same operation before logging more.</p>}
    {saveState === 'failed' && !retrying && !storageError && <p role="alert">Progress was not saved. You can try again.</p>}
    <p className="muted" role="status" aria-live="polite">{saving ? 'Saving progress…' : retrying ? 'Save not confirmed — retry required.' : saveState === 'saved' ? 'Progress saved.' : saveState === 'failed' ? 'Progress was not saved.' : ''}</p>
    <div className="actions">{retrying && <button type="button" className="btn" disabled={disabled || saving || storageError} aria-label={`Retry saving progress for ${quest.title}`} onClick={retryPending}>Retry save</button>}
      <button type="button" className="btn" disabled={disabled || saving || retrying || storageError || remaining === 0} aria-label={`Add ${Math.min(quest.progress_increment,remaining)} ${quest.progress_unit} to ${quest.title}`} onClick={() => submit(Math.min(quest.progress_increment!, remaining))}>+{Math.min(quest.progress_increment,remaining)}</button>
      <button type="button" className="btn ghost" disabled={disabled || saving || retrying || storageError || amount < quest.progress_increment} aria-label={`Undo ${quest.progress_increment} ${quest.progress_unit} on ${quest.title}`} onClick={() => submit(-quest.progress_increment!)}>Undo −{quest.progress_increment}</button>
      <input className="field" disabled={disabled || saving || retrying || storageError || remaining === 0} style={{maxWidth:90}} type="number" min={1} max={remaining} step={1} value={custom} aria-label={`Custom progress amount for ${quest.title}`} placeholder="Amount" onChange={e=>setCustom(e.target.value)} />
      <button type="button" className="btn ghost" disabled={disabled || saving || retrying || storageError || !Number.isInteger(Number(custom)) || Number(custom)<1 || Number(custom)>remaining} aria-label={`Log custom progress for ${quest.title}`} onClick={() => {submit(Number(custom));}}>Log</button>
    </div>
  </div>;
}
