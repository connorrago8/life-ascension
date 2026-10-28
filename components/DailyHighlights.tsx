'use client';
import { useEffect, useState } from 'react';
import { chicagoDay, dailyHighlights, type HighlightCandidate } from '../lib/questBoard';

export default function DailyHighlights({ ownerId, candidates, titles, cadences, disabled, onComplete }: {
  ownerId: string; candidates: HighlightCandidate[]; titles: Record<string, string>;
  cadences?: Record<string,string>; disabled?: boolean; onComplete?: (id:string)=>void;
}) {
  const [selection, setSelection] = useState<{ key: string; ids: string[] } | null>(null);
  const [error, setError] = useState(false);
  const day = chicagoDay();
  const key = `${ownerId}:${day}`;
  useEffect(() => {
    try {
      const snapshot = dailyHighlights(window.localStorage, ownerId, day, candidates);
      setSelection({ key, ids: snapshot.ids }); setError(false);
    } catch { setSelection(null); setError(true); }
  }, [ownerId, day, candidates, key]);
  return <section className="panel" aria-label="Today's highlighted actions">
    <h2>Your next actions</h2>
    <p className="muted">Up to three actions, fixed for today on this device.</p>
    {error ? <p role="status">Daily selection unavailable. Your quests remain available below.</p> :
      selection?.key !== key ? <p role="status">Loading today’s selection…</p> :
      selection.ids.length === 0 ? <p>No eligible actions when today’s selection was made. You can still browse all active quests below.</p> :
      <ol>{selection.ids.map(id => {
        const candidate = candidates.find(c => c.id === id);
        return <li key={id} className={'highlight-action '+(candidate?.classification==='main'?'main-quest':'')}>{candidate && candidate.status !== 'completed' && candidate.eligible ?
          <><p className="eyebrow">{candidate.classification==='main'?'Main':'Side'} · {cadences?.[id]}</p><a className="btn ghost" href={`#occurrence-${id}`}>{titles[id]}</a>{onComplete&&<button className="btn" disabled={disabled} aria-label={'Complete quest: '+titles[id]} onClick={()=>onComplete(id)}>Complete quest</button>}</> :
          <span>{titles[id] ?? 'Selected quest'} · {candidate?.status === 'completed' ? 'Completed' : 'No longer available'}</span>}</li>;
      })}</ol>}
    {selection?.key===key&&selection.ids.length>0&&selection.ids.every(id=>candidates.find(c=>c.id===id)?.status==='completed')&&<p role="status">Today’s selected quests complete. Other active quests remain below.</p>}
    <a className="btn ghost" href="/journal">Completed Journal</a>
  </section>;
}
