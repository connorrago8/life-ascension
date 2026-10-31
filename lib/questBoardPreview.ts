/** Sample quest board for the dev-only `?preview=1` layout preview (never used with a signed-in account). */
import {weekStart, type StreakState} from './questStreak.ts';

type PreviewQuest = {id:string;title:string;domain:string;cadence:'once'|'daily'|'weekly';created_at:string;scheduled_for:string|null;quest_type:'scheduled'|'goal';target_amount:number|null;progress_unit:string|null;progress_increment:number|null};
type PreviewInstance = {id:string;quest_id:string;due_date:string;status:'available'|'completed'|'deferred';current_amount:number};

const DAILY = ['Make the bed', 'Drink 8 glasses of water', '10 minute walk', 'Read 10 pages', 'Tidy the kitchen', 'Stretch for 5 minutes', 'Journal one line'];
const WEEKLY = ['Laundry day', 'Call a friend'];

export function previewBoard(today: string): {quests: PreviewQuest[]; instances: PreviewInstance[]; streak: StreakState} {
  const quest = (n: number, title: string, cadence: PreviewQuest['cadence']): PreviewQuest => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, title, domain: 'home', cadence,
    created_at: '2026-10-01T12:00:00Z', scheduled_for: '2026-10-01', quest_type: 'scheduled',
    target_amount: null, progress_unit: null, progress_increment: null,
  });
  const quests = [
    ...DAILY.map((title, i) => quest(i + 1, title, 'daily')),
    ...WEEKLY.map((title, i) => quest(i + 20, title, 'weekly')),
  ];
  const instances = quests.map((q, i): PreviewInstance => ({
    id: `00000000-0000-4000-9000-${String(i + 1).padStart(12, '0')}`, quest_id: q.id,
    due_date: q.cadence === 'weekly' ? weekStart(today) : today,
    status: i === 1 ? 'completed' : 'available', current_amount: 0,
  }));
  return {quests, instances, streak: {fire: 7, doneToday: true, today, timeZone: 'America/Chicago'}};
}
