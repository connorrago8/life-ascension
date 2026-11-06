export type ManualJournal = {
 viewerId: string; pairId: string; weekStart: string; weekEnd: string; today: string; canLog: boolean; weeklyXp: number; provenance: string;
 entries: {id: string; title: string; date: string; recordedAt: string; recordedBy: string; manualXp: number; corrected: boolean; correctionReason: string | null; correctedAt: string | null}[];
};
export function moveJournalWeek(date: string, weeks: number): string {
 if (!Number.isInteger(weeks) || Math.abs(weeks)>1) throw Error('Invalid week step');
 const monday=new Date(date+'T12:00:00Z');
 if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(monday.getTime()) || monday.toISOString().slice(0,10)!==date || monday.getUTCDay()!==1) throw Error('Expected server Monday');
 monday.setUTCDate(monday.getUTCDate()+weeks*7);
 return monday.toISOString().slice(0,10);
}
const messages=new Set(['Sign-in required','Journal unavailable','Invalid journal request','Active companionship required to log','Choose a completed activity and a past or current Chicago date','Refresh before changing a saved activity','This activity is already logged for that day','Add a short correction reason','Journal entry unavailable','Refresh before changing a saved correction','This entry already has a correction']);
export function journalError(code?: string,message?: string): string {
 return code==='P0001' && message && messages.has(message) ? message : 'Could not confirm the journal request. Refresh before retrying. Neither account’s XP was changed.';
}

export function journalTimestamp(value: string): string {
 const instant=new Date(value);
 if (Number.isNaN(instant.getTime())) return 'Time unavailable';
 return new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(instant);
}
