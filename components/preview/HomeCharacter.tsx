import { homeAriaLabel, type HomeCharacterModel } from '../../lib/preview/characterRender';
import { BeltWaistLayer } from './BeltWaistLayer';
import type { BeltStage } from '../../lib/preview/beltProgression';

/**
 * Front-facing, full-body game avatar. The palette and visible gear come from
 * the shared appearance model, so Character and Home stay in sync.
 * Flat material planes deliberately avoid the old puppet-like face and limbs.
 */
export function HomeCharacter({ model, idPrefix = 'home', beltPreviewStage }: { model: HomeCharacterModel; idPrefix?: string; beltPreviewStage?: BeltStage }) {
  const shirt = `${idPrefix}-shirt`;
  const skin = `${idPrefix}-skin`;
  const hair = `${idPrefix}-hair`;
  const coat = `${idPrefix}-coat`;
  return (
    <svg className="home-figure" viewBox="0 0 240 380" role="img"
      aria-label={homeAriaLabel(model)} data-character-style="home"
      data-main-hand={model.mainHand} data-hair={model.hair}>
      <defs>
        <linearGradient id={shirt} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={model.tunicLight} />
          <stop offset="1" stopColor={model.tunic} />
        </linearGradient>
        <linearGradient id={coat} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={model.hoodLight ?? model.trousersLight} />
          <stop offset="1" stopColor={model.hood ?? model.trousers} />
        </linearGradient>
        <linearGradient id={skin} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={model.skin} />
          <stop offset="1" stopColor={model.skinShadow} />
        </linearGradient>
        <linearGradient id={hair} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={model.hairHighlight} />
          <stop offset="1" stopColor={model.hair} />
        </linearGradient>
      </defs>
      <g className="home-figure-bob" strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="122" cy="365" rx="65" ry="8" fill="#05080b" opacity=".35" />
        {/* Back layer: cloak and sword sheath are attached to the body, not floating UI icons. */}
        <path d="M88 110 Q120 96 152 110 L170 324 138 345 121 302 98 345 70 324Z"
          fill={`url(#${coat})`} stroke="#20252a" strokeWidth="2" />
        <path d="M83 116 Q62 166 65 236 L75 311 91 318 95 162Z" fill={model.hood ?? model.trousers} opacity=".85" />
        {/* Anatomical legs: trouser panels and knee-length leather boots. */}
        <path d="M88 222 L120 222 118 301 109 333 82 333 80 289Z" fill={model.trousers} stroke="#22252a" strokeWidth="2" />
        <path d="M121 222 L154 222 158 289 152 333 125 333 122 300Z" fill={model.trousers} stroke="#22252a" strokeWidth="2" />
        <path d="M92 237 L90 293 M140 237 L146 293" stroke={model.trousersLight} strokeWidth="2" opacity=".6" />
        <path d="M80 282 L117 283 114 346 108 356 69 356 69 345 78 335Z" fill={model.boots} stroke={model.bootsLight} strokeWidth="2" />
        <path d="M122 283 L158 282 163 336 174 345 173 356 132 356 125 346Z" fill={model.boots} stroke={model.bootsLight} strokeWidth="2" />
        <path d="M77 314 L114 314 M126 314 L161 314 M70 348 L113 348 M130 348 L171 348"
          stroke={model.bootsLight} strokeWidth="2" opacity=".65" />
        {/* Tailored shirt, shoulder seams, vest, waist belts and pouches. */}
        <path d="M86 111 Q99 103 111 105 L129 105 Q144 103 155 113 L164 177 152 239 88 239 76 177Z"
          fill={`url(#${shirt})`} stroke="#343333" strokeWidth="2" />
        <path d="M87 118 L106 122 119 161 105 220 88 222 77 176Z" fill={model.tunic} opacity=".8" />
        <path d="M153 118 L135 122 122 161 135 220 151 222 163 176Z" fill={model.tunic} opacity=".8" />
        <path d="M111 105 L120 126 129 105 136 120 120 158 104 120Z" fill={model.skinShadow} opacity=".8" />
        <path d="M120 158 L120 222" stroke={model.tunicLight} strokeWidth="2" opacity=".7" />
        {beltPreviewStage ? (
          <BeltWaistLayer stage={beltPreviewStage} color={model.belt} />
        ) : (
          <>
            <path d="M86 198 L153 198 151 210 88 210Z" fill={model.belt} stroke="#251b15" strokeWidth="2" />
            <rect x="111" y="196" width="18" height="17" rx="2" fill="#b9a07a" stroke="#4b3a29" strokeWidth="2" />
            <rect x="117" y="201" width="6" height="7" rx="1" fill={model.belt} />
            <path d="M92 210 L90 243 108 244 108 213 M134 213 L134 244 151 243 149 210"
              fill={model.belt} stroke="#2c211a" strokeWidth="2" />
            <path d="M96 111 L141 216" stroke={model.belt} strokeWidth="10" opacity=".9" />
            <path d="M98 115 L144 217" stroke="#b59b75" strokeWidth="2" opacity=".65" />
          </>
        )}
        {/* Arms and fitted bracers; no separate circular puppet joints. */}
        <path d="M85 115 Q69 119 64 142 L55 201 73 206 90 156Z" fill={`url(#${shirt})`} stroke="#343333" strokeWidth="2" />
        <path d="M155 115 Q171 119 176 142 L185 201 167 206 150 156Z" fill={`url(#${shirt})`} stroke="#343333" strokeWidth="2" />
        <path d="M55 187 L75 193 69 241 49 235Z" fill={model.boots} stroke={model.bootsLight} strokeWidth="2" />
        <path d="M165 193 L185 187 191 235 171 241Z" fill={model.boots} stroke={model.bootsLight} strokeWidth="2" />
        <path d="M51 237 L68 242 66 260 Q58 268 50 259Z M173 242 L190 237 191 259 Q182 268 175 260Z"
          fill={`url(#${skin})`} stroke={model.skinShadow} strokeWidth="1.5" />
        {/* Neck, jaw and readable human facial structure. */}
        <path d="M108 93 L132 93 132 115 120 124 108 115Z" fill={model.skinShadow} />
        <path d="M89 45 Q92 22 120 22 Q148 22 151 46 L147 81 Q141 105 120 111 Q99 105 93 81Z"
          fill={`url(#${skin})`} stroke={model.skinShadow} strokeWidth="1.5" />
        <path d="M89 60 Q87 37 101 24 120 12 140 25 Q154 35 151 61 L143 48 134 42 119 47 106 42 94 57Z"
          fill={`url(#${hair})`} stroke={model.hair} strokeWidth="2" />
        <path d="M92 44 Q102 20 119 26 L111 39 98 49 M116 25 Q139 19 148 42 L133 36 123 42"
          fill={model.hairHighlight} opacity=".7" />
        <path d="M99 69 Q106 65 114 69 M126 69 Q134 65 141 69" stroke={model.hair} strokeWidth="3" />
        <path d="M102 75 L112 75 M128 75 L138 75" stroke={model.eye} strokeWidth="2.5" />
        <path d="M120 75 L117 89 123 90" stroke={model.skinShadow} strokeWidth="1.5" fill="none" />
        <path d="M111 97 Q120 101 129 97" stroke={model.skinShadow} strokeWidth="1.7" fill="none" />
        <path d="M100 88 L106 94 M140 88 L134 94" stroke={model.skinShadow} strokeWidth="1" opacity=".45" />
        {model.hood ? <path d="M84 54 Q79 11 120 8 Q163 10 157 56 L150 68 145 43 Q120 21 96 43 L91 68Z"
          fill={model.hood} stroke={model.hoodLight ?? model.hood} strokeWidth="2" /> : null}
        {/* Main-hand equipment is carried, while its grip stays at hand height. */}
        {model.mainHand === 'lantern' ? (
          <g data-prop="lantern">
            <path d="M57 258 L57 274" stroke={model.mainHandAccent} strokeWidth="4" />
            <path d="M45 273 L69 273 72 309 42 309Z" fill="#30343a" stroke={model.mainHandAccent} strokeWidth="3" />
            <rect x="48" y="281" width="18" height="20" rx="2" fill={model.mainHandAccentLight} />
            <path d="M42 309 L72 309" stroke={model.mainHandAccent} strokeWidth="4" />
          </g>
        ) : model.mainHand === 'staff' ? (
          <g data-prop="staff">
            <path d="M55 40 L58 352" stroke={model.mainHandAccent} strokeWidth="7" />
            <path d="M53 40 L56 352" stroke={model.mainHandAccentLight} strokeWidth="2" />
            <path d="M48 43 L55 29 62 43Z" fill={model.mainHandAccentLight} />
          </g>
        ) : model.mainHand === 'sword' ? (
          <g data-prop="sword" aria-label="Initiate Sword">
            <path d="M56 244 L54 99 59 79 64 99 62 244Z"
              fill={model.mainHandAccentLight} stroke={model.mainHandAccent} strokeWidth="2" />
            <path d="M59 93 L59 238" stroke="#FFFFFF" strokeWidth="2" opacity=".75" />
            <path d="M42 243 Q59 238 76 243 L76 250 Q59 247 42 250Z"
              fill="#C6A66D" stroke="#4A3826" strokeWidth="2" />
            <path d="M56 250 L62 250 64 282 54 282Z"
              fill="#51392C" stroke="#A87A50" strokeWidth="2" />
            <circle cx="59" cy="286" r="6" fill="#C6A66D" stroke="#4A3826" strokeWidth="2" />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
