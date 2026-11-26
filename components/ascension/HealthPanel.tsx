'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LIGHTS_OUT_BASE_XP,
  LIGHTS_OUT_STREAK_BONUS_MAX_XP,
  LIGHTS_OUT_STREAK_BONUS_XP,
  LIGHTS_OUT_TITLE,
} from '../../lib/ascension/config';
import { lightsOutReceipt } from '../../lib/ascension/appleHealth';
import { healthGameDay, healthRecordWindow, lightsOutWeekLabel, rollingLightsOutCount } from '../../lib/ascension/lightsOut';
import { BLANK_MEAL, mealIsLogged, type MealFlags } from '../../lib/ascension/meals';
import { supabase } from '../../lib/supabase';

type FlagKey = keyof MealFlags;

type NutritionRow = {
  energy_kcal: number | string | null;
  protein_g: number | string | null;
  carbs_g: number | string | null;
  fat_g: number | string | null;
  read_status: string | null;
};

const FLAGS: { key: FlagKey; label: string }[] = [
  { key: 'balanced', label: 'Balanced' },
  { key: 'protein', label: 'Protein' },
  { key: 'produce', label: 'Produce' },
  { key: 'delivery', label: 'Delivery' },
];

export function HealthPanel() {
  const today = healthGameDay(new Date());
  const windowDays = healthRecordWindow(today);
  const [night, setNight] = useState(today);
  const [recorded, setRecorded] = useState<string[]>([]);
  const [meal, setMeal] = useState<MealFlags>(BLANK_MEAL);
  const [sleep, setSleep] = useState('');
  const [recovery, setRecovery] = useState('');
  const [message, setMessage] = useState('');
  const [autoReceipt, setAutoReceipt] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<NutritionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const requests = useRef(new Map<string, string>());
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    const client = supabase();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) { setMessage('Sign in to record health.'); return; }
    const [nights, meals, notes, sleepRows, nutritionRows] = await Promise.all([
      client.from('health_lights_out').select('game_day').eq('owner_id', auth.user.id),
      client.from('health_meals').select('game_day,balanced,protein,produce,delivery').eq('owner_id', auth.user.id).eq('game_day', night).maybeSingle(),
      client.from('health_notes').select('sleep_note,recovery_note').eq('owner_id', auth.user.id).eq('game_day', night).maybeSingle(),
      client.from('health_sleep_ingest').select('credited,source_name').eq('owner_id', auth.user.id).eq('game_day', night).maybeSingle(),
      client.from('health_nutrition_days').select('energy_kcal,protein_g,carbs_g,fat_g,read_status').eq('owner_id', auth.user.id).eq('game_day', night).maybeSingle(),
    ]);
    if (nights.error) { setMessage('Health could not load. Nothing was changed.'); return; }
    setRecorded((nights.data ?? []).map((row) => String((row as { game_day: string }).game_day)));
    const sleep = sleepRows.data as { credited?: boolean; source_name?: string | null } | null;
    setAutoReceipt(sleep?.credited ? lightsOutReceipt(sleep.source_name) : null);
    setNutrition(nutritionRows.data ? nutritionRows.data as NutritionRow : null);
    const mealRow = meals.data as MealFlags | null;
    setMeal(mealRow ? {
      balanced: mealRow.balanced ?? null,
      protein: mealRow.protein ?? null,
      produce: mealRow.produce ?? null,
      delivery: mealRow.delivery ?? null,
    } : BLANK_MEAL);
    const noteRow = notes.data as { sleep_note: string | null; recovery_note: string | null } | null;
    setSleep(noteRow?.sleep_note ?? '');
    setRecovery(noteRow?.recovery_note ?? '');
  }, [night]);

  useEffect(() => { void load(); }, [load]);

  function requestId(key: string) {
    const existing = requests.current.get(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    requests.current.set(key, created);
    return created;
  }

  async function recordNight() {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase().rpc('record_lights_out', { p_game_day: night, p_request_id: requestId(`lights:${night}`) });
      if (error) { setMessage(error.message); return; }
      const payload = data as { already?: boolean; xp_awarded?: number };
      setMessage(payload.already ? 'Already recorded for that night. No additional XP.' : `${LIGHTS_OUT_TITLE} recorded. +${payload.xp_awarded ?? 0} XP.`);
      await load();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function saveMeal() {
    if (busy || inFlight.current) return;
    if (!mealIsLogged(meal)) { setMessage('A blank meal stays unlogged. No XP either way.'); return; }
    inFlight.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase().rpc('save_health_meal', {
        p_game_day: night, p_balanced: meal.balanced, p_protein: meal.protein, p_produce: meal.produce, p_delivery: meal.delivery,
      });
      if (error) { setMessage(error.message); return; }
      const payload = data as { xp_awarded?: number };
      setMessage(`Meal logged. +${payload.xp_awarded ?? 0} XP.`);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function saveNotes() {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const { error } = await supabase().rpc('save_health_notes', { p_game_day: night, p_sleep: sleep, p_recovery: recovery });
      if (error) { setMessage(error.message); return; }
      setMessage('Notes saved on your account only. No XP.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function setFlag(key: FlagKey, value: string) {
    setMeal((current) => ({ ...current, [key]: value === '' ? null : value === 'yes' }));
  }

  const loggedTonight = recorded.includes(night);
  return (
    <div className="ascension-track">
      <p className="eyebrow">HEALTH</p>
      <h1>{LIGHTS_OUT_TITLE}</h1>
      <p className="muted">The only required nightly health quest. {lightsOutWeekLabel(rollingLightsOutCount(recorded, today))}.</p>
      <p className="muted">Health only: this game day or the previous 2. The day starts at 5:00 AM Chicago. This is not the 30-day activity window.</p>
      <p className="muted">{LIGHTS_OUT_BASE_XP} XP plus {LIGHTS_OUT_STREAK_BONUS_XP} XP for each prior night, up to {LIGHTS_OUT_STREAK_BONUS_MAX_XP} extra XP. At most {LIGHTS_OUT_BASE_XP + LIGHTS_OUT_STREAK_BONUS_MAX_XP} XP a night. Separate from quest XP.</p>
      <label>Night
        <select className="field" value={night} onChange={(event) => setNight(event.target.value)}>
          {windowDays.map((day) => <option key={day} value={day}>{day === today ? `${day} · this game day` : `${day} · earlier game day`}</option>)}
        </select>
      </label>
      <button type="button" className="btn" disabled={busy || loggedTonight} onClick={() => { void recordNight(); }}>{loggedTonight ? 'Recorded' : 'Record lights out'}</button>
      {autoReceipt && <p role="status">{autoReceipt}</p>}
      <p className="muted"><a href="/settings/apple-health">Connect Apple Health</a> to record this from last night's sleep. Manual entry still works. Whichever arrives first is the one that counts.</p>
      {nutrition && (
        <section aria-label="Nutrition from Apple Health">
          <h2>Nutrition</h2>
          <p className="muted">A private Cronometer import. It does not complete a quest and it awards 0 XP. Only you can see it.</p>
          {nutrition.energy_kcal == null && nutrition.protein_g == null && nutrition.carbs_g == null && nutrition.fat_g == null
            ? <p>No log seen.</p>
            : (
              <ul>
                {nutrition.energy_kcal != null && <li>Dietary energy {nutrition.energy_kcal} kcal</li>}
                {nutrition.protein_g != null && <li>Protein {nutrition.protein_g} g</li>}
                {nutrition.carbs_g != null && <li>Carbohydrates {nutrition.carbs_g} g</li>}
                {nutrition.fat_g != null && <li>Total fat {nutrition.fat_g} g</li>}
              </ul>
            )}
        </section>
      )}

      <section aria-label="Meal log">
        <h2>Meal log</h2>
        <p className="muted">Optional. 0 XP. Leave every flag unset and it stays unlogged.</p>
        {FLAGS.map((flag) => (
          <label key={flag.key}>{flag.label}
            <select className="field" value={meal[flag.key] === null ? '' : meal[flag.key] ? 'yes' : 'no'} onChange={(event) => setFlag(flag.key, event.target.value)}>
              <option value="">Not logged</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        ))}
        <button type="button" className="btn ghost" disabled={busy} onClick={() => { void saveMeal(); }}>Save meal</button>
      </section>

      <section aria-label="Sleep and recovery notes">
        <h2>Sleep and recovery</h2>
        <p className="muted">Only you can read these notes.</p>
        <label>Sleep note
          <textarea className="field" maxLength={500} value={sleep} onChange={(event) => setSleep(event.target.value)} />
        </label>
        <label>Recovery note
          <textarea className="field" maxLength={500} value={recovery} onChange={(event) => setRecovery(event.target.value)} />
        </label>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => { void saveNotes(); }}>Save notes</button>
      </section>
      {message && <p className="message" role="status">{message}</p>}
    </div>
  );
}
