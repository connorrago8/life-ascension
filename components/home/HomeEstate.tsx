import type { HomeTier } from '../../lib/homeHub';

/** Decorative pixel house. The tier comes from quest level and does not change combat. */
export function HomeEstate({ tier, sky }: { tier: HomeTier; sky: 'day' | 'night' }) {
  const rooms = Math.min(4, Math.max(1, tier.rooms));
  const night = sky === 'night';
  return (
    <figure className={`home-estate${night ? ' is-night' : ''}`} data-tier={tier.id} data-sky={sky} aria-label={`${tier.label}, unlocked at level ${tier.level}`}>
      <svg className="home-estate-art" viewBox="0 0 160 96" role="img" aria-label={tier.label} shapeRendering="crispEdges">
        <rect className="home-sky" width="160" height="96" fill={night ? '#1c2744' : '#87c6e8'} />
        <rect y="72" width="160" height="24" fill={night ? '#2f6a3c' : '#67b15a'} />
        <rect y="68" width="160" height="6" fill={night ? '#3d7d48' : '#8ed36a'} />
        {tier.garden && <rect x="8" y="64" width="18" height="10" fill="#3f8f45" />}
        {tier.garden && <rect x="12" y="58" width="6" height="8" fill="#e24b4b" />}
        <rect x="28" y="40" width="72" height="32" fill="#e7c48a" />
        <polygon points="24,40 64,16 108,40" fill="#c4563a" />
        <rect x="58" y="52" width="14" height="20" fill="#6b3f2a" />
        <rect className="home-window" x="36" y="48" width="12" height="10" fill="#f4e27a" />
        <rect className="home-fire" x="80" y="22" width="4" height="8" fill="#ffb347" />
        {rooms >= 2 && <rect x="100" y="48" width="36" height="24" fill="#f0d7a8" />}
        {rooms >= 2 && <polygon points="96,48 118,30 140,48" fill="#d06a48" />}
        {rooms >= 2 && <rect className="home-window" x="108" y="54" width="10" height="8" fill="#9fd7f2" />}
        {rooms >= 2 && <rect x="112" y="64" width="10" height="8" fill="#8b5a3c" />}
        {rooms >= 3 && <rect x="18" y="50" width="16" height="22" fill="#d9b07a" />}
        {rooms >= 3 && <rect x="22" y="40" width="8" height="12" fill="#8d8f96" />}
        {rooms >= 4 && <rect x="132" y="36" width="16" height="36" fill="#c9b08a" />}
        {rooms >= 4 && <rect x="136" y="24" width="8" height="14" fill="#8d8f96" />}
        {tier.banner && <rect x="64" y="28" width="10" height="14" fill="#3d6f8f" />}
        <rect x="78" y="28" width="8" height="14" fill="#8d8f96" />
      </svg>
      <figcaption className="muted delve-small">{tier.label} · {night ? 'Night' : 'Day'}</figcaption>
    </figure>
  );
}
