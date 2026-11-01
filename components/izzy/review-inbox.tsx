'use client';
import { useEffect, useState } from 'react';

type Proposal = {
  proposal_id: number;
  category: string;
  original_text: string;
  visibility: string;
};

export function IzzyReviewInbox() {
  const [items, setItems] = useState<Proposal[]>([]);
  const [status, setStatus] = useState('Loading private proposals…');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/izzy/proposals', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('Inbox not available');
      return response.json();
    }).then(result => {
      if (!controller.signal.aborted) {
        setItems(Array.isArray(result.proposals) ? result.proposals : []);
        setStatus('');
      }
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('Private inbox is not connected yet.');
    });
    return () => controller.abort();
  }, []);

  return <section className="panel" aria-label="Izzy quest proposals">
    <h2>Queen Izzy’s Quest Inbox</h2>
    <p className="muted">Suggestions are private until you review them. Nothing is added automatically.</p>
    {status && <p role="status" className="muted">{status}</p>}
    {items.map(item => <article className="quest" key={item.proposal_id}>
      <div className="quest-main">
        <div className="quest-title">{item.original_text}</div>
        <div className="muted">{item.category} · Pending review</div>
      </div>
    </article>)}
    {!status && items.length === 0 && <p className="muted">No pending proposals.</p>}
  </section>;
}
