'use client';
import { useState } from 'react';

export type ProgressQuest = { target_amount: number | null; progress_unit: string | null; progress_increment: number | null };
export type ProgressInstance = { id: string; current_amount: number; status: 'available'|'completed'|'deferred' };
type Props = { quest: ProgressQuest; instance: ProgressInstance; disabled: boolean; onLog: (id: string, requestId: string, delta: number) => Promise<void> };

export function QuestProgressControls({ quest, instance, disabled, onLog }: Props) {
  const [custom, setCustom] = useState('');
  if (!quest.target_amount || !quest.progress_increment || !quest.progress_unit || instance.status !== 'available') return null;
  const target = quest.target_amount;
  const amount = instance.current_amount;
  const remaining = target - amount;
  const submit = (delta: number) => {
    if (disabled || !Number.isInteger(delta) || !delta || amount + delta < 0 || amount + delta > target) return;
    // One UUID per user action; the RPC journal deduplicates network retries.
    void onLog(instance.id, crypto.randomUUID(), delta);
  };
  return <div className="quest-progress-controls">
    <label className="muted" htmlFor={`progress-${instance.id}`}>{amount} / {target} {quest.progress_unit}</label>
    <progress id={`progress-${instance.id}`} value={amount} max={target} style={{width:'100%'}} />
    <div className="actions">
      <button type="button" className="btn" disabled={disabled || remaining === 0} onClick={() => submit(Math.min(quest.progress_increment!, remaining))}>+{Math.min(quest.progress_increment,remaining)}</button>
      <button type="button" className="btn ghost" disabled={disabled || amount < quest.progress_increment} onClick={() => submit(-quest.progress_increment!)}>Undo −{quest.progress_increment}</button>
      <input className="field" style={{maxWidth:90}} type="number" min={1} max={remaining} step={1} value={custom} aria-label="Custom progress amount" placeholder="Amount" onChange={e=>setCustom(e.target.value)} />
      <button type="button" className="btn ghost" disabled={disabled || !Number.isInteger(Number(custom)) || Number(custom)<1 || Number(custom)>remaining} onClick={() => {submit(Number(custom));setCustom('');}}>Log</button>
    </div>
  </div>;
}
