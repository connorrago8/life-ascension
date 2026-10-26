'use client';
import { useEffect, useState } from 'react';

export type ProgressQuest = { target_amount: number | null; progress_unit: string | null; progress_increment: number | null };
export type ProgressInstance = { id: string; current_amount: number; status: 'available'|'completed'|'deferred' };
type Props = { quest: ProgressQuest; instance: ProgressInstance; disabled: boolean; onLog: (id: string, requestId: string, delta: number) => Promise<'saved'|'retry'|'rejected'> };

export function QuestProgressControls({ quest, instance, disabled, onLog }: Props) {
  const [custom, setCustom] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [saving, setSaving] = useState(false);
  const storageKey = `life-progress-pending:${instance.id}`;
  useEffect(() => { try { setRetrying(!!sessionStorage.getItem(storageKey)); } catch {} }, [storageKey]);
  if (!quest.target_amount || !quest.progress_increment || !quest.progress_unit || instance.status !== 'available') return null;
  const target = quest.target_amount;
  const amount = instance.current_amount;
  const remaining = target - amount;
  const submit = (delta: number) => {
    if (disabled || saving || !Number.isInteger(delta) || !delta || amount + delta < 0 || amount + delta > target) return;
    // One UUID per user action; the RPC journal deduplicates network retries.
    let pending: { id: string; delta: number } | null = null;
    try { const raw = sessionStorage.getItem(storageKey); if(raw) pending = JSON.parse(raw); } catch { /* storage unavailable */ }
    // Never create a new ID while the previous operation outcome is unknown.
    if (pending && pending.delta !== delta) { setRetrying(true); return; }
    const operation = pending ?? {id: crypto.randomUUID(), delta};
    try { sessionStorage.setItem(storageKey, JSON.stringify(operation)); } catch { /* in-memory UI still prevents concurrent clicks */ }
    setSaving(true);
    void onLog(instance.id, operation.id, operation.delta).then(outcome => {
      if(outcome !== 'retry') { try { sessionStorage.removeItem(storageKey); } catch {} setRetrying(false); }
      else setRetrying(true);
    }).finally(() => setSaving(false));
  };
  const retryPending = () => {
    if (disabled || saving) return;
    try { const raw = sessionStorage.getItem(storageKey); if(raw) { const p = JSON.parse(raw); setSaving(true); void onLog(instance.id,p.id,p.delta).then(outcome => { if(outcome !== 'retry'){sessionStorage.removeItem(storageKey);setRetrying(false);} }).finally(() => setSaving(false)); } } catch { /* show retry message */ }
  };
  return <div className="quest-progress-controls">
    <label className="muted" htmlFor={`progress-${instance.id}`}>{amount} / {target} {quest.progress_unit}</label>
    <progress id={`progress-${instance.id}`} value={amount} max={target} style={{width:'100%'}} />
    {retrying && <p role="alert">Save not confirmed. Retry the same operation before logging more.</p>}
    <div className="actions">{retrying && <button type="button" className="btn" disabled={disabled || saving} onClick={retryPending}>Retry save</button>}
      <button type="button" className="btn" disabled={disabled || saving || retrying || remaining === 0} onClick={() => submit(Math.min(quest.progress_increment!, remaining))}>+{Math.min(quest.progress_increment,remaining)}</button>
      <button type="button" className="btn ghost" disabled={disabled || retrying || amount < quest.progress_increment} onClick={() => submit(-quest.progress_increment!)}>Undo −{quest.progress_increment}</button>
      <input className="field" style={{maxWidth:90}} type="number" min={1} max={remaining} step={1} value={custom} aria-label="Custom progress amount" placeholder="Amount" onChange={e=>setCustom(e.target.value)} />
      <button type="button" className="btn ghost" disabled={disabled || retrying || !Number.isInteger(Number(custom)) || Number(custom)<1 || Number(custom)>remaining} onClick={() => {submit(Number(custom));}}>Log</button>
    </div>
  </div>;
}
