import Link from 'next/link';
import { TownConversation } from '../TownVisit';

const slots = [
  { name: 'Weapon', icon: '⚔', detail: 'Review the weapon slot and its visual presentation on the Character screen.', lore: 'A blade is only as true as the hand that carries it.' },
  { name: 'Armor', icon: '⬡', detail: 'Inspect your armor presentation before returning to the road.', lore: 'The forge keeps the memory of every shield.' },
] as const;

/**
 * Town navigation and optional dialogue only. Character owns equipment data
 * and explicit Wear actions; the forge never mirrors or changes inventory.
 */
export default function EmberhavenBlacksmithPage() {
  return (
    <main className="screen" aria-labelledby="forge-title" style={{ paddingBottom: 'calc(36px + env(safe-area-inset-bottom))', overflowWrap: 'anywhere' }}>
      <Link href="/play/emberhaven" className="btn" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
        ← Back to Emberhaven
      </Link>
      <header style={{ textAlign: 'center', padding: '30px 0 18px' }}>
        <div aria-hidden="true" style={{ fontSize: 52, lineHeight: 1.3 }}>⚒</div>
        <p className="eyebrow">EMBERHAVEN · THE FORGE</p>
        <h1 id="forge-title">The Blacksmith</h1>
        <p className="lede">Steel remembers every journey. Your equipment deserves a closer look.</p>
      </header>
      <TownConversation stop="forge" />
      <section aria-labelledby="forge-slots" style={{ display: 'grid', gap: 12 }}>
        <h2 id="forge-slots" style={{ fontSize: '1.2rem' }}>Equipment stations</h2>
        {slots.map((slot) => (
          <article key={slot.name} style={{
            padding: 18, borderRadius: 14, border: '1px solid var(--border)',
            background: 'linear-gradient(145deg, #272522, #171a1d)',
            display: 'flex', gap: 14, alignItems: 'flex-start',
          }}>
            <span aria-hidden="true" style={{ fontSize: 26, width: 36, textAlign: 'center' }}>{slot.icon}</span>
            <div>
              <h3 style={{ margin: '0 0 6px' }}>{slot.name}</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>{slot.detail}</p>
              <p style={{ color: '#e3b983', fontStyle: 'italic', marginTop: 10 }}>{slot.lore}</p>
            </div>
          </article>
        ))}
      </section>
      <p role="note" className="muted" style={{ marginTop: 18 }}>
        Character shows account equipment when available; layout previews use demonstration items.
        No purchases, upgrades, crafting, comparisons, or item grants happen here.
      </p>
      <Link className="btn" href="/character" style={{ minHeight: 44, width: '100%', marginTop: 16 }}>
        Open Character →
      </Link>
    </main>
  );
}
