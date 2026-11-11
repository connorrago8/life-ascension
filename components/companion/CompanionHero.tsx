'use client';

/** Full-body pixel companion. Each cosmetic is its own layer. Nothing here changes quests or combat. */

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
    <svg className="companion-hero" viewBox="0 0 96 128" role="img" aria-label={`${label}, a pixel adventurer`}>
      {on.has('frame') && <rect x="6" y="8" width="84" height="112" rx="10" fill="none" stroke="#f3c1d8" strokeWidth="4" />}
      {on.has('stars') && (
        <g fill="#f6e27a">
          <rect x="10" y="28" width="4" height="4" /><rect x="14" y="24" width="2" height="2" />
          <rect x="80" y="36" width="4" height="4" /><rect x="78" y="40" width="2" height="2" />
          <rect x="12" y="78" width="3" height="3" /><rect x="82" y="70" width="3" height="3" />
        </g>
      )}
      {on.has('bubbles') && (
        <g fill="none" stroke="#7ec8e3" strokeWidth="1.6">
          <circle cx="16" cy="48" r="5" /><circle cx="80" cy="56" r="4" /><circle cx="18" cy="90" r="3" />
        </g>
      )}
      {on.has('wings') && (
        <g>
          <path d="M22 62c-14 2-18 16-12 24 8-4 12-12 12-24z" fill="#f4e4ff" stroke="#c9a0e0" />
          <path d="M74 62c14 2 18 16 12 24-8-4-12-12-12-24z" fill="#f4e4ff" stroke="#c9a0e0" />
          <path d="M18 74c-6 4-6 10 0 12" fill="none" stroke="#e7c6ff" />
          <path d="M78 74c6 4 6 10 0 12" fill="none" stroke="#e7c6ff" />
        </g>
      )}
      <g className="companion-hero-body">
        <rect x="40" y="22" width="16" height="6" fill="#8a5a3a" />
        <rect x="34" y="26" width="28" height="8" fill="#5a3824" />
        <rect x="30" y="32" width="36" height="18" fill="#4a2e1c" />
        <rect x="36" y="28" width="8" height="6" fill="#8a5a3a" />
        <rect x="22" y="34" width="8" height="28" fill="#5a3824" />
        <rect x="66" y="34" width="8" height="28" fill="#4a2e1c" />
        <rect x="24" y="36" width="3" height="16" fill="#8a5a3a" />
        <rect x="24" y="58" width="6" height="4" fill="#e07a9a" />
        <rect x="66" y="58" width="6" height="4" fill="#e07a9a" />
        <rect x="26" y="62" width="4" height="8" fill="#5a3824" />
        <rect x="66" y="62" width="4" height="8" fill="#4a2e1c" />
        {on.has('ears') && (
          <g>
            <rect x="28" y="12" width="8" height="14" fill="#4a2e1c" />
            <rect x="60" y="12" width="8" height="14" fill="#4a2e1c" />
            <rect x="30" y="16" width="3" height="8" fill="#f0a0b4" />
            <rect x="62" y="16" width="3" height="8" fill="#f0a0b4" />
          </g>
        )}
        {on.has('tiara') && (
          <g fill="#f6e27a">
            <rect x="36" y="24" width="24" height="3" />
            <rect x="46" y="20" width="4" height="6" />
            <rect x="38" y="22" width="3" height="3" fill="#fff" />
          </g>
        )}
        {on.has('crown') && (
          <g>
            <rect x="34" y="22" width="6" height="6" fill="#e07a9a" />
            <rect x="45" y="18" width="6" height="8" fill="#f3c1d8" />
            <rect x="56" y="22" width="6" height="6" fill="#f6e27a" />
            <rect x="36" y="24" width="2" height="2" fill="#7dcea0" />
          </g>
        )}
        {(on.has('bow') || on.has('ribbon')) && (
          <g>
            <rect x="68" y="32" width="8" height="6" fill="#e07a9a" />
            <rect x="76" y="30" width="6" height="10" fill="#c45b7a" />
            <rect x="70" y="34" width="3" height="3" fill="#f6e27a" />
          </g>
        )}
        <rect x="36" y="36" width="24" height="20" fill="#fff4ea" />
        <rect x="38" y="42" width="6" height="6" fill="#2a1a22" />
        <rect x="52" y="42" width="6" height="6" fill="#2a1a22" />
        <rect x="39" y="43" width="2" height="2" fill="#fff" />
        <rect x="53" y="43" width="2" height="2" fill="#fff" />
        <rect x="34" y="46" width="3" height="3" fill="#f3a8be" />
        <rect x="59" y="46" width="3" height="3" fill="#f3a8be" />
        <rect x="44" y="50" width="8" height="2" fill="#e07a9a" />
        <rect x="40" y="56" width="16" height="4" fill="#fff4ea" />
        <rect x="34" y="60" width="28" height="32" fill="#1c1c1c" />
        <rect x="34" y="60" width="4" height="32" fill="#111" />
        <rect x="42" y="60" width="12" height="4" fill="#fff4ea" />
        <rect x="26" y="62" width="8" height="18" fill="#fff4ea" />
        <rect x="62" y="62" width="8" height="18" fill="#fff4ea" />
        {on.has('shirt') && (
          <g>
            <rect x="34" y="64" width="28" height="16" fill="#111" />
            <rect x="42" y="64" width="12" height="4" fill="#fff" />
            <rect x="26" y="62" width="8" height="8" fill="#111" />
            <rect x="62" y="62" width="8" height="8" fill="#111" />
          </g>
        )}
        {on.has('gown') && (
          <g>
            <rect x="28" y="78" width="40" height="22" fill="#f3c1d8" />
            <rect x="28" y="78" width="6" height="22" fill="#e7a0b8" />
            <rect x="44" y="90" width="8" height="4" fill="#fff" />
          </g>
        )}
        {on.has('pin') && (
          <g>
            <rect x="54" y="70" width="6" height="6" fill="#f6e27a" />
            <rect x="56" y="72" width="2" height="2" fill="#fff" />
          </g>
        )}
        <rect x="40" y="92" width="6" height="16" fill="#fff4ea" />
        <rect x="50" y="92" width="6" height="16" fill="#fff4ea" />
        {on.has('boots') ? (
          <g>
            <rect x="36" y="106" width="12" height="8" fill="#e7a0c4" />
            <rect x="48" y="106" width="12" height="8" fill="#e7a0c4" />
            <rect x="38" y="108" width="3" height="3" fill="#fff" />
            <rect x="54" y="108" width="3" height="3" fill="#fff" />
          </g>
        ) : (
          <g fill="#1c1c1c">
            <rect x="38" y="106" width="10" height="6" />
            <rect x="48" y="106" width="10" height="6" />
          </g>
        )}
        {on.has('wand') && (
          <g>
            <rect x="70" y="70" width="3" height="20" fill="#c4841d" />
            <rect x="66" y="64" width="10" height="8" fill="#e07a9a" />
            <rect x="69" y="66" width="3" height="3" fill="#fff" />
          </g>
        )}
        {on.has('mat') && (
          <g>
            <rect x="8" y="108" width="22" height="6" fill="#7dcea0" />
            <rect x="8" y="108" width="4" height="6" fill="#5eab84" />
          </g>
        )}
      </g>
      {on.has('bunny') && (
        <g>
          <rect x="78" y="96" width="12" height="10" fill="#fff" />
          <rect x="80" y="88" width="3" height="10" fill="#fff" />
          <rect x="86" y="88" width="3" height="10" fill="#fff" />
          <rect x="81" y="90" width="1" height="6" fill="#f3a8be" />
          <rect x="82" y="100" width="2" height="2" fill="#e07a9a" />
          <rect x="80" y="99" width="2" height="2" fill="#2a1a22" />
        </g>
      )}
    </svg>
  );
}
