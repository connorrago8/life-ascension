import { ModeLink as Link } from '../../../../../components/ModeLink';
import { TownBackLink } from '../TownBackLink';
import { TownConversation } from '../TownVisit';


export default function HearthPage() {
  return (
    <main className="screen town-screen" aria-labelledby="hearth-title" style={{ paddingBottom: 'calc(128px + env(safe-area-inset-bottom, 0px))', overflowWrap: 'anywhere' }}>
      <TownBackLink href="/play/emberhaven" />
      <header style={{ textAlign: 'center', padding: '32px 0 22px', background: 'radial-gradient(ellipse at center, #8b4c2a33, transparent 70%)' }}>
        <div aria-hidden="true" style={{ fontSize: 48, color: '#e9ae68' }}>♨</div>
        <p className="eyebrow">REST & REFLECTION</p>
        <h1 id="hearth-title">The Hearth</h1>
        <p className="lede">A warm place to regroup between adventures. The firelight dances over worn stone.</p>
      </header>
      <TownConversation stop="hearth" />
      <Link className="btn ghost" href="/quests" style={{ minHeight: 44, width: '100%', marginTop: 18 }}>View quests →</Link>
      <p className="foot" style={{ textAlign: 'center', marginTop: 16 }}>Town locations are exploratory. No XP, currency, equipment or Crypt run state changes here.</p>
    </main>
  );
}
