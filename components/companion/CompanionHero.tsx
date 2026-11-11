'use client';

/** Full-body pixel companion. Layers are cosmetic and do not change quests or combat. */

const SHOW: Record<string, string> = {
  ribbon: 'ribbon',
  bow: 'bow',
  'black-shirt': 'shirt',
  'sparkle-boots': 'boots',
  'lantern-pin': 'pin',
  'flower-crown': 'crown',
  'heart-wand': 'wand',
  bunny: 'bunny',
  'cat-ears': 'ears',
  'star-aura': 'stars',
  tiara: 'tiara',
  'fairy-wings': 'wings',
  'pastel-frame': 'frame',
  princess: 'gown',
  'yoga-mat': 'mat',
  'bubble-aura': 'bubbles',
};

export function CompanionHero({ worn, label = 'Izzy' }: { worn: readonly string[]; label?: string }) {
  const on = new Set(worn.map((id) => SHOW[id]).filter(Boolean));
  return (
    <svg className="companion-hero" viewBox="0 0 80 112" role="img" aria-label={`${label}, a pixel adventurer`}>
      {on.has('frame') && <rect x="4" y="4" width="72" height="104" rx="8" fill="none" stroke="#f3c1d8" strokeWidth="3" />}
      {on.has('stars') && (
        <g fill="#f6e27a">
          <rect x="8" y="18" width="3" height="3" />
          <rect x="68" y="28" width="3" height="3" />
          <rect x="10" y="70" width="2" height="2" />
          <rect x="66" y="64" width="2" height="2" />
        </g>
      )}
      {on.has('bubbles') && (
        <g fill="none" stroke="#9fd7ee" strokeWidth="1.4">
          <circle cx="14" cy="40" r="4" />
          <circle cx="66" cy="48" r="3" />
          <circle cx="18" cy="78" r="2.5" />
        </g>
      )}
      {on.has('wings') && (
        <g fill="#f7e7ff" stroke="#d7b4ee" strokeWidth="1">
          <path d="M18 48c-10 2-14 12-10 18 6-2 10-8 10-18z" />
          <path d="M62 48c10 2 14 12 10 18-6-2-10-8-10-18z" />
        </g>
      )}
      {on.has('bunny') && (
        <g>
          <rect x="60" y="78" width="10" height="8" fill="#fff" />
          <rect x="61" y="72" width="2" height="6" fill="#fff" />
          <rect x="66" y="72" width="2" height="6" fill="#fff" />
          <rect x="63" y="81" width="2" height="2" fill="#e7a0b4" />
        </g>
      )}
      <g className="companion-hero-body">
        <rect x="28" y="28" width="24" height="22" fill="#fff6ee" />
        <rect x="30" y="18" width="20" height="14" fill="#5a3824" />
        <rect x="22" y="24" width="6" height="22" fill="#5a3824" />
        <rect x="52" y="24" width="6" height="22" fill="#5a3824" />
        <rect x="24" y="44" width="4" height="10" fill="#5a3824" />
        <rect x="52" y="44" width="4" height="10" fill="#5a3824" />
        {on.has('ears') && (
          <g fill="#5a3824">
            <rect x="24" y="8" width="6" height="10" />
            <rect x="50" y="8" width="6" height="10" />
            <rect x="26" y="10" width="2" height="6" fill="#e7a0b4" />
            <rect x="52" y="10" width="2" height="6" fill="#e7a0b4" />
          </g>
        )}
        {on.has('tiara') && <rect x="30" y="14" width="20" height="3" fill="#f6e27a" />}
        {on.has('crown') && (
          <g fill="#e07a9a">
            <rect x="30" y="14" width="4" height="4" />
            <rect x="38" y="12" width="4" height="6" />
            <rect x="46" y="14" width="4" height="4" />
          </g>
        )}
        {(on.has('bow') || on.has('ribbon')) && (
          <g fill="#e07a9a">
            <rect x="50" y="20" width="6" height="4" />
            <rect x="56" y="18" width="4" height="8" />
          </g>
        )}
        <rect x="34" y="36" width="3" height="3" fill="#2a1a22" />
        <rect x="44" y="36" width="3" height="3" fill="#2a1a22" />
        <rect x="38" y="42" width="4" height="2" fill="#e07a9a" />
        <rect x="32" y="50" width="16" height="28" fill="#1a1a1a" />
        <rect x="26" y="52" width="6" height="16" fill="#fff6ee" />
        <rect x="48" y="52" width="6" height="16" fill="#fff6ee" />
        {on.has('shirt') && (
          <g>
            <rect x="32" y="50" width="16" height="14" fill="#111" />
            <rect x="36" y="50" width="8" height="3" fill="#fff6ee" />
          </g>
        )}
        {on.has('gown') && <rect x="28" y="58" width="24" height="24" fill="#f3c1d8" />}
        {on.has('pin') && <rect x="44" y="56" width="3" height="3" fill="#f6e27a" />}
        <rect x="32" y="78" width="6" height="14" fill="#fff6ee" />
        <rect x="42" y="78" width="6" height="14" fill="#fff6ee" />
        {on.has('boots') ? (
          <g fill="#e7a0c4">
            <rect x="30" y="90" width="8" height="6" />
            <rect x="42" y="90" width="8" height="6" />
          </g>
        ) : (
          <g fill="#1a1a1a">
            <rect x="30" y="90" width="8" height="5" />
            <rect x="42" y="90" width="8" height="5" />
          </g>
        )}
        {on.has('wand') && (
          <g>
            <rect x="54" y="58" width="2" height="16" fill="#c4841d" />
            <rect x="52" y="54" width="6" height="6" fill="#e07a9a" />
          </g>
        )}
        {on.has('mat') && <rect x="8" y="88" width="16" height="5" fill="#7dcea0" />}
      </g>
    </svg>
  );
}
