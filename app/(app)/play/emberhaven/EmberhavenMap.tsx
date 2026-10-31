import Link from 'next/link';

const landmarks = [
  { id: 'board', label: 'Noticeboard', icon: '✦', href: '/quests', detail: 'Your real-world quests' },
  { id: 'forge', label: 'Blacksmith', icon: '⚒', href: '/play/emberhaven/blacksmith', detail: 'Meet Mara at the forge' },
  { id: 'hearth', label: 'Hearth', icon: '♨', href: '/play/emberhaven/hearth', detail: 'A quiet place by the fire' },
  { id: 'market', label: 'Market', icon: '✧', href: '/play/emberhaven/market', detail: 'Meet the lantern keeper' },
  { id: 'waystone', label: 'Waystone', icon: '◇', href: '/play/emberhaven/waystone', detail: 'Follow the Lantern Route' },
  { id: 'gate', label: 'Trail Gate', icon: '➤', href: '/play', detail: 'Back to the Hub' },
] as const;

/** One-tap navigation. Walking code remains unmounted in WalkableTownMap.tsx. */
export function EmberhavenMap() {
  return <section aria-labelledby="ember-map-title" style={{ marginTop: 20 }}>
    <h2 id="ember-map-title">Where would you like to go?</h2>
    <p className="muted">Tap a place to visit.</p>
    <nav aria-label="Emberhaven locations" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
      {landmarks.map(landmark => <Link key={landmark.id} className="btn ghost" aria-label={`Visit ${landmark.label}`} href={landmark.href} style={{ minHeight: 112, minWidth: 44, padding: 14, borderRadius: 14, border: '1px solid #617366', background: '#252e2b', color: '#f4f6f8', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 7, textAlign: 'left', overflowWrap: 'anywhere' }}>
        <span aria-hidden="true" style={{ fontSize: 26, color: '#d5b78d' }}>{landmark.icon}</span>
        <strong>{landmark.label}</strong>
        <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>{landmark.detail}</span>
      </Link>)}
    </nav>
  </section>;
}
