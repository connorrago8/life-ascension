'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nutritionDiaryWindow, nutritionToday } from '../../lib/nutrition/dates';
import { parseMealText, scaleItem } from '../../lib/nutrition/parseFood';
import { overview, rollupHistory, type DiaryRow } from '../../lib/nutrition/summary';
import { sourceBadge, type DraftItem, type DraftMeal, type HistoryMeal, type MemoryMeal, type PortionMemory } from '../../lib/nutrition/types';
import { supabase } from '../../lib/supabase';

type EntryItem = DraftItem & { id: string };
type Entry = {
  id: string;
  diaryDate: string;
  mealLabel: string;
  note: string | null;
  items: EntryItem[];
  logDurationMs: number | null;
};
type Favorite = { id: string; name: string; alias: string | null; items: MemoryMeal['items'] };

const COPY = {
  overview: 'Nutrition overview',
  empty: 'No entries yet',
  log: 'Log a meal',
  review: 'Review estimate',
  adjust: 'Adjust portion',
  repeat: 'Repeat meal',
  favorite: 'Save as favorite',
  remember: 'Remember this for next time?',
  saved: "You've logged your meal",
  estimate: 'Estimate, you can edit this',
};

export function NutritionDiary() {
  const today = nutritionToday(new Date());
  const days = nutritionDiaryWindow(today);
  const [diaryDate, setDiaryDate] = useState(today);
  const [text, setText] = useState('');
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftMeal[] | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [portions, setPortions] = useState<PortionMemory[]>([]);
  const [photoAllowed, setPhotoAllowed] = useState(false);
  const [photoOn, setPhotoOn] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [alias, setAlias] = useState('');
  const [brand, setBrand] = useState('');
  const keys = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const client = supabase();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return;
    const start = nutritionDiaryWindow(today)[nutritionDiaryWindow(today).length - 1];
    const [entryRes, itemRes, savedRes, aliasRes, portionRes, savedItemRes] = await Promise.all([
      client.from('nutrition_entries').select('id,diary_date,meal_label,note,log_duration_ms,confirmed_at').eq('owner_id', auth.user.id).gte('diary_date', start).order('confirmed_at', { ascending: false }),
      client.from('nutrition_items').select('id,entry_id,position,name,quantity,unit,calories,protein_g,carbs_g,fat_g,fiber_g,fluid_oz,source,confidence,fdc_id,fdc_description,assumption,source_label').eq('owner_id', auth.user.id),
      client.from('saved_meals').select('id,name').eq('owner_id', auth.user.id).order('updated_at', { ascending: false }).limit(20),
      client.from('nutrition_aliases').select('alias,saved_meal_id').eq('owner_id', auth.user.id),
      client.from('nutrition_portion_memory').select('food_key,quantity,unit,calories,protein_g,carbs_g,fat_g,fiber_g,fluid_oz').eq('owner_id', auth.user.id),
      client.from('saved_meal_items').select('saved_meal_id,position,name,quantity,unit,calories,protein_g,carbs_g,fat_g,fiber_g,fluid_oz').eq('owner_id', auth.user.id),
    ]);
    if (entryRes.error) return;
    const items = (itemRes.data ?? []) as Row[];
    setEntries(((entryRes.data ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      diaryDate: String(row.diary_date),
      mealLabel: String(row.meal_label),
      note: row.note ? String(row.note) : null,
      logDurationMs: row.log_duration_ms == null ? null : Number(row.log_duration_ms),
      items: items.filter((item) => item.entry_id === row.id).sort((a, b) => Number(a.position) - Number(b.position)).map(toDraft),
    })));
    const aliases = (aliasRes.data ?? []) as Row[];
    const savedItemRows = (savedItemRes.data ?? []) as Row[];
    setFavorites(((savedRes.data ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      alias: aliases.find((item) => item.saved_meal_id === row.id)?.alias ? String(aliases.find((item) => item.saved_meal_id === row.id)?.alias) : null,
      items: savedItemRows.filter((item) => item.saved_meal_id === row.id).sort((a, b) => Number(a.position) - Number(b.position)).map((item) => ({
        name: String(item.name),
        quantity: Number(item.quantity),
        unit: String(item.unit),
        calories: Number(item.calories),
        proteinG: Number(item.protein_g),
        carbsG: Number(item.carbs_g),
        fatG: Number(item.fat_g),
        fiberG: item.fiber_g == null ? null : Number(item.fiber_g),
        fluidOz: item.fluid_oz == null ? null : Number(item.fluid_oz),
      })),
    })));
    setPortions(((portionRes.data ?? []) as Row[]).map((row) => ({
      foodKey: String(row.food_key),
      quantity: Number(row.quantity),
      unit: String(row.unit),
      calories: Number(row.calories),
      proteinG: Number(row.protein_g),
      carbsG: Number(row.carbs_g),
      fatG: Number(row.fat_g),
      fiberG: row.fiber_g == null ? null : Number(row.fiber_g),
      fluidOz: row.fluid_oz == null ? null : Number(row.fluid_oz),
    })));
  }, [today]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    void fetch('/api/nutrition/config').then(async (response) => {
      if (!response.ok) return;
      const body = await response.json() as { photo?: boolean };
      setPhotoAllowed(body.photo === true);
    }).catch(() => setPhotoAllowed(false));
  }, []);

  const memory = useMemo<MemoryMeal[]>(() => favorites.flatMap((favorite) => {
    const items = favorite.items.length ? favorite.items : [];
    if (items.length === 0) return [];
    const meals = [{ alias: favorite.name.toLowerCase(), name: favorite.name, items }];
    if (favorite.alias) meals.push({ alias: favorite.alias.toLowerCase(), name: favorite.name, items });
    return meals;
  }), [favorites]);

  const history = useMemo<HistoryMeal[]>(() => entries.map((entry) => ({
    diaryDate: entry.diaryDate,
    mealLabel: entry.mealLabel,
    items: entry.items.map(strip),
  })), [entries]);

  const rows = useMemo<DiaryRow[]>(() => entries.map((entry) => ({
    diaryDate: entry.diaryDate,
    mealLabel: entry.mealLabel,
    calories: sum(entry.items, 'calories'),
    proteinG: sum(entry.items, 'proteinG'),
    carbsG: sum(entry.items, 'carbsG'),
    fatG: sum(entry.items, 'fatG'),
    fiberG: entry.items.every((item) => item.fiberG === null) ? null : sum(entry.items, 'fiberG'),
    fluidOz: entry.items.reduce((total, item) => total + (item.fluidOz ?? 0), 0),
  })), [entries]);
  const dayRows = rows.filter((row) => row.diaryDate === diaryDate);
  const snap = overview(dayRows);
  const rollup = rollupHistory(rows, today);

  function markStart() {
    setStartedAt((current) => current ?? new Date().toISOString());
  }

  async function review() {
    markStart();
    const local = parseMealText(text, { now: new Date(), memory, history, portions });
    const requestId = crypto.randomUUID();
    keys.current.set('parse', requestId);
    setDrafts(local.meals.map((meal) => ({ ...meal, diaryDate: meal.kind === 'log' && !/yesterday|last night/i.test(text) ? diaryDate : meal.diaryDate })));
    setEditingId(null);
    setMessage('');
    try {
      const response = await fetch('/api/nutrition/parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, requestId, memory, history, portions }),
      });
      if (!response.ok) return;
      const body = await response.json() as { meals?: DraftMeal[] };
      if (body.meals?.length) {
        setDrafts(body.meals.map((meal) => ({ ...meal, diaryDate: meal.diaryDate || diaryDate })));
      }
    } catch {
      setMessage('Showing the on-device estimate. You can edit it.');
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file || !photoOn) return;
    markStart();
    setBusy(true);
    try {
      const body = new FormData();
      body.set('photo', file);
      body.set('requestId', crypto.randomUUID());
      const response = await fetch('/api/nutrition/parse', { method: 'POST', body });
      const payload = await response.json() as { message?: string; error?: string };
      setMessage(payload.message || payload.error || 'Photo logging did not return foods.');
    } finally {
      setBusy(false);
    }
  }

  function updateItem(mealIndex: number, itemIndex: number, patch: Partial<DraftItem>) {
    setDrafts((current) => (current ?? []).map((meal, index) => {
      if (index !== mealIndex) return meal;
      const items = meal.items.map((item, cursor) => {
        if (cursor !== itemIndex) return item;
        if (patch.quantity != null && patch.quantity !== item.quantity) return scaleItem(item, patch.quantity);
        return { ...item, ...patch, source: 'user_edited' as const, fdcId: null, assumption: 'You edited this estimate.' };
      });
      return { ...meal, items };
    }));
  }

  async function saveMeal(meal: DraftMeal, index: number) {
    if (busy || meal.items.length === 0) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setMessage('Sign in to save this meal. The estimate stays here until you do.');
      return;
    }
    setBusy(true);
    const keyName = editingId ?? `draft:${index}:${meal.mealLabel}`;
    const idempotencyKey = keys.current.get(keyName) ?? crypto.randomUUID();
    keys.current.set(keyName, idempotencyKey);
    try {
      const client = supabase();
      const payload = {
        p_diary_date: meal.diaryDate,
        p_meal_label: meal.mealLabel,
        p_note: [meal.note, brand.trim() ? `Brand note: ${brand.trim()}` : null].filter(Boolean).join(' ') || null,
        p_items: meal.items.map(rpcItem),
      };
      const { error } = editingId
        ? await client.rpc('update_nutrition_entry', { p_entry_id: editingId, ...payload })
        : await client.rpc('confirm_nutrition_entry', {
          ...payload,
          p_idempotency_key: idempotencyKey,
          p_source_text: text,
          p_log_started_at: startedAt,
          p_parse_request_id: keys.current.get('parse') ?? null,
          p_origin: 'text',
        });
      if (error) { setMessage(error.message); return; }
      keys.current.delete(keyName);
      setDrafts(null);
      setText('');
      setEditingId(null);
      setBrand('');
      setStartedAt(null);
      setMessage(COPY.saved);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function repeat(favorite: Favorite) {
    if (busy) return;
    setBusy(true);
    const idempotencyKey = keys.current.get(`fav:${favorite.id}`) ?? crypto.randomUUID();
    keys.current.set(`fav:${favorite.id}`, idempotencyKey);
    try {
      const { error } = await supabase().rpc('log_saved_meal', {
        p_saved_meal_id: favorite.id,
        p_diary_date: diaryDate,
        p_idempotency_key: idempotencyKey,
        p_log_started_at: new Date().toISOString(),
      });
      if (error) { setMessage(error.message); return; }
      keys.current.delete(`fav:${favorite.id}`);
      setMessage(COPY.saved);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveFavorite(entryId: string, name: string) {
    const { error } = await supabase().rpc('save_nutrition_favorite', { p_entry_id: entryId, p_name: name, p_alias: alias });
    if (error) { setMessage(error.message); return; }
    setAlias('');
    setMessage('Saved for one-tap repeat.');
    await load();
  }

  async function remember(item: DraftItem) {
    const { error } = await supabase().rpc('remember_nutrition_portion', {
      p_food_key: item.name.toLowerCase(),
      p_quantity: item.quantity,
      p_unit: item.unit,
      p_calories: item.calories,
      p_protein_g: item.proteinG,
      p_carbs_g: item.carbsG,
      p_fat_g: item.fatG,
      p_fiber_g: item.fiberG,
      p_fluid_oz: item.fluidOz,
    });
    setMessage(error ? error.message : 'Remembered for next time.');
  }

  async function remove(id: string) {
    const { error } = await supabase().rpc('delete_nutrition_entry', { p_entry_id: id });
    if (error) { setMessage(error.message); return; }
    await load();
  }

  return (
    <section className="nutrition-diary" aria-label={COPY.overview}>
      <h2>{COPY.overview}</h2>
      <p className="muted">Logging a meal awards 0 XP. Only you can read this diary.</p>
      <p>{snap.meals} meals · {snap.proteinG} g protein · {snap.fluidOz} fl oz drinks</p>
      {dayRows.length === 0 && <p>{COPY.empty}</p>}
      <details>
        <summary>Calories, carbs, fat, and fiber</summary>
        <p>{dayRows.reduce((sum, row) => sum + row.calories, 0)} kcal · {dayRows.reduce((sum, row) => sum + row.carbsG, 0)} g carbs · {dayRows.reduce((sum, row) => sum + row.fatG, 0)} g fat · {dayRows.every((row) => row.fiberG === null) ? '—' : `${dayRows.reduce((sum, row) => sum + (row.fiberG ?? 0), 0)} g fiber`}</p>
      </details>

      <label>Diary date
        <select className="field" value={diaryDate} onChange={(event) => setDiaryDate(event.target.value)}>
          {days.map((day) => <option key={day} value={day}>{day === today ? `${day} · this game day` : day}</option>)}
        </select>
      </label>
      <label>{COPY.log}
        <textarea className="field" maxLength={1000} value={text} placeholder="2 eggs and toast" onChange={(event) => { markStart(); setText(event.target.value); }} />
      </label>
      <button type="button" className="btn" disabled={busy || text.trim().length === 0} onClick={() => { void review(); }}>{COPY.review}</button>
      {photoAllowed && (
        <label className="nutrition-photo">
          <input type="checkbox" checked={photoOn} onChange={(event) => setPhotoOn(event.target.checked)} />
          {' '}Photo logging (experimental)
        </label>
      )}
      {photoAllowed && photoOn && (
        <input className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void onPhoto(event.target.files?.[0]); }} />
      )}

      {drafts?.map((meal, mealIndex) => (
        <article key={`${meal.mealLabel}-${mealIndex}`} className="nutrition-draft">
          <h3>{meal.kind === 'remove' ? 'Remove last meal' : meal.mealLabel}</h3>
          {meal.assumptions.map((line) => <p key={line} className="muted">{line}</p>)}
          {meal.clarification && (
            <label>{meal.clarification}
              <input className="field" value={brand} onChange={(event) => setBrand(event.target.value)} />
            </label>
          )}
          {meal.kind === 'remove' && entries[0] && (
            <button type="button" className="btn ghost" onClick={() => { void remove(entries[0].id); }}>Remove last meal</button>
          )}
          {meal.items.map((item, itemIndex) => (
            <div key={`${item.name}-${itemIndex}`} className="nutrition-item">
              <p>
                <strong>{item.name}</strong>{' '}
                <span className="nutrition-badge">{sourceBadge(item.source)}</span>
                {item.confidence === 'low' && <span className="nutrition-badge">Low confidence</span>}
              </p>
              {item.assumption && <p className="muted">{item.assumption}</p>}
              <label>{COPY.adjust}
                <input className="field" inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(mealIndex, itemIndex, { quantity: Number(event.target.value) })} />
              </label>
              <div className="nutrition-grid">
                <label>kcal<input className="field" inputMode="decimal" value={item.calories} onChange={(event) => updateItem(mealIndex, itemIndex, { calories: Number(event.target.value) })} /></label>
                <label>protein<input className="field" inputMode="decimal" value={item.proteinG} onChange={(event) => updateItem(mealIndex, itemIndex, { proteinG: Number(event.target.value) })} /></label>
                <label>carbs<input className="field" inputMode="decimal" value={item.carbsG} onChange={(event) => updateItem(mealIndex, itemIndex, { carbsG: Number(event.target.value) })} /></label>
                <label>fat<input className="field" inputMode="decimal" value={item.fatG} onChange={(event) => updateItem(mealIndex, itemIndex, { fatG: Number(event.target.value) })} /></label>
              </div>
              {(item.source === 'personal' || item.source === 'user_edited') && (
                <button type="button" className="btn ghost" onClick={() => { void remember(item); }}>{COPY.remember}</button>
              )}
            </div>
          ))}
          {meal.items.length > 0 && (
            <button type="button" className="btn" disabled={busy} onClick={() => { void saveMeal(meal, mealIndex); }}>Save meal</button>
          )}
        </article>
      ))}

      <h3>Favorites</h3>
      {favorites.length === 0 && <p className="muted">Save a confirmed meal, then repeat it in one tap.</p>}
      {favorites.map((favorite) => (
        <button key={favorite.id} type="button" className="btn" disabled={busy} onClick={() => { void repeat(favorite); }}>{COPY.repeat}: {favorite.name}</button>
      ))}

      <h3>History</h3>
      <p className="muted">This week {rollup.week.meals} meals · {rollup.week.proteinG} g protein. This month {rollup.month.meals} meals · {rollup.month.proteinG} g protein.</p>
      {entries.length === 0 && <p>{COPY.empty}</p>}
      {entries.map((entry) => (
        <article key={entry.id} className="nutrition-item">
          <p><strong>{entry.diaryDate}</strong> · {entry.mealLabel}{entry.logDurationMs != null ? ` · ${Math.round(entry.logDurationMs / 100) / 10}s` : ''}</p>
          {entry.items.map((item) => (
            <p key={item.id}>{item.name} · {item.quantity} {item.unit} · {item.calories} kcal · <span className="nutrition-badge">{item.source === 'generic' || item.source === 'convention' ? COPY.estimate : sourceBadge(item.source)}</span></p>
          ))}
          <button type="button" className="btn ghost" onClick={() => { setEditingId(entry.id); setDrafts([{ kind: 'log', mealLabel: entry.mealLabel, diaryDate: entry.diaryDate, items: entry.items, note: entry.note, clarification: null, assumptions: [], factor: null, setQuantity: null, foodHint: null }]); }}>Edit</button>
          <button type="button" className="btn ghost" onClick={() => { void saveFavorite(entry.id, entry.mealLabel); }}>{COPY.favorite}</button>
          <label>Also answers to (optional)
            <input className="field" value={alias} placeholder="my usual breakfast" onChange={(event) => setAlias(event.target.value)} />
          </label>
          <button type="button" className="btn ghost" onClick={() => { void remove(entry.id); }}>Delete</button>
        </article>
      ))}
      {message && <p className="message" role="status">{message}</p>}
    </section>
  );
}

