import Link from 'next/link';

const features = [
  {
    "name": "The Curio Stall",
    "description": "A future home for collected treasures. No items can be purchased here."
  },
  {
    "name": "The Tailor",
    "description": "A future destination for visual customization. No equipment changes are saved."
  },
  {
    "name": "The Ledger",
    "description": "Your actual rewards remain managed by the existing adventure and account systems."
  }
] as const;

export default function MarketPage() {
  return (
    <main className="screen" aria-labelledby="market-title" style={{ paddingBottom: 'calc(40px + env(safe-area-inset-bottom))' }}>
      <Link className="btn" href="/play/emberhaven" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>← Emberhaven square</Link>
      <header style={{ textAlign: 'center', padding: '32px 0 22px', background: 'radial-gradient(ellipse at center, #b7884130, transparent 70%)' }}>
        <div aria-hidden="true" style={{ fontSize: 48, color: '#e9ae68' }}>✧</div>
        <p className="eyebrow">TRADERS & TREASURES</p>
        <h1 id="market-title">The Lantern Market</h1>
        <p className="lede">Amber lanterns line the cobbled street. The stalls are not yet open for trading.</p>
      </header>
      <section aria-label="The Lantern Market landmarks" style={{ display: 'grid', gap: 14 }}>
        {features.map((feature, index) => (
          <article key={feature.name} style={{ padding: 20, borderRadius: 16, border: '1px solid #66513d', background: index % 2 ? 'linear-gradient(140deg, #25201e, #191d21)' : 'linear-gradient(140deg, #292820, #191d21)' }}>
            <p style={{ color: '#e9ae68', fontSize: 11, letterSpacing: '.12em' }}>0{index + 1} · EMBERHAVEN</p>
            <h2 style={{ margin: '8px 0', fontSize: '1.16rem' }}>{feature.name}</h2>
            <p className="muted" style={{ margin: 0 }}>{feature.description}</p>
          </article>
        ))}
      </section>
      <Link className="btn" href="/play/emberhaven/blacksmith" style={{ minHeight: 44, width: '100%', marginTop: 22 }}>Visit the Blacksmith →</Link>
      <p className="foot" style={{ textAlign: 'center', marginTop: 16 }}>Town locations are exploratory. No XP, currency, equipment or Crypt run state changes here.</p>
    </main>
  );
}
