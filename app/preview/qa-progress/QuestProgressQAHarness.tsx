'use client';

import { useRef, useState } from 'react';
import { QuestProgressControls } from '../../../components/QuestProgressControls';

const INSTANCE_ID = 'qa-local-progress-only';
const STORAGE_KEY = `life-progress-pending:${INSTANCE_ID}`;
const QUEST = {
  title: 'Long sample quest title for checking narrow-screen keyboard focus and progress controls',
  target_amount: 10,
  progress_unit: 'repetitions',
  progress_increment: 2,
} as const;

/**
 * An explicitly local, no-backend fixture for real-component browser QA.
 * The fake response deliberately cannot prove server-side idempotency or XP safety.
 */
export function QuestProgressQAHarness() {
  const [amount, setAmount] = useState(2);
  const [response, setResponse] = useState<'saved' | 'retry' | 'rejected'>('retry');
  const [events, setEvents] = useState<string[]>([]);
  const confirmed = useRef(new Set<string>());

  const onLog = async (instanceId: string, requestId: string, delta: number) => {
    setEvents(previous => [...previous, `${instanceId}|${requestId}|${delta}|${response}`]);
    if (response === 'saved' && !confirmed.current.has(requestId)) {
      confirmed.current.add(requestId);
      setAmount(previous => previous + delta);
    }
    return response;
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };
  const seedCorruptJournal = () => {
    localStorage.setItem(STORAGE_KEY, '{invalid');
    window.location.reload();
  };

  return <section aria-label="Local progress QA controls">
    <label htmlFor="qa-response">Mock next response (no network)</label>
    <select id="qa-response" className="field" value={response}
      onChange={event => setResponse(event.target.value as 'saved' | 'retry' | 'rejected')}>
      <option value="retry">Unconfirmed / retry</option>
      <option value="saved">Confirmed saved</option>
      <option value="rejected">Rejected</option>
    </select>
    <QuestProgressControls
      quest={QUEST}
      instance={{ id: INSTANCE_ID, current_amount: amount, status: 'available' }}
      disabled={false}
      onLog={onLog}
    />
    <div className="actions">
      <button type="button" className="btn ghost" onClick={seedCorruptJournal}>Seed malformed journal and reload</button>
      <button type="button" className="btn ghost" onClick={reset}>Clear QA journal and reload</button>
    </div>
    <p>Use the browser Refresh button to test persistence. Compare operation IDs in the
      journal and event log; a Retry must reuse the same ID and delta.</p>
    <output aria-label="Mock operation event log" data-testid="qa-operation-log">
      {events.length ? events.join('\n') : 'No mock operations yet'}
    </output>
  </section>;
}
