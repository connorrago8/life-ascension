'use client';

import Link from 'next/link';
import { useState } from 'react';

const landmarks = [
  { id: 'board', label: 'Noticeboard', icon: '✦', x: 19, y: 28, href: '/quests', story: 'The noticeboard carries your real-world quests. Every completed task begins outside the game.' },
  { id: 'forge', label: 'Blacksmith', icon: '⚒', x: 76, y: 25, href: '/play/emberhaven/blacksmith', story: 'Hammer strikes ring out from the forge. Inspect the equipment stations before your next adventure.' },
  { id: 'hearth', label: 'Hearth', icon: '♨', x: 47, y: 43, href: '/play/emberhaven/hearth', story: 'The town hearth glows in the gathering dusk. A place to reflect and plan.' },
  { id: 'market', label: 'Market', icon: '✧', x: 21, y: 72, href: '/play/emberhaven/market', story: 'Lanterns illuminate the market stalls. Trading is not yet available.' },
  { id: 'waystone', label: 'Waystone', icon: '◇', x: 74, y: 73, href: '/play/emberhaven/waystone', story: 'An ancient stone points to journeys beyond the walls.' },
  { id: 'gate', label: 'Trail Gate', icon: '➤', x: 50, y: 91, href: '/play', story: 'The road to the adventure map. Continue an existing Crypt run from there.' },
] as const;

export function EmberhavenMap() {
  const [selected, setSelected] = useState<(typeof landmarks)[number]['id']>('hearth');
  const active = landmarks.find((landmark) => landmark.id === selected) ?? landmarks[2];

  return (
    <section aria-labelledby="ember-map-title" style={{ marginTop: 22 }}>
      <h2 id="ember-map-title" style={{ textAlign: 'center', fontSize: '1.3rem' }}>Explore the town</h2>
      <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginBottom: 14 }}>Choose a landmark to learn its story, then enter.</p>
      <div aria-label="Interactive Emberhaven map" style={{ position: 'relative', height: 300, borderRadius: 18, overflow: 'hidden', border: '2px solid #82613e', background: 'radial-gradient(ellipse at 50% 45%, #584a37 0%, #303c39 53%, #17262a 100%)' }}>
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <path d="M50 43 L19 28 M50 43 L76 25 M50 43 L21 72 M50 43 L74 73 M50 43 L50 91" fill="none" stroke="#d8b47a" strokeWidth="1.5" strokeDasharray="2 2" opacity=".65" />
          <path d="M4 6 Q50 -2 96 6 L96 96 Q50 103 4 96 Z" fill="none" stroke="#8d7759" strokeWidth="2" />
        </svg>
        {landmarks.map((landmark) => (
          <button key={landmark.id} type="button" aria-pressed={selected === landmark.id} aria-label={`Inspect ${landmark.label}`} onClick={() => setSelected(landmark.id)} style={{ position: 'absolute', left: `${landmark.x}%`, top: `${landmark.y}%`, transform: 'translate(-50%, -50%)', display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 12, border: selected === landmark.id ? '3px solid #ffe4ad' : '2px solid #a98c62', background: selected === landmark.id ? '#79552d' : '#293238', color: '#ffe0a6', fontSize: 23, cursor: 'pointer', boxShadow: selected === landmark.id ? '0 0 20px #f2b35d88' : '0 2px 8px #0008' }}>{landmark.icon}</button>
        ))}
      </div>
      <div aria-live="polite" style={{ marginTop: 12, padding: 18, borderRadius: 14, border: '1px solid #82613e', background: 'linear-gradient(135deg, #302b27, #1c2226)' }}>
        <p style={{ fontSize: 11, letterSpacing: '.1em', color: '#f0c181' }}>SELECTED LANDMARK</p>
        <h3 style={{ margin: '7px 0' }}>{active.label}</h3>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>{active.story}</p>
        <Link className="btn" href={active.href} style={{ minHeight: 44, width: '100%', marginTop: 12 }}>Enter {active.label} →</Link>
      </div>
    </section>
  );
}
