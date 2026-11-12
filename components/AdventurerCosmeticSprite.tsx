'use client';

import { visibleCosmeticIds } from '../lib/adventurerCosmetics';

/** Connor's cosmetic figure. Adult proportions, charcoal clothes, no combat stats.
 * Worn pieces paint on top. One piece per slot; the higher unlock wins.
 */

const SKIN = '#c4926a';
const SKIN_D = '#8d5e42';
const HAIR = '#141820';
const EYE = '#0c0e12';
const CYAN = '#00f0ff';
const MAGENTA = '#ff2bd6';
const GOLD = '#c9a227';
const MOUTH = '#4a302c';
const TUNIC = '#1c2128';
const TUNIC_D = '#10141a';
const PANTS = '#2c241c';
const PANTS_D = '#1a140f';
const BOOT = '#16110d';
const GUN = '#5c6570';

type Shape = readonly [number, number, number, number, string];

const BASE: readonly Shape[] = [
  [26, 6, 16, 3, HAIR],
  [24, 9, 20, 4, HAIR],
  [22, 13, 3, 8, HAIR],
  [43, 13, 3, 10, HAIR],
  [26, 14, 16, 12, SKIN],
  [26, 24, 16, 2, SKIN_D],
  [30, 26, 8, 4, SKIN],
  [28, 16, 4, 1, HAIR],
  [36, 16, 4, 1, HAIR],
  [28, 17, 3, 3, EYE],
  [37, 17, 3, 3, EYE],
  [29, 18, 1, 1, CYAN],
  [38, 18, 1, 1, CYAN],
  [32, 20, 3, 2, SKIN_D],
  [29, 23, 8, 1, MOUTH],
  [14, 32, 40, 6, TUNIC],
  [18, 38, 32, 16, TUNIC],
  [20, 52, 28, 4, TUNIC_D],
  [28, 32, 12, 1, GOLD],
  [18, 40, 2, 10, TUNIC_D],
  [48, 40, 2, 10, TUNIC_D],
  [33, 44, 2, 1, MAGENTA],
  [8, 34, 8, 16, SKIN],
  [52, 34, 8, 16, SKIN],
  [8, 38, 2, 10, SKIN_D],
  [58, 38, 2, 10, SKIN_D],
  [8, 50, 2, 5, SKIN],
  [11, 50, 2, 5, SKIN],
  [14, 50, 2, 4, SKIN],
  [52, 50, 2, 4, SKIN],
  [55, 50, 2, 5, SKIN],
  [58, 50, 2, 5, SKIN],
  [18, 56, 32, 6, PANTS],
  [20, 62, 8, 30, PANTS],
  [40, 62, 8, 30, PANTS],
  [20, 62, 2, 30, PANTS_D],
  [46, 62, 2, 30, PANTS_D],
  [18, 92, 12, 10, BOOT],
  [38, 92, 12, 10, BOOT],
  [18, 100, 12, 2, '#0a0806'],
  [38, 100, 12, 2, '#0a0806'],
  [20, 94, 3, 2, GOLD],
  [40, 94, 3, 2, GOLD],
];

function Pixels({ shapes }: { shapes: readonly Shape[] }) {
  return shapes.map(([x, y, w, h, fill], index) => (
    <rect key={`${x}-${y}-${w}-${index}`} x={x} y={y} width={w} height={h} fill={fill} />
  ));
}

