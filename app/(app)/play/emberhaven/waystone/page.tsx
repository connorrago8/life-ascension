import Link from 'next/link';
import { TownBackLink } from '../TownBackLink';
import { WaystonePuzzle } from '../TownVisit';


export default function WaystonePage() {
  return (
    <main className="screen" aria-labelledby="waystone-title" style={{ paddingBottom: 'calc(40px + env(safe-area-inset-bottom))' }}>
      <TownBackLink href="/play/emberhaven" />
      <header style={{ textAlign: 'center', padding: '32px 0 22px', background: 'radial-gradient(ellipse at center, #50687a30, transparent 70%)' }}>
        <div aria-hidden="true" style={{ fontSize: 48, color: '#e9ae68' }}>◇</div>
        <p className="eyebrow">THE ROAD AHEAD</p>
        <h1 id="waystone-title">The Waystone</h1>
        <p className="lede">An ancient marker stands beyond the walls. The active Crypt journey begins through the adventure map.</p>
      </header>
      <WaystonePuzzle />
      <Link className="btn" href="/play" style={{ minHeight: 44, width: '100%', marginTop: 22 }}>Open Hub →</Link>
      <p className="foot" style={{ textAlign: 'center', marginTop: 16 }}>Town locations are exploratory. No XP, currency, equipment or Crypt run state changes here.</p>
    </main>
  );
}
