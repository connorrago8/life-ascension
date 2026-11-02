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
  const [busy, setBusy] = useState<number | null>(null);
  const [companionId, setCompanionId] = useState('');
  const [dueDate, setDueDate] = useState('');

  async function approve(proposalId: number) {
    setBusy(proposalId);
    setStatus('Approving quest…');
    try {
      const response = await fetch('/api/izzy/proposals', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, companionId, dueDate }),
      });
      if (!response.ok) throw new Error('Approval not available');
      setItems(current => current.filter(item => item.proposal_id !== proposalId));
      setStatus('Quest approved. Refresh the board to see it.');
    } catch {
      setStatus('Could not approve. Confirm companion consent and a valid deadline.');
    } finally { setBusy(null); }
  }

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
    {items.length > 0 && <div className="quest-main">
      <label htmlFor="izzy-companion-id">Consented companion ID</label>
      <input id="izzy-companion-id" value={companionId} onChange={event => setCompanionId(event.target.value)} placeholder="Companion UUID" autoComplete="off" />
      <label htmlFor="izzy-due-date">Quest deadline</label>
      <input id="izzy-due-date" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />
    </div>}
    {items.map(item => <article className="quest" key={item.proposal_id}>
      <div className="quest-main">
        <div className="quest-title">{item.original_text}</div>
        <div className="muted">{item.category} · Pending review</div>
        {item.category !== 'reward' && <button type="button" disabled={busy !== null || !companionId || !dueDate} onClick={() => approve(item.proposal_id)}>Approve Quest</button>}
      </div>
    </article>)}
    {!status && items.length === 0 && <p className="muted">No pending proposals.</p>}
  </section>;
}
