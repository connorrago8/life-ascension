'use client';

import { useRef } from 'react';
import { CharacterViewer, type CharacterViewerHandle } from '../CharacterViewer';
import type { SlotKey } from '../../lib/equipment';
import type { Appearance, AppearanceColors } from '../../lib/preview/appearance';
import { adventureCharacterModel } from '../../lib/preview/characterRender';
import { COLOR_CHOICES, HAIR_CHOICES, SKIN_CHOICES } from '../../lib/preview/creator';
import { levelTitle, SAMPLE_PROGRESSION } from '../../lib/preview/progression';
import { CharacterPair } from './CharacterPair';
import { usePreviewAppearance } from './usePreviewAppearance';

function ownedFrom(appearance: Appearance) {
  return appearance.equipment.map((item) => ({ slot: item.slot as SlotKey, name: item.name }));
}

export function CharacterScreen() {
  const { appearance, applyColors } = usePreviewAppearance();
  const base = SAMPLE_PROGRESSION;
  const pixel = adventureCharacterModel(appearance);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const viewerRef = useRef<CharacterViewerHandle>(null);

  return (
    <main className="preview-screen character-preview">
      <h1 className="status-name">{appearance.name}</h1>
      <p className="level-line">{levelTitle(base)}</p>
      <p className="creator-note">STR {base.strength} · AGI {base.agility} · INT {base.intelligence} · END {base.endurance} · LCK {base.luck}</p>
      <CharacterPair appearance={appearance} idPrefix="creator" compact />
      <ChoiceRow label="Hair" choices={HAIR_CHOICES} current={appearance} onPick={applyColors} />
      <ChoiceRow label="Skin" choices={SKIN_CHOICES} current={appearance} onPick={applyColors} />
      <ChoiceRow label="Color" choices={COLOR_CHOICES} current={appearance} onPick={applyColors} />
      <button ref={buttonRef} type="button" className="sheet-ghost examine" onClick={() => viewerRef.current?.open()}>
        Pixel examine
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

function swatchColor(colors: Partial<AppearanceColors>): string {
  return colors.hair ?? colors.skin ?? colors.tunic ?? colors.eye ?? '#888888';
}

function colorsMatch(colors: Partial<AppearanceColors>, current: Appearance): boolean {
  return (Object.keys(colors) as (keyof AppearanceColors)[]).every(
    (key) => current[key].toUpperCase() === String(colors[key]).toUpperCase(),
  );
}

function ChoiceRow({
  label,
  choices,
  current,
  onPick,
}: {
  label: string;
  choices: readonly { label: string; colors: Partial<AppearanceColors> }[];
  current: Appearance;
  onPick: (colors: Partial<AppearanceColors>) => void;
}) {
  return (
    <fieldset className="choice-row">
      <legend>{label}</legend>
      <div className="swatches">
        {choices.map((choice) => {
          const pressed = colorsMatch(choice.colors, current);
          return (
            <button
              key={choice.label}
              type="button"
              className={pressed ? 'swatch is-selected' : 'swatch'}
              style={{ background: swatchColor(choice.colors) }}
              aria-pressed={pressed}
              aria-label={`${label}: ${choice.label}`}
              onClick={() => onPick(choice.colors)}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
