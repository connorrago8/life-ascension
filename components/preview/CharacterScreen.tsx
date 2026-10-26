'use client';

import { useRef } from 'react';
import { CharacterViewer, type CharacterViewerHandle } from '../CharacterViewer';
import type { SlotKey } from '../../lib/equipment';
import { itemIds, type Appearance } from '../../lib/preview/appearance';
import { adventureCharacterModel, homeCharacterModel } from '../../lib/preview/characterRender';
import { effectsForItems, formatGearEffects } from '../../lib/preview/equipmentEffects';
import { levelTitle, SAMPLE_PROGRESSION, xpLabel } from '../../lib/preview/progression';
import { HomeCharacter } from './HomeCharacter';
import { Loadout } from './Loadout';
import { usePreviewAppearance } from './usePreviewAppearance';

function ownedFrom(appearance: Appearance) {
  return appearance.equipment.map((item) => ({ slot: item.slot as SlotKey, name: item.name }));
}

export function CharacterScreen() {
  const { appearance, toggleMainHand } = usePreviewAppearance();
  const home = homeCharacterModel(appearance);
  const pixel = adventureCharacterModel(appearance);
  const effects = formatGearEffects(effectsForItems(itemIds(appearance)));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const viewerRef = useRef<CharacterViewerHandle>(null);
  const base = SAMPLE_PROGRESSION;

  return (
    <main className="preview-screen character-preview">
      <p className="level-line">{levelTitle(base)}</p>
      <h1 className="status-name">{appearance.name}</h1>
      <p className="xp-readout">{xpLabel(base)}</p>
      <section className="home-stage" aria-label="Adventurer">
        <Loadout appearance={appearance} onSwapMain={toggleMainHand}>
          <HomeCharacter model={home} idPrefix="character" />
        </Loadout>
      </section>
      <button ref={buttonRef} type="button" className="sheet-ghost examine" onClick={() => viewerRef.current?.open()}>
        Pixel examine
      </button>
      <section className="split-stats" aria-label="Sample progression and gear effects">
        <h2>Progression</h2>
        <p>STR {base.strength} · AGI {base.agility} · INT {base.intelligence} · END {base.endurance} · LCK {base.luck}</p>
        <h2>Gear effects</h2>
        <p>{effects || 'None'}</p>
      </section>
      <CharacterViewer
        ref={viewerRef}
        name={appearance.name}
        level={base.level}
        items={ownedFrom(appearance)}
        returnFocusRef={buttonRef}
        palette={pixel.palette}
        overlays={pixel.overlays}
        caption={`${pixel.itemNames.join(', ')}`}
      />
    </main>
  );
}
