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
    href: '/quests',
    action: 'View quests',
    symbol: '✦',
  },
  {
    name: 'The Blacksmith',
    kicker: 'EQUIPMENT & CHARACTER',
    description: 'Visit the forge and inspect equipment stations without changing your account.',
    href: '/play/emberhaven/blacksmith',
    action: 'Visit the forge',
    symbol: '⚒',
  },
  {
    name: 'The Hearth',
    kicker: 'REST & REFLECTION',
    description: 'Find warmth, reflect on your next quest, and return to the road.',
    href: '/play/emberhaven/hearth',
    action: 'Enter the hearth',
    symbol: '♨',
  },
  {
    name: 'The Lantern Market',
    kicker: 'A TOWN OF POSSIBILITIES',
    description: 'Explore the lantern-lit stalls. Trading is not open yet.',
    href: '/play/emberhaven/market',
    action: 'Explore the market',
    symbol: '✧',
  },
  {
    name: 'The Waystone',
    kicker: 'THE ROAD AHEAD',
    description: 'Discover the paths that lead beyond the town walls.',
    href: '/play/emberhaven/waystone',
    action: 'Inspect the waystone',
    symbol: '◇',
  },
  {
    name: 'The Trail Gate',
    kicker: 'ADVENTURES',
    description: 'Visit the adventure map. Crypt availability depends on the deployed game version.',
    href: '/play',
    action: 'Explore destinations',
    symbol: '◇',
  },
] as const;

export default function EmberhavenPage() {
  return (
    <main className="screen" aria-labelledby="emberhaven-title" style={{ paddingBottom: 'calc(36px + env(safe-area-inset-bottom))' }}>
      <div style={{ textAlign: 'center', padding: '22px 0 16px' }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>THE LIVING DARK · EMBERHAVEN</p>
        <div aria-hidden="true" style={{ fontSize: 44, lineHeight: 1.3, color: 'var(--mint)' }}>✧</div>
        <h1 id="emberhaven-title" style={{ fontSize: 'clamp(1.8rem, 7vw, 2.4rem)', marginTop: 8 }}>Emberhaven</h1>
        <p className="lede" style={{ maxWidth: 310, margin: '12px auto 0' }}>
          The hearth is still burning. Your next step is yours to choose.
        </p>
      </div>

      <div aria-hidden="true" style={{ height: 52, margin: '10px auto 0', maxWidth: 320, position: 'relative', overflow: 'hidden', borderBottom: '3px solid #806346' }}>
        <div style={{ position: 'absolute', bottom: 0, left: '7%', width: '27%', height: 28, background: '#423b37', clipPath: 'polygon(0 35%, 50% 0, 100% 35%, 100% 100%, 0 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: '38%', width: '26%', height: 44, background: '#554439', clipPath: 'polygon(0 32%, 50% 0, 100% 32%, 100% 100%, 0 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, right: '6%', width: '25%', height: 34, background: '#423b37', clipPath: 'polygon(0 35%, 50% 0, 100% 35%, 100% 100%, 0 100%)' }} />
        <span style={{ position: 'absolute', bottom: 15, left: '50%', width: 8, height: 14, background: '#e9ae68', boxShadow: '0 0 22px 8px #c77c3455' }} />
      </div>
      <section aria-label="Town destinations" style={{ display: 'grid', gap: 12, marginTop: 24 }}>
        {places.map((place) => (
          <article key={place.name} style={{
            border: '1px solid var(--border)',
            borderRadius: 16,
            background: 'linear-gradient(145deg, #302d28, #191d21)',
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
        Six town destinations · No shop, crafting, or rewards are active here.
      </p>
    </main>
  );
}