type Row = Record<string, unknown>;

function toDraft(row: Row): EntryItem {
  return {
    id: String(row.id),
    name: String(row.name),
    quantity: Number(row.quantity),
    unit: String(row.unit),
    calories: Number(row.calories),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    fiberG: row.fiber_g == null ? null : Number(row.fiber_g),
    fluidOz: row.fluid_oz == null ? null : Number(row.fluid_oz),
    source: row.source as DraftItem['source'],
    confidence: row.confidence as DraftItem['confidence'],
    fdcId: row.fdc_id == null ? null : Number(row.fdc_id),
    fdcDescription: row.fdc_description ? String(row.fdc_description) : null,
    assumption: row.assumption ? String(row.assumption) : null,
  };
}

function strip(item: DraftItem) {
  return {
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    calories: item.calories,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
    fiberG: item.fiberG,
    fluidOz: item.fluidOz,
  };
}

function rpcItem(item: DraftItem) {
  return {
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    calories: item.calories,
    protein_g: item.proteinG,
    carbs_g: item.carbsG,
    fat_g: item.fatG,
    fiber_g: item.fiberG,
    fluid_oz: item.fluidOz,
    source: item.source,
    confidence: item.confidence,
    fdc_id: item.fdcId,
    fdc_description: item.fdcDescription,
    assumption: item.assumption,
  };
}

function sum(items: EntryItem[], key: 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG'): number {
  return Math.round(items.reduce((total, item) => total + Number(item[key] ?? 0), 0) * 10) / 10;
}
