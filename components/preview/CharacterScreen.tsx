'use client';

import { useState } from 'react';
import type { VisibleSlot } from '../../lib/preview/appearance';
import { PREVIEW_CATALOG } from '../../lib/preview/catalog';
import { homeCharacterModel } from '../../lib/preview/characterRender';
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

export function CharacterScreen() {
  const { appearance, equipmentIds, equip, unequip } = usePreviewAppearance();
  const [selectedSlot, setSelectedSlot] = useState<VisibleSlot | null>(null);
  const base = SAMPLE_PROGRESSION;
  const slotLabel = [...LEFT_SLOTS, ...RIGHT_SLOTS].find((entry) => entry.slot === selectedSlot)?.label;
  const alternatives = PREVIEW_CATALOG.filter((item) => item.category === 'equipment' && item.slot === selectedSlot);
  const equippedItem = selectedSlot ? appearance.equipment.find((item) => item.slot === selectedSlot) : null;

  function slotButton(slot: VisibleSlot, label: string) {
    const item = appearance.equipment.find((entry) => entry.slot === slot);
    return (
      <button key={slot} type="button" className="character-gear-slot character-slot-button"
        aria-label={`Change ${label}: ${item?.name ?? 'Empty'}`}
        aria-expanded={selectedSlot === slot}
        onClick={() => setSelectedSlot((current) => current === slot ? null : slot)}>
        <span className="character-slot-label">{label}</span>
        <span className="character-slot-item">{item?.name ?? 'Empty'}</span>
        <span className="character-slot-hint">Change ›</span>
      </button>
    );
  }

  return (
    <main className="preview-screen character-preview character-equipment-screen">
      <header className="character-header">
        <div><h1 className="status-name">{appearance.name}</h1><p className="level-line">{levelTitle(base)}</p></div>
        <p className="character-header-note">EQUIPMENT</p>
      </header>
      <section className="character-loadout-stage" aria-label="Equipped character and gear">
        <div className="character-slot-column">{LEFT_SLOTS.map(({ slot, label }) => slotButton(slot, label))}</div>
        <div className="character-avatar" aria-label="Full-body front-facing adventurer">
          <HomeCharacter model={homeCharacterModel(appearance)} idPrefix="character" />
        </div>
        <div className="character-slot-column">{RIGHT_SLOTS.map(({ slot, label }) => slotButton(slot, label))}</div>
      </section>
      {selectedSlot ? (
        <section className="character-slot-picker" aria-label={`${slotLabel} equipment choices`}>
          <div className="character-picker-heading">
            <div><span className="character-slot-label">{slotLabel}</span><h2>Choose equipment</h2></div>
            <button type="button" className="character-picker-close" onClick={() => setSelectedSlot(null)} aria-label="Close equipment choices">×</button>
          </div>
          {alternatives.length === 0 ? <p className="sheet-area">No {slotLabel?.toLowerCase()} items available in this preview yet.</p> : (
            <ul className="inventory-list">
              {alternatives.map((item) => {
                const worn = equipmentIds.includes(item.id);
                return <li key={item.id}>
                  <span>{item.name}{worn ? <small className="inventory-equipped-label"> · Equipped</small> : null}</span>
                  <button type="button" className="mini-action" disabled={worn}
                    onClick={() => { equip(item.id); setSelectedSlot(null); }}>{worn ? 'Equipped' : 'Equip'}</button>
                </li>;
              })}
            </ul>
          )}
          {equippedItem ? <button type="button" className="character-unequip-action"
            onClick={() => { const worn = alternatives.find((item) => equipmentIds.includes(item.id)); if (worn) unequip(worn.id); setSelectedSlot(null); }}>
            Unequip {equippedItem.name}
          </button> : null}
        </section>
      ) : <p className="character-gear-note">Tap an equipment slot to see what you can equip. Gear changes update your character.</p>}
      <section className="character-stats" aria-label="Character attributes">
        <span>STR <strong>{base.strength}</strong></span><span>AGI <strong>{base.agility}</strong></span>
        <span>INT <strong>{base.intelligence}</strong></span><span>END <strong>{base.endurance}</strong></span>
        <span>LCK <strong>{base.luck}</strong></span>
      </section>
    </main>
  );
}
