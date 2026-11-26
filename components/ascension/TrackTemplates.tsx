'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { templateRowModels } from '../../lib/ascension/templateView';
import { healthFollowUpsUnlocked, type TemplateState, type TrackId } from '../../lib/ascension/templates';
import { gameDayParts } from '../../lib/questStreak';
import { supabase } from '../../lib/supabase';

export function TrackTemplates({ track }: { track: TrackId }) {
  const [states, setStates] = useState<TemplateState[]>([]);
  const [nights, setNights] = useState<string[]>([]);
  const [paydayDone, setPaydayDone] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const requests = useRef(new Map<string, string>());
  const inFlight = useRef(false);
  const today = gameDayParts(new Date()).date;
  const unlocked = track === 'finance' || healthFollowUpsUnlocked(nights, today);

  const load = useCallback(async () => {
    const client = supabase();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) { setMessage('Sign in to see these quests.'); return; }
    const [stateResult, nightResult, checkResult] = await Promise.all([
      client.from('track_template_states').select('template_id,status').eq('owner_id', auth.user.id).eq('track', track),
      track === 'health'
        ? client.from('health_lights_out').select('game_day').eq('owner_id', auth.user.id)
        : Promise.resolve({ data: [], error: null }),
      track === 'finance'
        ? client.from('finance_payday_checks').select('payday').eq('owner_id', auth.user.id).limit(1)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (stateResult.error) { setMessage('Templates could not load. Nothing was changed.'); return; }
    setStates(((stateResult.data ?? []) as { template_id: string; status: TemplateState['status'] }[])
      .map((row) => ({ id: row.template_id, status: row.status })));
    if (!nightResult.error) setNights((nightResult.data ?? []).map((row) => String((row as { game_day: string }).game_day)));
    setPaydayDone(!checkResult.error && (checkResult.data ?? []).length > 0);
  }, [track]);

  useEffect(() => { void load(); }, [load]);

  function requestId(key: string) {
    const existing = requests.current.get(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    requests.current.set(key, created);
    return created;
  }

  async function act(action: 'start' | 'complete' | 'skip', id: string) {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    const rpc = action === 'start' ? 'start_track_template' : action === 'complete' ? 'complete_track_template' : 'skip_track_template';
    try {
      const { data, error } = await supabase().rpc(rpc, { p_track: track, p_template: id, p_request_id: requestId(`${action}:${id}`) });
      if (error) { setMessage(error.message); return; }
      const payload = data as { already?: boolean; xp_awarded?: number };
      if (action === 'complete' && !payload.already) setMessage(`Quest complete. +${payload.xp_awarded ?? 0} XP.`);
      else if (payload.already) setMessage('Already recorded. No additional XP.');
      else setMessage(action === 'skip' ? 'Skipped. No XP.' : 'Started. No XP until it is done.');
      await load();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const merged = paydayDone ? [...states.filter((state) => state.id !== 'payday_check'), { id: 'payday_check', status: 'complete' as const }] : states;
  const rows = templateRowModels(track, merged, unlocked);
  return (
    <section className="ascension-track" aria-label={track === 'health' ? 'Health follow-ups' : 'Finance templates'}>
      <h2>{track === 'health' ? 'Optional follow-ups' : 'Finance templates'}</h2>
      {track === 'health' && <p className="muted">{unlocked ? 'One follow-up at a time. Credit when you mark it done.' : 'Unlocks later. Six lights-out nights in each of two straight game weeks, then you can start one.'}</p>}
      <ul className="ascension-templates">
        {rows.map((row) => (
          <li key={row.id} className="ascension-row" data-template={row.id}>
            <div>
              <strong>{row.title}</strong>
              <span className="muted">{row.label}</span>
              {row.detail && <p className="muted">{row.detail}</p>}
            </div>
            {row.canStart && <button type="button" className="btn" disabled={busy} onClick={() => { void act('start', row.id); }}>Start</button>}
            {row.canFinish && <button type="button" className="btn" disabled={busy} onClick={() => { void act('complete', row.id); }}>Mark done</button>}
            {row.canSkip && row.id !== 'payday_check' && <button type="button" className="btn ghost" disabled={busy} onClick={() => { void act('skip', row.id); }}>Skip</button>}
          </li>
        ))}
      </ul>
      {message && <p className="message" role="status">{message}</p>}
    </section>
  );
}
