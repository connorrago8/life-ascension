import { homeAriaLabel, type HomeCharacterModel } from '../../lib/preview/characterRender';

export function HomeCharacter({ model, idPrefix = 'home' }: { model: HomeCharacterModel; idPrefix?: string }) {
  const coat = `${idPrefix}-coat`;
  const skin = `${idPrefix}-skin`;
  const hair = `${idPrefix}-hair`;
  return (
    <svg
      className="home-figure"
      viewBox="0 0 200 320"
      role="img"
      aria-label={homeAriaLabel(model)}
      data-character-style="home"
      data-main-hand={model.mainHand}
      data-hair={model.hair}
    >
      <defs>
        <linearGradient id={coat} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={model.tunicLight} />
          <stop offset="0.45" stopColor={model.tunic} />
          <stop offset="1" stopColor={model.hood ?? model.tunic} />
        </linearGradient>
        <linearGradient id={skin} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={model.skin} />
          <stop offset="1" stopColor={model.skinShadow} />
        </linearGradient>
        <linearGradient id={hair} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={model.hairHighlight} />
          <stop offset="0.55" stopColor={model.hair} />
          <stop offset="1" stopColor={model.hair} />
        </linearGradient>
        <filter id={`${idPrefix}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000" floodOpacity="0.28" />
        </filter>
      </defs>
      <g className="home-figure-bob" filter={`url(#${idPrefix}-soft)`}>
        <ellipse cx="104" cy="304" rx="48" ry="8" fill="#000" opacity="0.35" />
        {model.mainHand === 'lantern' ? (
          <g data-prop="lantern">
            <path d="M46 132v28" stroke={model.mainHandAccent} strokeWidth="4" strokeLinecap="round" />
            <rect x="28" y="156" width="40" height="46" rx="8" fill="#2A3038" />
            <rect x="34" y="162" width="28" height="34" rx="4" fill={model.mainHandAccentLight} />
            <rect x="42" y="168" width="12" height="22" rx="3" fill={model.mainHandAccent} />
            <path d="M40 156h16l-2-8h-12z" fill="#3E4650" />
            <circle cx="48" cy="178" r="22" fill={model.mainHandAccent} opacity="0.28" />
          </g>
        ) : (
          <g data-prop="staff">
            <path d="M42 36c2 80 4 150 6 250" stroke={model.mainHandAccent} strokeWidth="8" strokeLinecap="round" />
            <path d="M40 36c2 80 4 150 6 250" stroke={model.mainHandAccentLight} strokeWidth="2" strokeLinecap="round" />
            <circle cx="44" cy="34" r="7" fill={model.mainHandAccentLight} />
            <path d="M38 168h16" stroke={model.belt} strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
        <path d="M78 198c-2 28-2 52 0 74h18c2-22 2-48 0-74z" fill={model.trousers} />
        <path d="M104 198c2 28 4 52 8 74h18c-2-22-4-48-6-74z" fill={model.trousers} />
        <path d="M84 200c0 24 0 46 1 70" stroke={model.trousersLight} strokeWidth="4" opacity="0.55" />
        <path d="M112 202c2 22 3 46 5 68" stroke={model.trousersLight} strokeWidth="3" opacity="0.4" />
        <path d="M68 262c2 8 4 28 10 34 8 6 22 4 26-4 2-16 0-28-4-34z" fill={model.boots} />
        <path d="M108 264c4 6 8 22 16 28 10 6 24 2 26-8 0-14-4-22-8-26z" fill={model.boots} />
        <path d="M74 274h22" stroke={model.bootsLight} strokeWidth="3" strokeLinecap="round" />
        <path d="M116 276h20" stroke={model.bootsLight} strokeWidth="3" strokeLinecap="round" />
        <path d="M64 132c0 28 6 58 16 74h44c10-16 16-46 16-74 0-22-14-36-38-36s-38 14-38 36z" fill={`url(#${coat})`} />
        <path d="M100 104c16 4 26 16 28 32 2 20-2 46-8 66h-16c4-22 6-46 4-66-2-12-4-24-8-32z" fill="#fff" opacity="0.14" />
        <path d="M86 168c8 10 22 10 32 0" stroke={model.tunicLight} strokeWidth="2" fill="none" opacity="0.7" />
        <rect x="78" y="186" width="48" height="10" rx="3" fill={model.belt} />
        <rect x="96" y="184" width="12" height="14" rx="2" fill={model.mainHandAccent} />
        <path d="M66 136c-18 10-30 32-32 52l14 4c4-16 14-34 28-44z" fill={model.tunic} />
        <path d="M136 134c16 12 28 32 30 52l-14 2c-4-18-12-34-26-44z" fill={model.tunic} />
        <ellipse cx="50" cy="190" rx="10" ry="8" fill={`url(#${skin})`} />
        <ellipse cx="158" cy="178" rx="10" ry="8" fill={`url(#${skin})`} />
        <path d="M90 108h22v20c-4 4-16 4-22 0z" fill={model.skinShadow} />
        {model.hood ? (
          <path d="M52 108C46 62 70 28 102 26c36-2 58 32 52 82-10-40-24-58-52-56-26 2-40 22-50 56z" fill={model.hood} />
        ) : null}
        <path d="M62 92c4-46 22-70 46-68 28 2 44 32 40 70-12-28-24-40-42-40-20 0-34 14-44 38z" fill={`url(#${hair})`} />
        <path d="M70 78c10-8 18-4 24 6 6-12 18-16 30-8 8 6 12 16 10 24-12-10-22-8-30 0-8-10-18-12-28-6-4 4-8 0-6-16z" fill={model.hairHighlight} />
        <ellipse cx="102" cy="92" rx="30" ry="34" fill={`url(#${skin})`} />
        <ellipse cx="72" cy="96" rx="6" ry="8" fill={model.skinShadow} />
        <ellipse cx="132" cy="96" rx="6" ry="8" fill={model.skinShadow} />
        <path d="M74 86c8-16 16-22 28-20 14 2 24 12 30 24-8-12-18-16-28-12-8 2-16 0-22 6-6-4-10-2-8 2z" fill={model.hair} />
        <path d="M78 78c6-6 14-8 20-2 4-8 14-10 22-4 6 4 8 10 6 14-8-6-14-4-20 2-6-6-14-8-20-4-4 2-8 0-8-6z" fill={model.hairHighlight} />
        <path d="M84 82c6-3 12-2 16 1" stroke={model.hair} strokeWidth="1.7" fill="none" strokeLinecap="round" />
        <path d="M108 82c5-3 12-3 16 1" stroke={model.hair} strokeWidth="1.7" fill="none" strokeLinecap="round" />
        <ellipse cx="90" cy="96" rx="5.2" ry="5.6" fill="#FFF9F4" />
        <ellipse cx="116" cy="96" rx="5.2" ry="5.6" fill="#FFF9F4" />
        <ellipse cx="91" cy="97" rx="2.6" ry="3" fill={model.eye} />
        <ellipse cx="117" cy="97" rx="2.6" ry="3" fill={model.eye} />
        <circle cx="92" cy="96" r="0.9" fill="#fff" />
        <circle cx="118" cy="96" r="0.9" fill="#fff" />
        <path d="M102 100v12" stroke={model.skinShadow} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M93 120c5 5 13 5 18 0" stroke={model.skinShadow} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {model.hood ? (
          <path d="M66 78c8-28 18-40 36-40s30 14 36 40c-8-16-18-24-36-24s-28 8-36 24z" fill={model.hood} />
        ) : null}
        <path d="M80 74c8-8 16-6 22 2 6-8 16-10 24-4 4 8-2 12-8 10-6-4-12-2-16 4-6-6-14-8-20-4-2-4-4-6-2-8z" fill={model.hairHighlight} />
      </g>
    </svg>
  );
}
