'use client';

import {
  adjustAttribute, ATTRIBUTE_INFO, ATTRIBUTE_KEYS, pointsForLevel, spentPoints, type Attributes,
} from '../../lib/crypt/delve/stats';

/** The quest-earned stat budget. Saving uses the existing Crypt attribute write. No XP is spent. */
export function TrainingRoom(props: {
  level: number;
  draft: Attributes;
  gearBonus: Attributes;
  onChange: (next: Attributes) => void;
  onSave: () => void;
  saving: boolean;
  saveNote: string | null;
}) {
  const total = pointsForLevel(props.level);
  const left = total - spentPoints(props.draft);
  return (
    <section className="delve-panel" aria-labelledby="training-room-title">
      <h2 id="delve-attr-title">Training room <span className="delve-points">{left} of {total} points left</span></h2>
      <p className="muted delve-small">Points come from quest levels. Training does not spend XP or lower your level.</p>
      <ul className="delve-attrs">
        {ATTRIBUTE_KEYS.map((key) => {
          const info = ATTRIBUTE_INFO[key];
          const gear = props.gearBonus[key];
          return (
            <li key={key} className="delve-attr">
              <div className="delve-attr-text">
                <strong>{info.label}</strong> <span className="delve-attr-value">{props.draft[key]}{gear > 0 ? <span className="delve-gear-bonus"> +{gear}</span> : null}</span>
                <span className="muted delve-small">{info.effect}</span>
              </div>
              <div className="delve-stepper">
                <button type="button" className="btn ghost" aria-label={`Lower ${info.label}`} disabled={props.draft[key] <= 0}
                  onClick={() => props.onChange(adjustAttribute(props.draft, key, -1, props.level))}>−</button>
                <button type="button" className="btn ghost" aria-label={`Raise ${info.label}`} disabled={left <= 0}
                  onClick={() => props.onChange(adjustAttribute(props.draft, key, 1, props.level))}>+</button>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn ghost" onClick={props.onSave} disabled={props.saving}>{props.saving ? 'Saving…' : 'Save build'}</button>
      {props.saveNote ? <p className="delve-small" role="status">{props.saveNote}</p> : null}
    </section>
  );
}
