import Link from 'next/link';

const features = [
  {
    "name": "Quiet corner",
    "description": "Review your next real-world quest before setting out."
  },
  {
    "name": "Campfire",
    "description": "Take a moment to prepare. Resting here does not heal or alter a Crypt run."
  },
  {
    "name": "Wayfinder",
    "description": "Return to the adventure map whenever you are ready."
  }
] as const;

export default function HearthPage() {
  return (
    <main className="screen" aria-labelledby="hearth-title" style={{ paddingBottom: 'calc(40px + env(safe-area-inset-bottom))' }}>
      <Link className="btn" href="/play/emberhaven" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>← Emberhaven square</Link>
      <header style={{ textAlign: 'center', padding: '32px 0 22px' }}>
        <div aria-hidden="true" style={{ fontSize: 48, color: '#e9ae68' }}>♨</div>
        <p className="eyebrow">REST & REFLECTION</p>
        <h1 id="hearth-title">The Hearth</h1>
        <p className="lede">A warm place to regroup between adventures.</p>
      </header>
      <section aria-label="The Hearth landmarks" style={{ display: 'grid', gap: 14 }}>
        {features.map((feature, index) => (
          <article key={feature.name} style={{ padding: 20, borderRadius: 16, border: '1px solid #66513d', background: index % 2 ? 'linear-gradient(140deg, #25201e, #191d21)' : 'linear-gradient(140deg, #292820, #191d21)' }}>
            <p style={{ color: '#e9ae68', fontSize: 11, letterSpacing: '.12em' }}>0{index + 1} · EMBERHAVEN</p>
            <h2 style={{ margin: '8px 0', fontSize: '1.16rem' }}>{feature.name}</h2>
            <p className="muted" style={{ margin: 0 }}>{feature.description}</p>
          </article>
        ))}
      </section>
      <Link className="btn" href="/play" style={{ minHeight: 44, width: '100%', marginTop: 22 }}>Return to the adventure map →</Link>
      <p className="foot" style={{ textAlign: 'center', marginTop: 16 }}>Town locations are exploratory. No XP, currency, equipment or Crypt run state changes here.</p>
    </main>
  );
}