export function AdventurerCosmeticSprite({ worn, label = 'Adventurer' }: { worn: readonly string[]; label?: string }) {
  const on = new Set(visibleCosmeticIds(worn));
  return (
    <svg className="adventurer-cosmetic-sprite" viewBox="0 0 80 112" role="img" aria-label={`${label}, wearing cosmetic gear`}>
      {on.has('void-aura') && (
        <g fill="none">
          <ellipse cx="40" cy="60" rx="30" ry="46" stroke={MAGENTA} strokeWidth="1" opacity="0.65" />
          <ellipse cx="40" cy="60" rx="34" ry="50" stroke={CYAN} strokeWidth="1" opacity="0.4" />
        </g>
      )}
      {(on.has('pathfinder-cloak') || on.has('storm-cape') || on.has('neon-trim-cloak')) && (
        <g>
          <rect x="10" y="30" width="52" height="40" fill="#07080c" />
          {on.has('storm-cape') && <rect x="10" y="30" width="52" height="2" fill={CYAN} />}
          {on.has('neon-trim-cloak') && <rect x="10" y="68" width="52" height="2" fill={MAGENTA} />}
          {on.has('pathfinder-cloak') && <rect x="34" y="34" width="2" height="28" fill={GOLD} />}
        </g>
      )}
      <g shapeRendering="crispEdges">
        <Pixels shapes={BASE} />
        {on.has('shadow-hood') && (
          <g>
            <rect x="22" y="8" width="24" height="8" fill="#10141a" />
            <rect x="20" y="14" width="4" height="14" fill="#10141a" />
            <rect x="44" y="14" width="4" height="14" fill="#10141a" />
            <rect x="24" y="10" width="4" height="1" fill={CYAN} opacity="0.5" />
          </g>
        )}
        {on.has('ember-circlet') && <rect x="26" y="13" width="16" height="2" fill={GOLD} />}
        {on.has('silver-mask') && (
          <g>
            <rect x="26" y="16" width="16" height="6" fill="#c5ccd6" />
            <rect x="28" y="18" width="3" height="2" fill={EYE} />
            <rect x="37" y="18" width="3" height="2" fill={EYE} />
          </g>
        )}
        {on.has('cyber-visor') && (
          <g>
            <rect x="24" y="16" width="20" height="6" fill="#14181f" stroke={CYAN} strokeWidth="0.6" />
            <rect x="27" y="18" width="5" height="2" fill={CYAN} opacity="0.8" />
            <rect x="36" y="18" width="5" height="2" fill={MAGENTA} opacity="0.55" />
          </g>
        )}
        {on.has('dark-tunic') && <rect x="18" y="34" width="32" height="18" fill="#12161c" />}
        {on.has('obsidian-vest') && (
          <g>
            <rect x="20" y="34" width="28" height="18" fill="#0c0e12" stroke={GUN} strokeWidth="0.6" />
            <rect x="32" y="38" width="4" height="8" fill={GUN} />
          </g>
        )}
        {on.has('longcoat') && <rect x="14" y="32" width="40" height="36" fill="#0c0e12" />}
        {on.has('gold-filigree-armor') && (
          <g>
            <rect x="18" y="34" width="32" height="18" fill="#14120c" />
            <rect x="22" y="36" width="24" height="1" fill={GOLD} />
            <rect x="22" y="42" width="24" height="1" fill={GOLD} />
            <rect x="32" y="36" width="4" height="12" fill={GOLD} />
          </g>
        )}
        {on.has('legendary-coat') && (
          <g>
            <rect x="12" y="30" width="44" height="40" fill="#07080c" />
            <rect x="12" y="30" width="44" height="2" fill={GOLD} />
            <rect x="12" y="68" width="44" height="1" fill={CYAN} />
            <rect x="32" y="36" width="4" height="20" fill={MAGENTA} />
          </g>
        )}
        {on.has('traveler-pants') && (
          <g>
            <rect x="18" y="56" width="32" height="36" fill="#1a2228" />
            <rect x="22" y="64" width="4" height="2" fill={GUN} />
            <rect x="42" y="64" width="4" height="2" fill={GUN} />
          </g>
        )}
        {on.has('rune-belt') && (
          <g>
            <rect x="20" y="52" width="28" height="4" fill="#2a2418" />
            <rect x="32" y="52" width="4" height="4" fill={GOLD} />
            <rect x="24" y="53" width="1" height="1" fill={CYAN} />
          </g>
        )}
        {on.has('road-boots') && (
          <g>
            <rect x="18" y="90" width="12" height="12" fill="#24180f" />
            <rect x="38" y="90" width="12" height="12" fill="#24180f" />
            <rect x="20" y="94" width="4" height="1" fill={GOLD} />
            <rect x="40" y="94" width="4" height="1" fill={GOLD} />
          </g>
        )}
        {on.has('warden-boots') && (
          <g>
            <rect x="16" y="88" width="14" height="14" fill="#0c0e12" />
            <rect x="38" y="88" width="14" height="14" fill="#0c0e12" />
            <rect x="18" y="92" width="8" height="1" fill={CYAN} />
            <rect x="40" y="92" width="8" height="1" fill={CYAN} />
          </g>
        )}
        {on.has('leather-bracers') && (
          <g>
            <rect x="8" y="40" width="8" height="6" fill="#3a2a1c" />
            <rect x="52" y="40" width="8" height="6" fill="#3a2a1c" />
          </g>
        )}
        {on.has('scarred-gloves') && (
          <g>
            <rect x="8" y="46" width="8" height="8" fill="#1a140f" />
            <rect x="52" y="46" width="8" height="8" fill="#1a140f" />
            <rect x="9" y="48" width="5" height="1" fill="#6a4030" />
            <rect x="53" y="48" width="5" height="1" fill="#6a4030" />
          </g>
        )}
        {on.has('void-gauntlets') && (
          <g>
            <rect x="6" y="42" width="10" height="12" fill="#101218" stroke={MAGENTA} strokeWidth="0.6" />
            <rect x="52" y="42" width="10" height="12" fill="#101218" stroke={MAGENTA} strokeWidth="0.6" />
          </g>
        )}
        {on.has('neon-edge-bracers') && (
          <g>
            <rect x="8" y="40" width="8" height="8" fill="#14181f" />
            <rect x="52" y="40" width="8" height="8" fill="#14181f" />
            <rect x="8" y="40" width="8" height="1" fill={CYAN} />
            <rect x="52" y="40" width="8" height="1" fill={CYAN} />
          </g>
        )}
        {on.has('iron-pauldrons') && (
          <g>
            <rect x="10" y="30" width="12" height="8" fill="#3a414a" />
            <rect x="46" y="30" width="12" height="8" fill="#3a414a" />
          </g>
        )}
        {on.has('arcane-shoulders') && (
          <g>
            <rect x="10" y="28" width="12" height="8" fill="#14121c" stroke={MAGENTA} strokeWidth="0.6" />
            <rect x="46" y="28" width="12" height="8" fill="#14121c" stroke={CYAN} strokeWidth="0.6" />
          </g>
        )}
        {on.has('obsidian-pauldrons') && (
          <g>
            <rect x="8" y="28" width="14" height="10" fill="#0c0e12" stroke={GOLD} strokeWidth="0.6" />
            <rect x="46" y="28" width="14" height="10" fill="#0c0e12" stroke={GOLD} strokeWidth="0.6" />
          </g>
        )}
        {(on.has('rune-lantern-pack')) && (
          <g>
            <rect x="58" y="40" width="8" height="12" fill="#14120c" stroke={GOLD} strokeWidth="0.6" />
            <rect x="60" y="42" width="4" height="6" fill={MAGENTA} />
          </g>
        )}
      </g>
    </svg>
  );
}
