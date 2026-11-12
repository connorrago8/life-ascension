'use client';

import { useState } from 'react';
import '../../app/couple.css';
import type { DateNightPlan } from '../../lib/dateNightPlan';
import { supabase } from '../../lib/supabase';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function DateNightOffer({ plan, onSaved }: { plan: DateNightPlan; onSaved?: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const when = `${DAYS[plan.due.weekday - 1]} ${((plan.due.hour + 11) % 12) + 1}:${String(plan.due.minute).padStart(2, '0')} ${plan.due.hour < 12 ? 'AM' : 'PM'}`;

  async function save() {
    setBusy(true);
    setNote('');
    const { data, error } = await supabase().rpc('couple_create_date_night', {
      p_title: plan.title,
      p_steps: plan.steps,
      p_weekday: plan.due.weekday,
      p_hour: plan.due.hour,
      p_minute: plan.due.minute,
    });
    setBusy(false);
    if (error) {
      setNote(error.message);
      return;
    }
    setNote('Saved. Both of you mark the night done when it happens.');
    if (typeof data === 'string') onSaved?.(data);
  }

  return (
    <section className="couple-card" aria-label="Date night plan">
      <p className="couple-meta">Date night</p>
      <h2>{plan.title}</h2>
      <p className="muted">{when}</p>
      <ol className="couple-steps">
        {plan.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <div className="couple-actions">
        <button className="btn" type="button" disabled={busy} onClick={() => void save()}>Save this night</button>
      </div>
      {note && <p className="message" role="status">{note}</p>}
    </section>
  );
}
