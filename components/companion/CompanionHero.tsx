'use client';

/** 16-bit companion. Adult proportions: narrow face, wide shoulders, long legs.
 * Base clothes are charcoal, not a white shirt. Mouth is a dark line.
 * Palette: midnight, neon magenta #ff2bd6, cyan #00f0ff, aged gold #c9a227.
 */

const SKIN = '#c4926a';
const SKIN_D = '#8d5e42';
const HAIR = '#101218';
const HAIR_L = '#3a4254';
const EYE = '#0c0e12';
const CYAN = '#00f0ff';
const MAGENTA = '#ff2bd6';
const GOLD = '#c9a227';
const MOUTH = '#4e342f';
const TANK = '#1a1e26';
const TANK_D = '#101218';
const PANTS = '#3c2c22';
const PANTS_D = '#241810';
const BOOT = '#16110d';
const SOLE = '#0a0806';

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
  'nightcat-headset': 'nightcat',
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

type Shape = readonly [number, number, number, number, string];

function Pixels({ shapes }: { shapes: readonly Shape[] }) {
  return shapes.map(([x, y, w, h, fill], index) => (
    <rect key={`${x}-${y}-${w}-${index}`} x={x} y={y} width={w} height={h} fill={fill} />
  ));
}

const BASE: readonly Shape[] = [
  // Long hair, then a narrow face. Head is about one eighth of the figure.
  [24, 4, 20, 3, HAIR],
  [22, 7, 24, 4, HAIR],
  [20, 11, 4, 22, HAIR],
  [44, 11, 4, 30, HAIR],
  [26, 6, 3, 2, HAIR_L],
  [38, 8, 2, 2, HAIR_L],
  [24, 14, 16, 12, SKIN],
  [24, 24, 16, 2, SKIN_D],
  [28, 26, 8, 4, SKIN],
  [28, 29, 8, 1, SKIN_D],
  [26, 17, 4, 1, HAIR],
  [36, 17, 4, 1, HAIR],
  [26, 18, 3, 3, EYE],
  [37, 18, 3, 3, EYE],
  [27, 19, 1, 1, CYAN],
  [38, 19, 1, 1, CYAN],
  [31, 20, 2, 2, SKIN_D],
  [28, 23, 8, 1, MOUTH],
  // Shoulders wider than the head. Charcoal tank, gold collar, one magenta stitch.
  [16, 32, 36, 6, TANK],
  [20, 38, 28, 16, TANK],
  [22, 54, 24, 4, TANK_D],
  [26, 32, 16, 1, GOLD],
  [20, 40, 2, 12, TANK_D],
  [46, 40, 2, 12, TANK_D],
  [32, 46, 2, 1, MAGENTA],
  [33, 48, 1, 3, '#2a3140'],
  // Arms and separated fingers.
  [10, 34, 8, 16, SKIN],
  [50, 34, 8, 16, SKIN],
  [10, 38, 2, 10, SKIN_D],
  [56, 38, 2, 10, SKIN_D],
  [10, 50, 2, 5, SKIN],
  [13, 50, 2, 5, SKIN],
  [16, 50, 2, 4, SKIN],
  [50, 50, 2, 4, SKIN],
  [53, 50, 2, 5, SKIN],
  [56, 50, 2, 5, SKIN],
  // Hips and long legs.
  [20, 58, 28, 6, PANTS],
  [22, 64, 8, 28, PANTS],
  [38, 64, 8, 28, PANTS],
  [22, 64, 2, 28, PANTS_D],
  [44, 64, 2, 28, PANTS_D],
  [30, 70, 2, 16, PANTS_D],
  // Scuffed boots.
  [20, 92, 12, 8, BOOT],
  [36, 92, 12, 8, BOOT],
  [20, 100, 12, 2, SOLE],
  [36, 100, 12, 2, SOLE],
  [22, 94, 3, 2, GOLD],
  [38, 94, 3, 2, GOLD],
  [28, 96, 2, 2, '#3a3228'],
];

