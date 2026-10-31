import Link from 'next/link';

const features = [
  {
    "name": "Forgotten Crypt",
    "description": "Enter through the existing adventure map to preserve run continuation."
  },
  {
    "name": "Whispering Woods",
    "description": "A future journey. Not yet accessible from this town."
  },
  {
    "name": "The Spire",
    "description": "A future challenge. Not yet accessible from this town."
  }
] as const;

export default function WaystonePage() {
  return (
    <main className="screen" aria-labelledby="waystone-title" style={{ paddingBottom: 'calc(40px + env(safe-area-inset-bottom))' }}>
      <Link className="btn" href="/play/emberhaven" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>← Emberhaven square</Link>
      <header style={{ textAlign: 'center', padding: '32px 0 22px' }}>
        <div aria-hidden="true" style={{ fontSize: 48, color: '#e9ae68' }}>◇</div>
        <p className="eyebrow">THE ROAD AHEAD</p>
        <h1 id="waystone-title">The Waystone</h1>
        <p className="lede">Every journey begins with a choice. The old stone points toward the adventure map.</p>
      </header>
      <section aria-label="The Waystone landmarks" style={{ display: 'grid', gap: 14 }}>
        {features.map((feature, index) => (
          <article key={feature.name} style={{ padding: 20, borderRadius: 16, border: '1px solid #66513d', background: index % 2 ? 'linear-gradient(140deg, #25201e, #191d21)' : 'linear-gradient(140deg, #292820, #191d21)' }}>
            <p style={{ color: '#e9ae68', fontSize: 11, letterSpacing: '.12em' }}>0{index + 1} · EMBERHAVEN</p>
            <h2 style={{ margin: '8px 0', fontSize: '1.16rem' }}>{feature.name}</h2>
            <p className="muted" style={{ margin: 0 }}>{feature.description}</p>
          </article>
        ))}
      </section>
      <Link className="btn" href="/play" style={{ minHeight: 44, width: '100%', marginTop: 22 }}>Open adventure map →</Link>
      <p className="foot" style={{ textAlign: 'center', marginTop: 16 }}>Town locations are exploratory. No XP, currency, equipment or Crypt run state changes here.</p>
    </main>
  );
}
