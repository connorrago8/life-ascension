import { SAMPLE_NOTIFICATION_COUNT } from '../../lib/preview/sampleQuests';
import { levelTitle, xpFraction, xpLabel, type Progression } from '../../lib/preview/progression';

export function StatusBlock({ name, progression }: { name: string; progression: Progression }) {
  const fraction = xpFraction(progression);
  return (
    <header className="status-block">
      <div className="status-name-row">
        <h1 className="status-name">{name}</h1>
        <span className="notify" aria-label={`${SAMPLE_NOTIFICATION_COUNT} notification`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.2 1.6H4.8z" />
            <path d="M10 19.2a2 2 0 0 0 4 0" />
          </svg>
          <span className="notify-dot" aria-hidden="true" />
        </span>
      </div>
      <p className="level-line">{levelTitle(progression)}</p>
      <div
        className="xp-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progression.xpToNext}
        aria-valuenow={progression.xp}
        aria-label="Experience"
      >
        <span className="xp-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
      <p className="xp-readout">{xpLabel(progression)}</p>
    </header>
  );
}
