'use client';

/** Full-body pixel companion. Each cosmetic is its own layer. Nothing here changes quests or combat.
 * Base look (Level 1): plain white tank, baggy brown pants, scuffed boots.
 * Art direction: Baldur’s Gate 3 × dark cyberpunk, adult proportions, neon magenta/cyan accents.
 */

const SHOW: Record<string, string> = {
  'fingerless-gloves': 'gloves',
  'nose-ring': 'nose',
  'cargo-pants': 'cargo',
  'crop-top': 'crop',
  'leather-jacket': 'leather',
  'wrist-tattoo': 'wrist',
  'combat-boots': 'combat',
  'silver-circlet': 'circlet',
  'neon-hair-streak': 'streak',
  'arm-sleeve-tattoo': 'sleeve',
  'utility-belt': 'belt',
  'cyber-visor': 'visor',
  'trench-coat': 'trench',
  'neck-tattoo': 'neck',
  'cat-ear-headset': 'headset',
  'rune-lantern': 'lantern',
  'armored-corset': 'corset',
  'hand-tattoos': 'hands',
  'hooded-cloak': 'cloak',
  'rune-drone': 'drone',
  'shoulder-pauldron': 'pauldron',
  'back-tattoo': 'back',
  'silver-neon-hair': 'silverhair',
  'neon-aura': 'aura',
  'obsidian-gown': 'gown',
  'neon-yoga-wrap': 'yoga',
  'rune-cleaning-drone': 'clean',
};

