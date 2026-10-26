'use client';

import { useRef } from 'react';
import { CharacterViewer, type CharacterViewerHandle } from '../CharacterViewer';
import type { SlotKey } from '../../lib/equipment';
import type { Appearance, VisibleSlot } from '../../lib/preview/appearance';
import { adventureCharacterModel, homeCharacterModel } from '../../lib/preview/characterRender';
import { levelTitle, SAMPLE_PROGRESSION } from '../../lib/preview/progression';
import { HomeCharacter } from './HomeCharacter';
import { usePreviewAppearance } from './usePreviewAppearance';

const LEFT_SLOTS: readonly { slot: VisibleSlot; label: string }[] = [
  { slot: 'head', label: 'Head' },
  { slot: 'chest', label: 'Armor' },
  { slot: 'legs', label: 'Legs' },
];
const RIGHT_SLOTS: readonly { slot: VisibleSlot; label: string }[] = [
  { slot: 'main-hand', label: 'Weapon' },
  { slot: 'off-hand', label: 'Off hand' },
  { slot: 'feet', label: 'Boots' },
];

function ownedFrom(appearance: Appearance) {
  return appearance.equipment.map((item) => ({ slot: item.slot as SlotKey, name: item.name }));
}

function Slot({ appearance, slot, label }: { appearance: Appearance; slot: VisibleSlot; label: string }) {
  const item = appearance.equipment.find((entry) => entry.slot === slot);
  return (
    <div className="character-gear-slot" aria-label={`${label}: ${item?.name ?? 'Empty'}`}>
      <span className="character-slot-label">{label}</span>
      <span className="character-slot-item">{item?.name ?? 'Empty'}</span>
    </div>
  );
}

export function CharacterScreen() {
  const { appearance } = usePreviewAppearance();
  const base = SAMPLE_PROGRESSION;
  const pixel = adventureCharacterModel(appearance);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const viewerRef = useRef<CharacterViewerHandle>(null);

  return (
    <main className="preview-screen character-preview character-equipment-screen">
      <header className="character-header">
        <div>
          <h1 className="status-name">{appearance.name}</h1>
          <p className="level-line">{levelTitle(base)}</p>
        </div>
        <p className="character-header-note">EQUIPMENT</p>
      </header>
      <section className="character-loadout-stage" aria-label="Equipped character and gear">
        <div className="character-slot-column">
          {LEFT_SLOTS.map(({ slot, label }) => <Slot key={slot} appearance={appearance} slot={slot} label={label} />)}
        </div>
        <div className="character-avatar" aria-label="Full-body front-facing adventurer">
          <HomeCharacter model={homeCharacterModel(appearance)} idPrefix="character" />
        </div>
        <div className="character-slot-column">
          {RIGHT_SLOTS.map(({ slot, label }) => <Slot key={slot} appearance={appearance} slot={slot} label={label} />)}
        </div>
      </section>
      <p className="character-gear-note">Outfit colors come from equipped gear and unlocked cosmetics. Change equipment in Inventory.</p>
      <section className="character-stats" aria-label="Character attributes">
        <span>STR <strong>{base.strength}</strong></span>
        <span>AGI <strong>{base.agility}</strong></span>
        <span>INT <strong>{base.intelligence}</strong></span>
        <span>END <strong>{base.endurance}</strong></span>
        <span>LCK <strong>{base.luck}</strong></span>
      </section>
      <button ref={buttonRef} type="button" className="sheet-ghost examine" onClick={() => viewerRef.current?.open()}>
        Examine adventure sprite
      </button>
      <CharacterViewer
        ref={viewerRef}
        name={appearance.name}
        level={base.level}
        items={ownedFrom(appearance)}
        returnFocusRef={buttonRef}
        palette={pixel.palette}
        overlays={pixel.overlays}
        caption={pixel.itemNames.join(', ')}
      />
    </main>
  );
}
