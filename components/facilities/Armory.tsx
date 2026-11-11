'use client';

import { bonusLabel, lootById, passiveLabel, type Loadout } from '../../lib/crypt/delve/loot';

/** Explicit Wear only. Ownership is whatever list the caller already verified. */
export function Armory(props: {
  vault: readonly string[];
  loadout: Loadout;
  onToggle: (id: string) => void;
  keepNote?: string;
}) {
  return (
    <section className="delve-panel" aria-labelledby="armory-title">
      <h2 id="delve-vault-title">Armory</h2>
      <p className="muted delve-small">Tap Wear to bring gear on the next dungeon run. Nothing is worn by itself.</p>
      {props.vault.length === 0 ? (
        <p className="muted delve-small">No gear yet. The dungeon can drop decorations and temporary run gear.</p>
      ) : (
        <ul className="delve-vault">
          {props.vault.map((id) => {
            const entry = lootById(id);
            if (!entry) return null;
            const worn = props.loadout[entry.slot] === id;
            return (
              <li key={id} className={`delve-loot rarity-${entry.rarity}`}>
                <strong>{entry.name}</strong> <span className="delve-small">{bonusLabel(entry)}</span>
                {passiveLabel(entry) ? <span className="delve-small delve-passive">✦ {passiveLabel(entry)}</span> : null}
                {entry.earnedOnly ? <span className="soon-pill">Quest-earned</span> : null}
                {worn ? <span className="soon-pill">Worn</span> : null}
                <button type="button" className="btn ghost delve-wear" aria-pressed={worn}
                  aria-label={worn ? `Take off ${entry.name}` : `Wear ${entry.name} this run`}
                  onClick={() => props.onToggle(id)}>{worn ? 'Take off' : 'Wear'}</button>
              </li>
            );
          })}
        </ul>
      )}
      {props.keepNote ? <p className="muted delve-small">{props.keepNote}</p> : null}
    </section>
  );
}
