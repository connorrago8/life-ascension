'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FINANCE_DECISIONS,
  FINANCE_DECISION_LABEL,
  PAYDAY_TITLE,
  type FinanceDecision,
} from '../../lib/ascension/config';
import { paydayDates } from '../../lib/ascension/payday';
import { gameDayParts } from '../../lib/questStreak';
import { supabase } from '../../lib/supabase';

type Check = { payday: string; decision: FinanceDecision };

export function FinancePanel() {
  const today = gameDayParts(new Date()).date;
  const dates = paydayDates();
  const openDates = dates.filter((day) => day <= today);
  const [payday, setPayday] = useState(openDates.at(-1) ?? dates[0]);
  const [decision, setDecision] = useState<FinanceDecision>('minimum_only');
  const [checks, setChecks] = useState<Check[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const requests = useRef(new Map<string, string>());
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    const client = supabase();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) { setMessage('Sign in to see finance.'); return; }
    const checkResult = await client.from('finance_payday_checks').select('payday,decision').eq('owner_id', auth.user.id);
    if (checkResult.error) { setMessage('Finance could not load. Nothing was changed.'); return; }
    setChecks((checkResult.data ?? []) as Check[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function requestId(key: string) {
    const existing = requests.current.get(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    requests.current.set(key, created);
    return created;
  }

  const saved = checks.find((check) => check.payday === payday);
  const next = dates.find((day) => day > today);

  async function complete() {
    if (busy || inFlight.current || saved) return;
    if (payday > today) { setMessage('This check opens on its payday. Nothing was awarded.'); return; }
    inFlight.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase().rpc('complete_payday_check', {
        p_payday: payday, p_decision: decision, p_request_id: requestId(`payday:${payday}`),
      });
      if (error) { setMessage(error.message); return; }
      const payload = data as { already?: boolean; xp_awarded?: number };
      setMessage(payload.already
        ? 'Already recorded. No additional XP.'
        : `Payday check complete. +${payload.xp_awarded ?? 0} XP. Every decision earns the same quest credit.`);
      await load();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="ascension-track">
      <p className="eyebrow">FINANCE</p>
      <h1>{PAYDAY_TITLE}</h1>
      <p className="muted">Biweekly from {dates[0]} through {dates.at(-1)}. Skipping a follow-up has no penalty.</p>
      <p className="muted">Every decision earns the same quest credit, including an extra payment when nothing extra is sent.</p>
      {next && <p>Next payday: {next}</p>}
      <label>Payday
        <select className="field" value={payday} onChange={(event) => setPayday(event.target.value)}>
          {dates.map((day) => <option key={day} value={day} disabled={day > today}>{day}{day > today ? ' · not open yet' : ''}</option>)}
        </select>
      </label>
      <label>Decision
        <select className="field" value={decision} onChange={(event) => setDecision(event.target.value as FinanceDecision)} disabled={!!saved}>
          {FINANCE_DECISIONS.map((item) => <option key={item} value={item}>{FINANCE_DECISION_LABEL[item]}</option>)}
        </select>
      </label>
      {saved
        ? <p>Recorded as {FINANCE_DECISION_LABEL[saved.decision]}.</p>
        : <button type="button" className="btn" disabled={busy || payday > today} onClick={() => { void complete(); }}>Complete payday check</button>}
      {message && <p className="message" role="status">{message}</p>}
    </div>
  );
}
