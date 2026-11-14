export const SEEN_PARTNER_KEY = 'la.quest.seen-partner';

export function unseenPartnerCount(ids: readonly string[], seen: ReadonlySet<string>): number {
  const unique = new Set(ids.filter((id) => typeof id === 'string' && id.length > 0));
  let count = 0;
  for (const id of unique) if (!seen.has(id)) count += 1;
  return count;
}

export function markPartnerSeen(ids: readonly string[], seen: ReadonlySet<string>): Set<string> {
  const next = new Set(seen);
  for (const id of ids) if (id) next.add(id);
  return next;
}

export function readSeenPartner(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length < 80));
  } catch {
    return new Set();
  }
}

export function partnerOwnershipTag(companion: boolean): 'FROM CONNOR' | 'FROM IZZY' {
  return companion ? 'FROM CONNOR' : 'FROM IZZY';
}

export function assignTargetName(forSelf: boolean, companion: boolean): 'Me' | 'Connor' | 'Izzy' {
  if (forSelf) return 'Me';
  return companion ? 'Connor' : 'Izzy';
}
