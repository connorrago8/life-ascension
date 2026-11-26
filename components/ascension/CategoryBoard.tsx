'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { prioritizeQuests, questCategory, type BoardStatus } from '../../lib/ascension/board';
import {
  FINANCE_DECISIONS,
  FINANCE_DECISION_LABEL,
  LIGHTS_OUT_TITLE,
  PAYDAY_TITLE,
  QUEST_CATEGORIES,
  type FinanceDecision,
  type QuestCategoryId,
} from '../../lib/ascension/config';
import { healthRecordWindow } from '../../lib/ascension/lightsOut';
import { isPayday, paydayDates } from '../../lib/ascension/payday';
import { gameDayParts } from '../../lib/questStreak';
import { supabase } from '../../lib/supabase';

type Row = {
  key: string;
  title: string;
  due: string | null;
  status: BoardStatus;
  instanceId: string | null;
  couple: boolean;
  kind: 'quest' | 'lights_out' | 'payday';
  category: QuestCategoryId;
};

function dueLabel(due: string | null, today: string, status: BoardStatus): string {
  if (status === 'completed') return 'Done';
  if (!due) return 'Due today';
  if (due < today) return `Overdue · ${due}`;
  if (due === today) return `Due today · ${due}`;
  return `Upcoming · ${due}`;
}

