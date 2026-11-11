'use client';

/** Full-body pixel companion. Each cosmetic is its own layer.
 * Base: plain white tank, baggy brown pants, scuffed boots.
 * Art: Baldur’s Gate 3 × dark cyberpunk, adult proportions, neon magenta/cyan.
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
    <svg className="companion-hero" viewBox="0 0 96 140" role="img" aria-label={`${label}, a pixel adventurer`}>
      {/* Aura */}
      {on.has('aura') && (
        <g opacity="0.55">
          <ellipse cx="48" cy="78" rx="38" ry="52" fill="none" stroke="#ff2bd6" strokeWidth="1.5" />
          <ellipse cx="48" cy="78" rx="42" ry="56" fill="none" stroke="#00f0ff" strokeWidth="0.8" />
        </g>
      )}
      {on.has('drone') && (
        <g>
          <rect x="72" y="28" width="16" height="10" fill="#111" stroke="#00f0ff" strokeWidth="1" />
          <rect x="76" y="30" width="8" height="6" fill="#ff2bd6" />
          <rect x="74" y="36" width="12" height="2" fill="#00f0ff" />
        </g>
      )}

      <g className="companion-hero-body">
        {/* Hair */}
        <rect x="32" y="18" width="32" height="14" fill="#0a0a0a" />
        <rect x="28" y="28" width="40" height="12" fill="#111" />
        <rect x="34" y="20" width="8" height="6" fill="#1a1a1a" />
        {on.has('streak') && <rect x="54" y="20" width="6" height="16" fill="#00f0ff" />}
        {on.has('silverhair') && (
          <>
            <rect x="32" y="18" width="32" height="14" fill="#b0b0b0" />
            <rect x="52" y="20" width="10" height="12" fill="#ff2bd6" />
          </>
        )}
        {on.has('headset') && (
          <g>
            <rect x="26" y="14" width="10" height="12" fill="#1a1a1a" />
            <rect x="60" y="14" width="10" height="12" fill="#1a1a1a" />
            <rect x="28" y="16" width="6" height="8" fill="#00f0ff" />
            <rect x="62" y="16" width="6" height="8" fill="#00f0ff" />
          </g>
        )}
        {on.has('circlet') && <rect x="34" y="22" width="28" height="2" fill="#c0c0c0" />}

        {/* Face */}
        <rect x="36" y="36" width="24" height="22" fill="#e0b898" />
        <rect x="38" y="42" width="4" height="5" fill="#1a1a1a" />
        <rect x="54" y="42" width="4" height="5" fill="#1a1a1a" />
        <rect x="39" y="43" width="2" height="2" fill="#fff" />
        <rect x="55" y="43" width="2" height="2" fill="#fff" />
        <rect x="44" y="50" width="8" height="2" fill="#c07080" />
        {on.has('nose') && <rect x="47" y="48" width="2" height="2" fill="#c0c0c0" />}
        {on.has('visor') && (
          <g>
            <rect x="34" y="40" width="28" height="10" fill="#050505" stroke="#00f0ff" strokeWidth="1" />
            <rect x="38" y="42" width="8" height="6" fill="#00f0ff" opacity="0.6" />
            <rect x="50" y="42" width="8" height="6" fill="#ff2bd6" opacity="0.5" />
          </g>
        )}
        {on.has('neck') && <rect x="42" y="56" width="12" height="4" fill="#ff2bd6" />}

        {/* Torso base */}
        <rect x="32" y="60" width="32" height="30" fill="#f4f4f4" />
        <rect x="40" y="60" width="16" height="6" fill="#e0b898" />
        {on.has('crop') && (
          <g>
            <rect x="32" y="60" width="32" height="18" fill="#0a0a0a" />
            <rect x="40" y="60" width="16" height="6" fill="#e0b898" />
          </g>
        )}
        {on.has('corset') && (
          <g>
            <rect x="34" y="62" width="28" height="22" fill="#111" stroke="#c9a227" strokeWidth="1" />
            <rect x="46" y="66" width="4" height="14" fill="#ff2bd6" />
          </g>
        )}
        {on.has('gown') && (
          <g>
            <rect x="26" y="74" width="44" height="36" fill="#050505" />
            <rect x="28" y="76" width="40" height="3" fill="#c9a227" />
            <rect x="36" y="84" width="24" height="2" fill="#ff2bd6" />
            <rect x="40" y="92" width="16" height="2" fill="#00f0ff" />
          </g>
        )}

        {/* Arms */}
        <rect x="20" y="62" width="12" height="22" fill="#e0b898" />
        <rect x="64" y="62" width="12" height="22" fill="#e0b898" />
        {on.has('gloves') && (
          <>
            <rect x="20" y="76" width="12" height="8" fill="#0a0a0a" />
            <rect x="64" y="76" width="12" height="8" fill="#0a0a0a" />
          </>
        )}
        {on.has('sleeve') && (
          <>
            <rect x="20" y="64" width="12" height="18" fill="#00f0ff" opacity="0.75" />
            <rect x="64" y="64" width="12" height="18" fill="#00f0ff" opacity="0.75" />
          </>
        )}
        {on.has('hands') && (
          <>
            <rect x="20" y="80" width="12" height="4" fill="#ff2bd6" />
            <rect x="64" y="80" width="12" height="4" fill="#ff2bd6" />
          </>
        )}

        {/* Outer layers */}
        {on.has('leather') && (
          <>
            <rect x="18" y="58" width="16" height="20" fill="#111" />
            <rect x="62" y="58" width="16" height="20" fill="#111" />
          </>
        )}
        {on.has('trench') && <rect x="16" y="56" width="64" height="44" fill="#0a0a0a" opacity="0.9" />}
        {on.has('cloak') && (
          <>
            <rect x="14" y="52" width="68" height="40" fill="#050505" />
            <rect x="14" y="52" width="68" height="3" fill="#ff2bd6" />
            <rect x="14" y="89" width="68" height="3" fill="#00f0ff" />
          </>
        )}
        {on.has('pauldron') && (
          <>
            <rect x="16" y="56" width="14" height="12" fill="#111" stroke="#c9a227" />
            <rect x="66" y="56" width="14" height="12" fill="#111" stroke="#c9a227" />
          </>
        )}
        {on.has('lantern') && (
          <g>
            <rect x="70" y="64" width="10" height="12" fill="#1a1a1a" stroke="#c9a227" />
            <rect x="72" y="66" width="6" height="8" fill="#ff2bd6" />
          </g>
        )}
        {on.has('belt') && <rect x="32" y="86" width="32" height="4" fill="#333" />}

        {/* Legs */}
        <rect x="34" y="90" width="12" height="20" fill="#5a3a24" />
        <rect x="50" y="90" width="12" height="20" fill="#5a3a24" />
        {on.has('cargo') && (
          <>
            <rect x="32" y="90" width="32" height="20" fill="#111" />
            <rect x="34" y="94" width="8" height="4" fill="#222" />
            <rect x="54" y="94" width="8" height="4" fill="#222" />
          </>
        )}
        {on.has('yoga') && <rect x="32" y="92" width="32" height="12" fill="#00f0ff" opacity="0.6" />}

        {/* Boots */}
        <g fill="#3a2a1a">
          <rect x="32" y="110" width="14" height="8" />
          <rect x="50" y="110" width="14" height="8" />
        </g>
        {on.has('combat') && (
          <g fill="#0a0a0a">
            <rect x="32" y="110" width="14" height="8" />
            <rect x="50" y="110" width="14" height="8" />
            <rect x="34" y="112" width="4" height="2" fill="#c0c0c0" />
            <rect x="52" y="112" width="4" height="2" fill="#c0c0c0" />
          </g>
        )}

        {on.has('back') && <rect x="38" y="66" width="20" height="16" fill="#222" opacity="0.4" />}
      </g>
    </svg>
  );
}
