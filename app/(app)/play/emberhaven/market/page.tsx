import Link from 'next/link';
import { TownBackLink } from '../TownBackLink';
import { TownConversation } from '../TownVisit';


export default function MarketPage() {
  return (
    <main className="screen" aria-labelledby="market-title" style={{ paddingBottom: 'calc(40px + env(safe-area-inset-bottom))', overflowWrap: 'anywhere' }}>
      <TownBackLink href="/play/emberhaven" />
      <header style={{ textAlign: 'center', padding: '32px 0 22px', background: 'radial-gradient(ellipse at center, #b7884130, transparent 70%)' }}>
        <div aria-hidden="true" style={{ fontSize: 48, color: '#e9ae68' }}>✧</div>
        <p className="eyebrow">TRADERS & TREASURES</p>
        <h1 id="market-title">The Lantern Market</h1>
        <p className="lede">Amber lanterns line the cobbled street. The stalls are not yet open for trading.</p>
      </header>
      <TownConversation stop="market" />
      <Link className="btn" href="/play/emberhaven/blacksmith" style={{ minHeight: 44, width: '100%', marginTop: 22 }}>Visit the Blacksmith →</Link>
      <p className="foot" style={{ textAlign: 'center', marginTop: 16 }}>Town locations are exploratory. No XP, currency, equipment or Crypt run state changes here.</p>
    </main>
  );
}
