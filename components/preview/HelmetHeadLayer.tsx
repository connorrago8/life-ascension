/**
 * DESIGN-ONLY Level 5 basic helmet silhouette for 240x380 HomeCharacter SVG.
 * No XP, level, entitlement, inventory, ownership, or persistence behavior.
 * The parent explicitly opts into this preview; never mount from a level check.
 * Keep eyes, mouth and weapon clear at a 320 CSS px comparison viewport.
 */
export function HelmetHeadLayer() {
  return (
    <g data-helmet-preview="proposed" aria-hidden="true"
      strokeLinejoin="round" strokeLinecap="round">
      {/* Compact iron cap follows the existing head rather than scaling the face. */}
      <path d="M87 57 Q83 28 101 20 Q119 9 139 20 Q157 29 153 57
        L145 65 141 47 Q120 33 99 47 L95 65Z"
        fill="#626B73" stroke="#242B32" strokeWidth="3" />
      <path d="M91 48 Q91 28 108 23 Q121 18 136 24 Q148 30 149 48"
        fill="none" stroke="#C4B38B" strokeWidth="3" />
      {/* Narrow crown crest: visible at phone scale without another gear slot. */}
      <path d="M117 16 L120 9 124 16 124 38 117 38Z"
        fill="#BDA56E" stroke="#35312C" strokeWidth="2" />
      <path d="M100 48 Q120 36 140 48" fill="none"
        stroke="#D9C79F" strokeWidth="2" />
      {/* Cheek plates stop short of the eyes, nose and mouth. */}
      <path d="M89 56 L99 59 100 82 94 88 87 78Z"
        fill="#58636B" stroke="#252B30" strokeWidth="2" />
      <path d="M151 56 L141 59 140 82 146 88 153 78Z"
        fill="#58636B" stroke="#252B30" strokeWidth="2" />
      <path d="M93 64 L97 70 M147 64 L143 70"
        stroke="#D2BE92" strokeWidth="2" />
    </g>
  );
}