export function CompanionHero({ worn, label = 'Izzy' }: { worn: readonly string[]; label?: string }) {
  const on = new Set(worn.map((id) => SHOW[id]).filter(Boolean));
  return (
    <svg className="companion-hero" viewBox="0 0 80 112" role="img" aria-label={`${label}, a pixel adventurer`}>
      {on.has('aura') && (
        <g fill="none">
          <ellipse cx="40" cy="58" rx="30" ry="48" stroke={MAGENTA} strokeWidth="1" opacity="0.7" />
          <ellipse cx="40" cy="58" rx="34" ry="52" stroke={CYAN} strokeWidth="1" opacity="0.45" />
        </g>
      )}
      {on.has('drone') && (
        <g>
          <rect x="62" y="18" width="14" height="8" fill="#101218" stroke={CYAN} strokeWidth="1" />
          <rect x="66" y="20" width="6" height="4" fill={MAGENTA} />
          <rect x="64" y="26" width="10" height="1" fill={CYAN} />
        </g>
      )}
      {on.has('clean') && (
        <g>
          <rect x="64" y="40" width="12" height="8" fill="#101218" stroke={GOLD} strokeWidth="1" />
          <rect x="67" y="42" width="6" height="4" fill={CYAN} />
        </g>
      )}
      <g shapeRendering="crispEdges">
        <Pixels shapes={BASE} />
        {on.has('streak') && <rect x="44" y="8" width="2" height="18" fill={CYAN} />}
        {on.has('silverhair') && (
          <g>
            <rect x="22" y="4" width="24" height="8" fill="#b7bdc8" />
            <rect x="42" y="8" width="6" height="10" fill={MAGENTA} />
            <rect x="20" y="12" width="4" height="16" fill="#9aa3b2" />
          </g>
        )}
        {on.has('nightcat') && (
          <g>
            <rect x="22" y="17" width="20" height="2" fill="#5c6570" />
            <rect x="18" y="15" width="5" height="6" fill="#3e4650" />
            <rect x="41" y="15" width="5" height="6" fill="#3e4650" />
            <rect x="19" y="16" width="3" height="1" fill="#8b949e" />
            <rect x="42" y="16" width="3" height="1" fill="#8b949e" />
            <rect x="20" y="19" width="1" height="1" fill={CYAN} opacity="0.75" />
            <rect x="43" y="19" width="1" height="1" fill={CYAN} opacity="0.75" />
            <rect x="31" y="17" width="1" height="1" fill={CYAN} opacity="0.4" />
          </g>
        )}
        {on.has('circlet') && <rect x="24" y="13" width="16" height="1" fill="#d5d8de" />}
        {on.has('nose') && <rect x="32" y="21" width="1" height="1" fill="#d5d8de" />}
        {on.has('visor') && (
          <g>
            <rect x="24" y="17" width="16" height="6" fill="#05070a" stroke={CYAN} strokeWidth="0.6" />
            <rect x="26" y="19" width="5" height="2" fill={CYAN} opacity="0.8" />
            <rect x="34" y="19" width="5" height="2" fill={MAGENTA} opacity="0.7" />
          </g>
        )}
        {on.has('neck') && <rect x="29" y="27" width="6" height="2" fill={MAGENTA} />}
        {on.has('crop') && (
          <g>
            <rect x="22" y="34" width="24" height="12" fill="#0c0e12" />
            <rect x="26" y="34" width="16" height="1" fill={GOLD} />
            <rect x="24" y="46" width="20" height="1" fill={SKIN} />
          </g>
        )}
        {on.has('corset') && (
          <g>
            <rect x="24" y="36" width="20" height="16" fill="#12141a" stroke={GOLD} strokeWidth="0.8" />
            <rect x="33" y="38" width="2" height="12" fill={MAGENTA} />
          </g>
        )}
        {on.has('gown') && (
          <g>
            <rect x="16" y="48" width="36" height="44" fill="#07080c" />
            <rect x="18" y="50" width="32" height="2" fill={GOLD} />
            <rect x="22" y="60" width="24" height="1" fill={MAGENTA} />
            <rect x="26" y="72" width="16" height="1" fill={CYAN} />
            <rect x="30" y="84" width="8" height="1" fill={GOLD} />
          </g>
        )}
        {on.has('gloves') && (
          <g>
            <rect x="10" y="48" width="8" height="7" fill="#0c0e12" />
            <rect x="50" y="48" width="8" height="7" fill="#0c0e12" />
            <rect x="10" y="50" width="8" height="1" fill={SKIN} />
          </g>
        )}
        {on.has('sleeve') && (
          <g opacity="0.85">
            <rect x="12" y="36" width="4" height="12" fill={CYAN} />
            <rect x="52" y="36" width="4" height="12" fill={CYAN} />
          </g>
        )}
        {on.has('hands') && (
          <g>
            <rect x="10" y="52" width="8" height="2" fill={MAGENTA} />
            <rect x="50" y="52" width="8" height="2" fill={MAGENTA} />
          </g>
        )}
        {on.has('wrist') && (
          <g>
            <rect x="12" y="46" width="4" height="2" fill={CYAN} />
            <rect x="52" y="46" width="4" height="2" fill={CYAN} />
          </g>
        )}
        {on.has('leather') && (
          <g>
            <rect x="8" y="32" width="12" height="14" fill="#14181f" />
            <rect x="48" y="32" width="12" height="14" fill="#14181f" />
            <rect x="8" y="32" width="12" height="1" fill={GOLD} />
            <rect x="48" y="32" width="12" height="1" fill={GOLD} />
          </g>
        )}
        {on.has('trench') && (
          <g>
            <rect x="12" y="30" width="44" height="40" fill="#0c0e12" opacity="0.92" />
            <rect x="12" y="30" width="44" height="1" fill={CYAN} />
          </g>
        )}
        {on.has('cloak') && (
          <g>
            <rect x="8" y="28" width="52" height="36" fill="#07080c" />
            <rect x="8" y="28" width="52" height="2" fill={MAGENTA} />
            <rect x="8" y="62" width="52" height="1" fill={CYAN} />
          </g>
        )}
        {on.has('pauldron') && (
          <g>
            <rect x="12" y="30" width="10" height="8" fill="#12141a" stroke={GOLD} />
            <rect x="46" y="30" width="10" height="8" fill="#12141a" stroke={GOLD} />
          </g>
        )}
        {on.has('lantern') && (
          <g>
            <rect x="58" y="48" width="8" height="10" fill="#12141a" stroke={GOLD} />
            <rect x="60" y="50" width="4" height="6" fill={MAGENTA} />
          </g>
        )}
        {on.has('belt') && (
          <g>
            <rect x="22" y="54" width="24" height="3" fill="#2a241c" />
            <rect x="32" y="54" width="4" height="3" fill={GOLD} />
          </g>
        )}
        {on.has('cargo') && (
          <g>
            <rect x="20" y="58" width="28" height="34" fill="#14181f" />
            <rect x="22" y="64" width="6" height="4" fill="#2a3140" />
            <rect x="40" y="64" width="6" height="4" fill="#2a3140" />
            <rect x="24" y="66" width="2" height="1" fill={CYAN} />
          </g>
        )}
        {on.has('yoga') && <rect x="22" y="60" width="24" height="10" fill={CYAN} opacity="0.55" />}
        {on.has('combat') && (
          <g>
            <rect x="20" y="90" width="12" height="12" fill="#0c0e12" />
            <rect x="36" y="90" width="12" height="12" fill="#0c0e12" />
            <rect x="22" y="94" width="4" height="2" fill="#d5d8de" />
            <rect x="38" y="94" width="4" height="2" fill="#d5d8de" />
            <rect x="20" y="100" width="12" height="2" fill={SOLE} />
            <rect x="36" y="100" width="12" height="2" fill={SOLE} />
          </g>
        )}
        {on.has('back') && <rect x="28" y="40" width="12" height="10" fill="#222838" opacity="0.55" />}
      </g>
    </svg>
  );
}
