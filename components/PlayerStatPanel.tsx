import { lockedAttributeEntries } from '../lib/attributes';

type StatRow = object | null | undefined;

function asRow(row: StatRow): Record<string, unknown> | null {
  return row && typeof row === 'object' ? row as Record<string, unknown> : null;
}

function labelFor(attribute: { label: string; value: string; pending: boolean }) {
  return attribute.pending ? `${attribute.label}, not set` : `${attribute.label} ${attribute.value}`;
}

/** The only player stat panels: STR, INT, VIT, and DIS. */
export function PlayerStatPanel({ row, variant }: { row: StatRow; variant: 'home' | 'character' | 'sample' }) {
  const attributes = lockedAttributeEntries(asRow(row));
  if (variant === 'sample') {
    return (
      <section className="character-stats" aria-label="Sample character attributes">
        {attributes.map((attribute) => (
          <span key={attribute.key}>{attribute.short} <strong>{attribute.value}</strong></span>
        ))}
      </section>
    );
  }
  if (variant === 'character') {
    return (
      <div className="character-stat-row" role="list" aria-label="Stats">
        {attributes.map((attribute) => (
          <div key={attribute.key} className="character-stat" role="listitem" aria-label={labelFor(attribute)}>
            <span className="character-stat-label" aria-hidden="true">{attribute.short}</span>
            <span className="character-stat-value" aria-hidden="true">{attribute.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <ul className="hub-stats" aria-label="Stats">
      {attributes.map((attribute) => (
        <li key={attribute.key} className="hub-stat" aria-label={labelFor(attribute)}>
          <span className="hub-stat-label" aria-hidden="true">{attribute.short}</span>
          <span className="hub-stat-value" aria-hidden="true">{attribute.value}</span>
        </li>
      ))}
    </ul>
  );
}
