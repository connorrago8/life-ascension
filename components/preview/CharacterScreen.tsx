'use client';

import { useEffect, useRef, useState } from 'react';
import type { VisibleSlot } from '../../lib/preview/appearance';
import { PREVIEW_CATALOG } from '../../lib/preview/catalog';
import { homeCharacterModel } from '../../lib/preview/characterRender';
import { characterGearView, type AuthenticatedGearSnapshot, type CharacterEquipmentMode } from '../../lib/preview/characterGearView';
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

export function CharacterScreen({ displayName, hideSampleStats = false, equipmentMode = 'preview', verifiedGear, onEquipArmor, armorBusy = false }: { displayName?: string; hideSampleStats?: boolean; equipmentMode?: CharacterEquipmentMode; verifiedGear?: AuthenticatedGearSnapshot | null; onEquipArmor?: (equip: boolean) => void; armorBusy?: boolean } = {}) {
  const { appearance, equipmentIds, equip, unequip } = usePreviewAppearance();
  const gearView = characterGearView(equipmentMode, appearance, verifiedGear);
  const ownedArmor = gearView.source === 'verified' && verifiedGear?.ownedItemIds.includes('ashen-hood') === true;
  const wearingArmor = gearView.appearance.equipment.some((item) => item.id === 'ashen-hood');
  const visibleAppearance = displayName ? { ...gearView.appearance, name: displayName } : gearView.appearance;
  const [selectedSlot, setSelectedSlot] = useState<VisibleSlot | null>(null);
  const pickerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!selectedSlot) return;
    const id = window.requestAnimationFrame(() => pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    return () => window.cancelAnimationFrame(id);
  }, [selectedSlot]);
  const base = SAMPLE_PROGRESSION;
  const slotLabel = [...LEFT_SLOTS, ...RIGHT_SLOTS].find((entry) => entry.slot === selectedSlot)?.label;
  const alternatives = PREVIEW_CATALOG.filter((item) => item.category === 'equipment' && item.slot === selectedSlot);
  const equippedItem = selectedSlot ? gearView.appearance.equipment.find((item) => item.slot === selectedSlot) : null;

  function slotButton(slot: VisibleSlot, label: string) {
    const item = gearView.appearance.equipment.find((entry) => entry.slot === slot);
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
    <div className="preview-screen character-preview character-equipment-screen">
      <header className="character-header">
        <div><h1 className="status-name">{displayName ?? gearView.appearance.name}</h1>{gearView.canChange && <p className="level-line">{levelTitle(base)}</p>}</div>
        <p className="character-header-note">EQUIPMENT</p>
      </header>
      <section className="character-loadout-stage" aria-label={gearView.canChange ? 'Equipped character and gear preview' : gearView.source === 'verified' ? 'Server-verified equipped character' : 'Character with unverified equipment hidden'}>
        <div className="character-slot-column">{gearView.canChange ? LEFT_SLOTS.map(({ slot, label }) => slotButton(slot, label)) : null}</div>
        <div className="character-avatar" aria-label="Full-body front-facing adventurer">
          <HomeCharacter model={homeCharacterModel(visibleAppearance)} idPrefix="character" beltPreviewStage={gearView.beltStage} />
        </div>
        <div className="character-slot-column">{gearView.canChange ? RIGHT_SLOTS.map(({ slot, label }) => slotButton(slot, label)) : null}</div>
      </section>
      {gearView.canChange && selectedSlot ? (
        <section ref={pickerRef} className="character-slot-picker" aria-label={`${slotLabel} equipment choices`}>
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
      ) : <p className="character-gear-note" role={gearView.canChange ? undefined : 'status'}>{gearView.canChange ? 'Tap an equipment slot to see what you can equip. Gear changes update your character.' : gearView.source === 'verified' ? (gearView.appearance.equipment.some((item) => item.id === 'ashen-hood') ? 'Ashen Hood equipped (server-verified). Gear changes require server authorization.' : 'No armor equipped on this account. Gear changes require server authorization.') : 'Equipment is not yet verified for this account. Preview items are hidden and cannot be equipped.'}</p>}
      {ownedArmor && onEquipArmor && <button type="button" className="btn" disabled={armorBusy}
        onClick={() => onEquipArmor(!wearingArmor)} aria-label={wearingArmor ? 'Unequip Ashen Hood' : 'Equip Ashen Hood'}>
        {armorBusy ? 'Saving armor…' : wearingArmor ? 'Unequip Ashen Hood' : 'Equip Ashen Hood'}
      </button>}
      {gearView.canChange && !hideSampleStats && <section className="character-stats" aria-label="Sample character attributes">
        <span>STR <strong>{base.strength}</strong></span><span>AGI <strong>{base.agility}</strong></span>
        <span>INT <strong>{base.intelligence}</strong></span><span>END <strong>{base.endurance}</strong></span>
        <span>LCK <strong>{base.luck}</strong></span>
      </section>}
    </div>
  );
}
