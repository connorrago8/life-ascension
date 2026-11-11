/** 5 AM America/Chicago game day. Used for backdate validation. */

export function companionGameDay(instant: Date = new Date()): string {
  const chicago = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(instant);

  const get = (type: string) => chicago.find((p) => p.type === type)?.value ?? '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = Number(get('hour'));

  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  if (hour < 5) date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function isWithinBackdateWindow(dateStr: string): boolean {
  const today = companionGameDay();
  const target = new Date(dateStr);
  const start = new Date(today);
  start.setDate(start.getDate() - 30);
  return target >= start && dateStr <= today;
}
