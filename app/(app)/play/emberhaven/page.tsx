import { TownBackLink } from './TownBackLink';
import { EmberhavenMap } from './EmberhavenMap';
import { TownTrail } from './TownVisit';

/**
 * Emberhaven's six-location exploration hub. All destinations are read-only
 * except navigation to existing quest and adventure experiences.
 * No account writes, equipment grants, or run resets originate here.
 */

export default function EmberhavenPage() {
  return (
    <main className="screen" aria-labelledby="emberhaven-title" style={{ paddingBottom: 'calc(36px + env(safe-area-inset-bottom))', overflowWrap: 'anywhere' }}>
      <TownBackLink href="/play" label="Back to Hub" />
      <div style={{ textAlign: 'center', padding: '22px 0 16px' }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>THE LIVING DARK · EMBERHAVEN SQUARE</p>
        <div aria-hidden="true" style={{ fontSize: 44, lineHeight: 1.3, color: 'var(--mint)' }}>✧</div>
        <h1 id="emberhaven-title" style={{ fontSize: 'clamp(1.8rem, 7vw, 2.4rem)', marginTop: 8 }}>Emberhaven</h1>
        <p className="lede" style={{ maxWidth: 310, margin: '12px auto 0' }}>
          Six paths. One living town. Choose where your story goes next.
        </p>
      </div>

      <div aria-hidden="true" style={{ height: 52, margin: '10px auto 0', maxWidth: 480, position: 'relative', overflow: 'hidden', borderBottom: '3px solid #806346' }}>
        <div style={{ position: 'absolute', bottom: 0, left: '7%', width: '27%', height: 28, background: '#423b37', clipPath: 'polygon(0 35%, 50% 0, 100% 35%, 100% 100%, 0 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: '38%', width: '26%', height: 44, background: '#554439', clipPath: 'polygon(0 32%, 50% 0, 100% 32%, 100% 100%, 0 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, right: '6%', width: '25%', height: 34, background: '#423b37', clipPath: 'polygon(0 35%, 50% 0, 100% 35%, 100% 100%, 0 100%)' }} />
        <span style={{ position: 'absolute', bottom: 15, left: '50%', width: 8, height: 14, background: '#ffd18a', boxShadow: '0 0 22px 8px #c77c3455' }} />
      </div>
      <EmberhavenMap />
      <TownTrail />

      <p className="foot" style={{ textAlign: 'center', marginTop: 22 }}>
        Six town destinations · No shop, crafting, or rewards are active here.
      </p>
    </main>
  );
}