export function CategoryBoard({ only, limit = 2 }: { only?: QuestCategoryId; limit?: number | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [today, setToday] = useState('');
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [decision, setDecision] = useState<FinanceDecision>('minimum_only');
  const requests = useRef(new Map<string, string>());
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    const gameDay = gameDayParts(new Date()).date;
    setToday(gameDay);
    const client = supabase();
    const { data: auth } = await client.auth.getUser();
    const user = auth.user;
    if (!user) {
      setRows([]);
      setMessage('Sign in to see your quests.');
      return;
    }
    const [questsResult, instancesResult, nightsResult, checksResult, coupleResult] = await Promise.all([
      client.from('quests').select('id,title,domain,active').eq('owner_id', user.id).eq('active', true).limit(1000),
      client.from('quest_instances').select('id,quest_id,due_date,status').eq('owner_id', user.id).limit(1000),
      client.from('health_lights_out').select('game_day').eq('owner_id', user.id).limit(100),
      client.from('finance_payday_checks').select('payday').eq('owner_id', user.id).limit(100),
      client.rpc('couple_board'),
    ]);
    if (questsResult.error || instancesResult.error) {
      setMessage('Quests could not load. Your progress is unchanged.');
      return;
    }
    const nights = new Set((nightsResult.data ?? []).map((row) => String((row as { game_day: string }).game_day)));
    const checks = new Set((checksResult.data ?? []).map((row) => String((row as { payday: string }).payday)));
    const instances = (instancesResult.data ?? []) as { id: string; quest_id: string; due_date: string; status: BoardStatus }[];
    const next: Row[] = [];
    for (const quest of (questsResult.data ?? []) as { id: string; title: string; domain: string }[]) {
      const own = instances.filter((instance) => instance.quest_id === quest.id);
      const open = own.find((instance) => instance.status === 'available') ?? own[0];
      const status = open?.status ?? 'available';
      const due = open?.due_date ?? null;
      next.push({
        key: `quest:${quest.id}`,
        title: quest.title,
        due,
        status,
        instanceId: open?.id ?? null,
        couple: false,
        kind: 'quest',
        category: questCategory({ title: quest.title, domain: quest.domain }),
      });
    }
    const couplePayload = coupleResult.data as { quests?: unknown[] } | null;
    const coupleRows = Array.isArray(couplePayload?.quests) ? couplePayload.quests : [];
    for (const raw of coupleRows) {
      if (!raw || typeof raw !== 'object') continue;
      const quest = raw as { id?: string; title?: string; dueAt?: string | null; myDone?: boolean };
      if (!quest.id || !quest.title) continue;
      next.push({
        key: `couple:${quest.id}`,
        title: quest.title,
        due: quest.dueAt ? quest.dueAt.slice(0, 10) : null,
        status: quest.myDone ? 'completed' : 'available',
        instanceId: quest.id,
        couple: true,
        kind: 'quest',
        category: 'companionship',
      });
    }
    for (const day of healthRecordWindow(gameDay)) {
      if (nights.has(day)) continue;
      next.push({
        key: `lights:${day}`,
        title: LIGHTS_OUT_TITLE,
        due: day,
        status: 'available',
        instanceId: null,
        couple: false,
        kind: 'lights_out',
        category: 'health',
      });
    }
    const recordedPayday = checks;
    const openPaydays = paydayDates().filter((day) => day <= gameDay && !recordedPayday.has(day));
    const nextPayday = paydayDates().find((day) => day > gameDay);
    for (const day of openPaydays) {
      next.push({
        key: `payday:${day}`,
        title: PAYDAY_TITLE,
        due: day,
        status: 'available',
        instanceId: null,
        couple: false,
        kind: 'payday',
        category: 'finance',
      });
    }
    if (openPaydays.length === 0 && nextPayday && isPayday(nextPayday)) {
      next.push({
        key: `payday:${nextPayday}`,
        title: PAYDAY_TITLE,
        due: nextPayday,
        status: 'available',
        instanceId: null,
        couple: false,
        kind: 'payday',
        category: 'finance',
      });
    }
    setRows(next);
    setMessage('');
  }, []);

  useEffect(() => { void load(); }, [load]);

  function requestId(key: string) {
    const existing = requests.current.get(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    requests.current.set(key, created);
    return created;
  }

  async function complete(row: Row) {
    if (inFlight.current || busyKey) return;
    if (row.kind === 'payday' && row.due && row.due > today) {
      setMessage('This payday check opens on its date. Scheduling it early awards no XP.');
      return;
    }
    inFlight.current = true;
    setBusyKey(row.key);
    setMessage('');
    try {
      const client = supabase();
      if (row.kind === 'lights_out' && row.due) {
        const { data, error } = await client.rpc('record_lights_out', { p_game_day: row.due, p_request_id: requestId(row.key) });
        if (error) { setMessage(error.message); return; }
        const payload = data as { already?: boolean; xp_awarded?: number };
        setMessage(payload.already ? 'Already recorded. No additional XP.' : `Lights out recorded. +${payload.xp_awarded ?? 0} XP.`);
      } else if (row.kind === 'payday' && row.due) {
        const { data, error } = await client.rpc('complete_payday_check', {
          p_payday: row.due,
          p_decision: decision,
          p_request_id: requestId(`${row.key}:${decision}`),
        });
        if (error) { setMessage(error.message); return; }
        const payload = data as { already?: boolean; xp_awarded?: number };
        setMessage(payload.already ? 'Already recorded. No additional XP.' : `Payday check complete. +${payload.xp_awarded ?? 0} XP.`);
      } else if (row.couple && row.instanceId) {
        const { error } = await client.rpc('couple_quest_mark', { p_quest: row.instanceId });
        if (error) { setMessage(error.message); return; }
        setMessage('Your part is recorded.');
      } else if (row.instanceId) {
        const { data, error } = await client.rpc('set_quest_instance_status_v2', { p_instance_id: row.instanceId, p_action: 'complete' });
        if (error) { setMessage(error.message); return; }
        const payload = data as { reward_status?: string; xp_awarded?: number };
        setMessage(payload.reward_status === 'already_awarded' || payload.xp_awarded === 0
          ? 'Already recorded. No additional XP.'
          : `Quest complete. +${payload.xp_awarded ?? 0} XP.`);
      } else {
        setMessage('This quest has no open instance yet.');
        return;
      }
      await load();
    } catch {
      setMessage('That did not confirm. Refresh before trying again. XP is not awarded twice.');
    } finally {
      inFlight.current = false;
      setBusyKey('');
    }
  }

  const categories = QUEST_CATEGORIES.filter((category) => !only || category.id === only);
  return (
    <div className="ascension-board">
      {!only && <header className="workspace-heading"><div><p className="eyebrow">QUESTS</p><h1>Your board</h1></div></header>}
      {only && <header className="workspace-heading"><div><p className="eyebrow">{categories[0]?.label.toUpperCase()}</p><h1>{categories[0]?.label}</h1></div></header>}
      {categories.map((category) => {
        const items = prioritizeQuests(rows.filter((row) => row.category === category.id), today, limit);
        return (
          <details key={category.id} className="ascension-section" open>
            <summary>
              <Link href={category.href} onClick={(event) => event.stopPropagation()}>{category.label}</Link>
            </summary>
            {items.length === 0 && <p className="muted">No open quests in this section.</p>}
            <ul className="ascension-rows">
              {items.map((row) => (
                <li key={row.key} className="ascension-row">
                  <div>
                    <strong>{row.title}</strong>
                    <span className="muted">{dueLabel(row.due, today, row.status)}</span>
                  </div>
                  {row.kind === 'payday' && row.due && row.due <= today && (
                    <label className="ascension-decision">Decision
                      <select className="field" value={decision} onChange={(event) => setDecision(event.target.value as FinanceDecision)}>
                        {FINANCE_DECISIONS.map((item) => <option key={item} value={item}>{FINANCE_DECISION_LABEL[item]}</option>)}
                      </select>
                    </label>
                  )}
                  <button type="button" className="btn" disabled={busyKey === row.key || (row.kind === 'payday' && !!row.due && row.due > today)} onClick={() => { void complete(row); }}>
                    {busyKey === row.key ? 'Saving…' : row.kind === 'payday' && row.due && row.due > today ? 'Not open yet' : 'Complete'}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
      {message && <p className="message" role="status">{message}</p>}
    </div>
  );
}
