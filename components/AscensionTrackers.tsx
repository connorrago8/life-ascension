'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { meals, paydayFields, paydaySummary, paydays, shiftDate } from '../lib/ascension/trackers';
import { supabase } from '../lib/supabase';

type Track = 'health' | 'finance';
type Values = Record<string, string>;
type Entry = { track: Track; entry_date: string; tracker: Values; quest_id: string | null };

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (cents: number) => dollars.format(cents / 100);

export default function AscensionTrackers({ today, refresh }: { today: string; refresh: () => Promise<void> }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState('Loading trackers…');
  const [ready, setReady] = useState(false);

  async function reload() {
    const { data, error } = await supabase().from('ascension_entries')
      .select('track,entry_date,tracker,quest_id').gte('entry_date', shiftDate(today, -30));
    setStatus(error ? 'Trackers could not load. Try again.' : '');
    setReady(!error);
    if (!error) setEntries(data as Entry[]);
  }

  useEffect(() => {
    void reload();
    // The parent keys this component by signed-in account and game date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const firstDay = shiftDate(today, -6);
  const healthCount = entries.filter(entry => entry.track === 'health' && entry.entry_date >= firstDay
    && entry.entry_date <= today && entry.quest_id).length;
  const pastPaydays = paydays.filter(date => date <= today && date >= shiftDate(today, -30));
  const healthDates = [today, shiftDate(today, -1), shiftDate(today, -2)];

  return <>
    {status && <p role="status">{status} {!ready && status.includes('could not') &&
      <button type="button" className="btn ghost" onClick={() => void reload()}>Retry</button>}</p>}
    {ready && <>
      <Tracker track="health" dates={healthDates} entries={entries} refresh={async () => { await Promise.all([reload(), refresh()]); }}>
        <p className="muted">Lights out by 11 PM · {healthCount} of the past 7 nights · Goal: 6</p>
      </Tracker>
      <Tracker track="finance" dates={pastPaydays.reverse()} entries={entries} refresh={async () => { await Promise.all([reload(), refresh()]); }}>
        <p className="muted">Complete my payday money check</p>
        {!pastPaydays.length && <p>Next payday review: {paydays.find(date => date > today) ?? 'Program complete'}</p>}
      </Tracker>
    </>}
  </>;
}

function Tracker({ track, dates, entries, refresh, children }: {
  track: Track; dates: string[]; entries: Entry[]; refresh: () => Promise<void>; children: React.ReactNode;
}) {
  const [selected, select] = useState('');
  const date = dates.includes(selected) ? selected : dates[0];
  const entry = entries.find(item => item.track === track && item.entry_date === date);
  return <details className="panel">
    <summary>{track === 'health' ? 'Health' : 'Finance'}</summary>
    {children}
    {date && <>
      <label>{track === 'health' ? 'Log date' : 'Payday'}
        <select className="field" value={date} onChange={event => select(event.target.value)}>
          {dates.map(option => <option key={option}>{option}</option>)}
        </select>
      </label>
      <TrackerForm key={date} track={track} date={date} entry={entry} refresh={refresh} />
    </>}
  </details>;
}

function TrackerForm({ track, date, entry, refresh }: {
  track: Track; date: string; entry?: Entry; refresh: () => Promise<void>;
}) {
  const [values, setValues] = useState<Values>(entry?.tracker ?? {});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);
  const set = (key: string, value: string) => setValues(previous => ({ ...previous, [key]: value }));
  const summary = paydaySummary(values);
  const canComplete = track === 'finance' ? Boolean(values.decision?.trim()) : date >= '2026-11-26';

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase().rpc('save_ascension_entry', {
        p_track: track, p_date: date,
        p_tracker: track === 'finance' ? { ...values, recommendation: JSON.stringify(summary) } : values,
        p_complete: complete && canComplete,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setComplete(false);
      setMessage('Saved.');
      await refresh();
    } catch {
      setMessage('Could not refresh. Reload to confirm the saved entry.');
    } finally {
      setBusy(false);
    }
  }

  function checkbox(key: string, label: string) {
    return <label><input type="checkbox" checked={values[key] === 'yes'}
      onChange={event => set(key, event.target.checked ? 'yes' : '')} /> {label}</label>;
  }

  return <form onSubmit={save}>
    {track === 'health' ? <>
      <h3>Nutrition log</h3>
      {meals.map(meal => <fieldset key={meal}>
        <legend>{meal}</legend>
        {checkbox(meal + 'balanced', 'Balanced')}
        {checkbox(meal + 'protein', 'Protein-rich')}
      </fieldset>)}
      <div>{checkbox('produce', 'Ate fruit and vegetables')}</div>
      <div>{checkbox('delivery', 'Ordered food delivery')}</div>
      <p>{meals.filter(meal => values[meal + 'balanced'] === 'yes').length}/3 balanced · {meals.filter(meal => values[meal + 'protein'] === 'yes').length}/3 protein-rich</p>
      <details>
        <summary>Optional recovery log</summary>
        <label>Sleep hours
          <input className="field" type="number" min="0" max="24" step=".1" value={values.sleep ?? ''}
            onChange={event => set('sleep', event.target.value)} />
        </label>
        <label>Recovery notes
          <textarea className="field" maxLength={300} value={values.recovery ?? ''}
            onChange={event => set('recovery', event.target.value)} />
        </label>
      </details>
    </> : <>
      <h3>Payday tracker</h3>
      <p>Next action: check upcoming minimums and confirm the nearest promo with the issuer.</p>
      <label>Next promo due date
        <input className="field" type="date" value={values.deadline ?? ''} onChange={event => set('deadline', event.target.value)} />
      </label>
      <label>Promo and statement source
        <input className="field" maxLength={160} value={values.source ?? ''} onChange={event => set('source', event.target.value)} />
      </label>
      {paydayFields.map(([key, label]) => <label key={key}>{label}
        <input className="field" inputMode="decimal" maxLength={14} value={values[key] ?? ''}
          onChange={event => set(key, event.target.value)} />
      </label>)}
      <p>Safe extra payment: {summary.safe === null ? 'Review needed' : money(summary.safe)}</p>
      {Boolean(summary.shortfall) && <p>Upcoming obligations shortfall: {money(summary.shortfall!)}</p>}
      <p>Promo funding gap: {summary.gap === null || !values.source?.trim() || !values.deadline
        ? 'Review needed' : money(summary.gap)}</p>
      <label>My decision
        <textarea className="field" maxLength={300} value={values.decision ?? ''}
          onChange={event => set('decision', event.target.value)} />
      </label>
    </>}
    {entry?.quest_id ? <p>Quest completed</p> :
      <label><input type="checkbox" checked={complete && canComplete} disabled={!canComplete}
        onChange={event => setComplete(event.target.checked)} /> {track === 'health'
          ? 'I turned the lights out by 11 PM' : 'Complete payday quest with this decision'}</label>}
    <div><button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save tracker'}</button></div>
    <p role="status">{message}</p>
  </form>;
}
