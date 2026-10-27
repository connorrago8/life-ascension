import type { BeltStage } from '../../lib/preview/beltProgression';
import { beltVisual } from '../../lib/preview/beltProgression';

/**
 * Isolated, reversible waist overlay for the 240x380 HomeCharacter SVG.
 * The caller chooses a presentation state; this component never grants gear.
 *
 * Integration gate: Beta must first remove the unconditional belt, buckle,
 * pouches and diagonal strap currently painted by HomeCharacter. Do not
 * mount this on top of those shapes or both stages will look equipped.
 */
export function BeltWaistLayer({
  stage,
  color = '#6B442C',
}: {
  stage: BeltStage;
  color?: string;
}) {
  const visual = beltVisual(stage);
  return (
    <g data-belt-stage={stage} strokeLinejoin="round" strokeLinecap="round">
      {visual.showTie ? (
        <g data-waist-part="starter-tie">
          <path d="M88 201 Q120 206 152 201 L152 207 Q120 212 88 207Z"
            fill="#7D756A" stroke="#49423B" strokeWidth="1.5" />
          <path d="M120 208 L117 220 121 231 125 221 124 208Z"
            fill="#9B9181" stroke="#49423B" strokeWidth="1.5" />
        </g>
      ) : null}
      {visual.showLeather ? (
        <g data-waist-part="earned-belt">
          <path d="M86 198 Q120 194 154 198 L153 213 Q120 210 87 213Z"
            fill={color} stroke="#251B15" strokeWidth="2.5" />
          <path d="M90 202 L108 202 M132 202 L150 202"
            stroke="#B89A71" strokeWidth="2" opacity=".85" />
          {visual.showBuckle ? (
            <g data-waist-part="earned-buckle">
              <rect x="110" y="196" width="20" height="19" rx="2"
                fill="#C8AC77" stroke="#3D2C1F" strokeWidth="2.5" />
              <rect x="115" y="201" width="10" height="9" rx="1"
                fill={color} stroke="#594831" strokeWidth="1" />
              <path d="M120 202 V208" stroke="#E8D3A2" strokeWidth="2" />
            </g>
          ) : null}
        </g>
      ) : null}
    </g>
  );
}
