import { ModeLink as Link } from '../../../../components/ModeLink';
import styles from './EmberhavenMap.module.css';

// Rectilinear 32px landmarks, drawn on a 2px grid. Decorative, never route authority.
const pixelGlyphs = {
  board: 'M4 4h24v20H4z M8 8v12h16V8z M8 24h4v6H8z M20 24h4v6h-4z M10 10h12v2H10z M10 14h8v2h-8z',
  forge: 'M4 10h24v4l-8 4v4h4v4H8v-4h4v-4l-8-4z M8 6h16v4H8z M6 26h20v4H6z',
  hearth: 'M4 20h24v4h-4v4H8v-4H4z M8 18v-6h4V6h4v6h4V8h4v10h-4v-4h-4v4h-4v-4h-2v4z M10 28h4v2h-4z M20 28h4v2h-4z',
  market: 'M4 6h24v4H4z M2 10h28v4h-4v14h-4V14H10v14H6V14H2z M12 16h8v10h-8z M14 12h4v4h-4z M14 18v6h4v-6z',
  waystone: 'M10 2h12v4h4v24H6V6h4z M12 6h8v2h-8z M10 12v12h12V12z M14 14h4v2h2v4h-2v2h-4v-2h-2v-4h2z',
  gate: 'M2 10h6V6h4V2h8v4h4v4h6v20h-8V12h-4V8h-4v4h-4v18H2z M12 28h8v2h-8z',
} as const;

const landmarks = [
  { id: 'board', label: 'Noticeboard', href: '/quests', detail: 'Your real-world quests' },
  { id: 'forge', label: 'Blacksmith', href: '/play/emberhaven/blacksmith', detail: 'Meet Mara at the forge' },
  { id: 'hearth', label: 'Hearth', href: '/play/emberhaven/hearth', detail: 'A quiet place by the fire' },
  { id: 'market', label: 'Market', href: '/play/emberhaven/market', detail: 'Meet the lantern keeper' },
  { id: 'waystone', label: 'Waystone', href: '/play/emberhaven/waystone', detail: 'Follow the Lantern Route' },
  { id: 'gate', label: 'Trail Gate', href: '/play', detail: 'Back to the Hub' },
] as const;

/** One-tap navigation. Walking code remains unmounted in WalkableTownMap.tsx. */
export function EmberhavenMap() {
  return <section aria-labelledby="ember-map-title" className={styles.section}>
    <h2 id="ember-map-title">Where would you like to go?</h2>
    <p className="muted">Tap a place to visit.</p>
    <nav aria-label="Emberhaven locations" className={styles.grid}>
      {landmarks.map(landmark => <Link key={landmark.id} className={styles.destination} aria-label={`Visit ${landmark.label}`} aria-describedby={`town-${landmark.id}-detail`} href={landmark.href} style={{ minHeight: 112 }}>
        <span className={styles.sign} aria-hidden="true">
          <span className={styles.icon}><svg width="32" height="32" viewBox="0 0 32 32" focusable="false" aria-hidden="true"><path fillRule="evenodd" d={pixelGlyphs[landmark.id]} /></svg></span>
          <span className={styles.arrow}>→</span>
        </span>
        <span className={styles.copy}>
          <strong className={styles.name}>{landmark.label}</strong>
          <span id={`town-${landmark.id}-detail`} className={styles.detail}>{landmark.detail}</span>
        </span>
      </Link>)}
    </nav>
  </section>;
}
