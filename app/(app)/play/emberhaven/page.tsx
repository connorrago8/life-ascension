import Link from 'next/link';

/**
 * Emberhaven's first vertical slice is intentionally navigation-only.
 * No account writes, invented currency, equipment grants, or run resets.
 * This route is isolated from Grok's active AdventureHub and Crypt changes.
 */
const places = [
  {
    name: 'The Noticeboard',
    kicker: 'YOUR REAL-WORLD QUESTS',
    description: 'Return to the work that makes your adventurer stronger.',
    href: '/',
    action: 'View quests',
    symbol: '✦',
  },
  {
    name: 'The Blacksmith',
    kicker: 'EQUIPMENT & CHARACTER',
    description: 'Inspect the equipment you have earned and the slots still ahead.',
    href: '/character',
    action: 'View equipment',
    symbol: '⚒',
  },
  {
    name: 'The Trail Gate',
    kicker: 'ADVENTURES',
    description: 'Choose an available destination from the existing adventure map.',
    href: '/play',
    action: 'Explore destinations',
    symbol: '◇',
  },
] as const;

export default function EmberhavenPage() {
  return (
    <main className="screen" aria-labelledby="emberhaven-title" style={{ paddingBottom: 'calc(36px + env(safe-area-inset-bottom))' }}>
      <div style={{ textAlign: 'center', padding: '22px 0 16px' }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>THE LIVING DARK · TOWN HUB CONCEPT</p>
        <div aria-hidden="true" style={{ fontSize: 44, lineHeight: 1.3, color: 'var(--mint)' }}>✧</div>
        <h1 id="emberhaven-title" style={{ fontSize: 'clamp(1.8rem, 7vw, 2.4rem)', marginTop: 8 }}>Emberhaven</h1>
        <p className="lede" style={{ maxWidth: 310, margin: '12px auto 0' }}>
          The hearth is still burning. Your next step is yours to choose.
        </p>
      </div>

      <section aria-label="Town destinations" style={{ display: 'grid', gap: 12, marginTop: 24 }}>
        {places.map((place) => (
          <article key={place.name} style={{
            border: '1px solid var(--border)',
            borderRadius: 16,
            background: 'linear-gradient(145deg, #25292d, #191d21)',
            padding: 16,
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{
                width: 46, height: 46, flexShrink: 0, display: 'grid', placeItems: 'center',
                border: '1px solid #506a60', borderRadius: 12, color: 'var(--mint)', fontSize: 24,
              }}>{place.symbol}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ color: 'var(--mint)', fontSize: 10, letterSpacing: '.12em', fontWeight: 700 }}>{place.kicker}</p>
                <h2 style={{ margin: '5px 0 6px', fontSize: '1.14rem' }}>{place.name}</h2>
                <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 14 }}>{place.description}</p>
                <Link className="btn" href={place.href} style={{ width: '100%', minHeight: 44 }}>
                  {place.action} <span aria-hidden="true" style={{ marginLeft: 8 }}>→</span>
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>

      <p className="foot" style={{ textAlign: 'center', marginTop: 22 }}>
        Early town preview · Destinations reuse existing screens. No shop, crafting, or rewards are active here.
      </p>
    </main>
  );
}