export function CompanionHero({ worn, label = 'Izzy' }: { worn: readonly string[]; label?: string }) {
  const on = new Set(worn.map((id) => SHOW[id]).filter(Boolean));
  return (
    <svg className="companion-hero" viewBox="0 0 96 128" role="img" aria-label={`${label}, a pixel adventurer`}>
      {/* Aura / drones (behind) */}
      {on.has('aura') && (
        <g opacity="0.6">
          <circle cx="48" cy="70" r="42" fill="none" stroke="#ff2bd6" strokeWidth="2" />
          <circle cx="48" cy="70" r="46" fill="none" stroke="#00f0ff" strokeWidth="1" />
        </g>
      )}
      {on.has('drone') && (
        <g>
          <rect x="70" y="30" width="14" height="8" fill="#1a1a1a" stroke="#00f0ff" />
          <rect x="74" y="32" width="6" height="4" fill="#ff2bd6" />
        </g>
      )}
      {on.has('clean') && (
        <g>
          <rect x="8" y="40" width="12" height="6" fill="#222" stroke="#ff2bd6" />
          <rect x="10" y="42" width="8" height="2" fill="#00f0ff" />
        </g>
      )}

      <g className="companion-hero-body">
        {/* Hair base */}
        <rect x="34" y="22" width="28" height="12" fill="#1a1a1a" />
        <rect x="30" y="30" width="36" height="10" fill="#111" />
        {on.has('streak') && <rect x="50" y="24" width="6" height="14" fill="#00f0ff" />}
        {on.has('silverhair') && (
          <g>
            <rect x="34" y="22" width="28" height="12" fill="#c0c0c0" />
            <rect x="52" y="24" width="8" height="10" fill="#ff2bd6" />
          </g>
        )}
        {on.has('headset') && (
          <g>
            <rect x="28" y="18" width="8" height="10" fill="#222" />
            <rect x="60" y="18" width="8" height="10" fill="#222" />
            <rect x="30" y="20" width="4" height="6" fill="#00f0ff" />
            <rect x="62" y="20" width="4" height="6" fill="#00f0ff" />
          </g>
        )}
        {on.has('circlet') && <rect x="36" y="24" width="24" height="2" fill="#c0c0c0" />}

        {/* Face */}
        <rect x="36" y="34" width="24" height="20" fill="#e8c4a8" />
        <rect x="38" y="40" width="5" height="5" fill="#1a1a1a" />
        <rect x="53" y="40" width="5" height="5" fill="#1a1a1a" />
        <rect x="39" y="41" width="2" height="2" fill="#fff" />
        <rect x="54" y="41" width="2" height="2" fill="#fff" />
        {on.has('nose') && <rect x="46" y="46" width="2" height="2" fill="#c0c0c0" />}
        {on.has('visor') && (
          <g>
            <rect x="36" y="38" width="24" height="8" fill="#0a0a0a" stroke="#00f0ff" />
            <rect x="40" y="40" width="6" height="4" fill="#00f0ff" opacity="0.7" />
          </g>
        )}
        {on.has('neck') && <rect x="44" y="54" width="8" height="3" fill="#ff2bd6" />}

        {/* Torso — base white tank */}
        <rect x="34" y="58" width="28" height="28" fill="#f5f5f5" />
        <rect x="42" y="58" width="12" height="4" fill="#e8c4a8" />
        {on.has('crop') && (
          <g>
            <rect x="34" y="58" width="28" height="16" fill="#111" />
            <rect x="42" y="58" width="12" height="4" fill="#e8c4a8" />
          </g>
        )}
        {on.has('corset') && (
          <g>
            <rect x="36" y="60" width="24" height="20" fill="#1a1a1a" stroke="#c0c0c0" />
            <rect x="46" y="64" width="4" height="12" fill="#ff2bd6" />
          </g>
        )}
        {on.has('gown') && (
          <g>
            <rect x="28" y="70" width="40" height="30" fill="#0a0a0a" />
            <rect x="30" y="72" width="36" height="4" fill="#c9a227" />
            <rect x="40" y="80" width="16" height="2" fill="#ff2bd6" />
          </g>
        )}

        {/* Arms + gloves */}
        <rect x="24" y="60" width="10" height="20" fill="#e8c4a8" />
        <rect x="62" y="60" width="10" height="20" fill="#e8c4a8" />
        {on.has('gloves') && (
          <g>
            <rect x="24" y="72" width="10" height="8" fill="#111" />
            <rect x="62" y="72" width="10" height="8" fill="#111" />
          </g>
        )}
        {on.has('sleeve') && (
          <g>
            <rect x="24" y="62" width="10" height="16" fill="#00f0ff" opacity="0.8" />
            <rect x="62" y="62" width="10" height="16" fill="#00f0ff" opacity="0.8" />
          </g>
        )}
        {on.has('wrist') && <rect x="26" y="70" width="6" height="3" fill="#333" />}
        {on.has('hands') && (
          <g>
            <rect x="24" y="76" width="10" height="4" fill="#ff2bd6" />
            <rect x="62" y="76" width="10" height="4" fill="#ff2bd6" />
          </g>
        )}

        {/* Jacket / cloak / pauldron */}
        {on.has('leather') && (
          <g>
            <rect x="22" y="56" width="14" height="18" fill="#1a1a1a" />
            <rect x="60" y="56" width="14" height="18" fill="#1a1a1a" />
            <rect x="24" y="58" width="10" height="4" fill="#333" />
          </g>
        )}
        {on.has('trench') && (
          <g>
            <rect x="20" y="54" width="56" height="40" fill="#111" />
            <rect x="22" y="56" width="52" height="4" fill="#222" />
          </g>
        )}
        {on.has('cloak') && (
          <g>
            <rect x="18" y="50" width="60" height="36" fill="#0a0a0a" />
            <rect x="18" y="50" width="60" height="3" fill="#ff2bd6" />
            <rect x="18" y="83" width="60" height="3" fill="#00f0ff" />
          </g>
        )}
        {on.has('pauldron') && (
          <g>
            <rect x="18" y="54" width="12" height="10" fill="#1a1a1a" stroke="#c9a227" />
            <rect x="66" y="54" width="12" height="10" fill="#1a1a1a" stroke="#c9a227" />
          </g>
        )}
        {on.has('lantern') && (
          <g>
            <rect x="70" y="60" width="8" height="10" fill="#222" stroke="#c9a227" />
            <rect x="72" y="62" width="4" height="6" fill="#ff2bd6" />
          </g>
        )}

        {/* Hip / belt */}
        {on.has('belt') && <rect x="34" y="82" width="28" height="4" fill="#333" />}

        {/* Legs — base baggy brown pants */}
        <rect x="36" y="86" width="10" height="18" fill="#5a3a24" />
        <rect x="50" y="86" width="10" height="18" fill="#5a3a24" />
        {on.has('cargo') && (
          <g>
            <rect x="34" y="86" width="28" height="18" fill="#1a1a1a" />
            <rect x="36" y="90" width="8" height="4" fill="#333" />
            <rect x="52" y="90" width="8" height="4" fill="#333" />
          </g>
        )}
        {on.has('yoga') && <rect x="34" y="88" width="28" height="10" fill="#00f0ff" opacity="0.7" />}

        {/* Boots — base scuffed */}
        <g fill="#3a2a1a">
          <rect x="34" y="104" width="12" height="8" />
          <rect x="50" y="104" width="12" height="8" />
        </g>
        {on.has('combat') && (
          <g fill="#111">
            <rect x="34" y="104" width="12" height="8" />
            <rect x="50" y="104" width="12" height="8" />
            <rect x="36" y="106" width="3" height="2" fill="#c0c0c0" />
            <rect x="52" y="106" width="3" height="2" fill="#c0c0c0" />
          </g>
        )}

        {/* Back tattoo (subtle) */}
        {on.has('back') && <rect x="40" y="64" width="16" height="12" fill="#333" opacity="0.5" />}
      </g>
    </svg>
  );
}
