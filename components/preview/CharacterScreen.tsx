'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PREVIEW_CATALOG, catalogItem } from '../../lib/preview/catalog';
import { homeCharacterModel } from '../../lib/preview/characterRender';
import { characterGearView, type AuthenticatedGearSnapshot, type CharacterEquipmentMode } from '../../lib/preview/characterGearView';
import { effectsForItems, formatGearEffects } from '../../lib/preview/equipmentEffects';
import { levelTitle, SAMPLE_PROGRESSION } from '../../lib/preview/progression';
import {
  LEFT_GEAR_SLOTS,
  RIGHT_GEAR_SLOTS,
  gearSlot,
  gearSlotForRendererSlot,
  isSlotUnlocked,
  ownedItemsForSlot,
  slotLockText,
  type GearSlot,
  type GearSlotKey,
} from '../../lib/gearSlots';
import { HomeCharacter } from './HomeCharacter';
import { usePreviewAppearance } from './usePreviewAppearance';

type SheetItem = { id: string; name: string; boosts: string; equipped: boolean };

function LockIcon() {
  return (
    <svg className="character-slot-lock" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function boostsFor(id: string): string {
  return formatGearEffects(effectsForItems([id])) || 'No stat boosts';
}

/**
 * Character equipment. Preview mode equips local sample gear. Verified mode lists
 * only server-owned items and every change goes through onEquipItem, which calls
 * the owner-checked, level-gated server RPC; this component never grants items.
 */
export function CharacterScreen({
  displayName,
  hideSampleStats = false,
  equipmentMode = 'preview',
  verifiedGear,
  playerLevel,
  onEquipItem,
  armorBusy = false,
}: {
  displayName?: string;
  hideSampleStats?: boolean;
  equipmentMode?: CharacterEquipmentMode;
  verifiedGear?: AuthenticatedGearSnapshot | null;
  /** Level derived from verified lifetime XP. Preview mode falls back to the sample level. */
  playerLevel?: number | null;
  onEquipItem?: (slot: GearSlotKey, itemId: string, equip: boolean) => void;
  armorBusy?: boolean;
} = {}) {
  const { appearance, equipmentIds, equip, unequip } = usePreviewAppearance();
  const gearView = characterGearView(equipmentMode, appearance, verifiedGear);
  const visibleAppearance = displayName ? { ...gearView.appearance, name: displayName } : gearView.appearance;
  const base = SAMPLE_PROGRESSION;
  // Preview uses the sample level shown in its level line; real accounts use verified XP only.
  const level = gearView.canChange ? base.level : (playerLevel ?? null);
  const serverEquip = gearView.source === 'verified' && Boolean(verifiedGear) && Boolean(onEquipItem);
  const interactive = gearView.canChange || serverEquip;
  const [selectedSlot, setSelectedSlot] = useState<GearSlotKey | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);

  const closeSheet = useCallback(() => {
    setSelectedSlot(null);
    const target = returnFocusRef.current;
    if (target) window.requestAnimationFrame(() => target.focus());
  }, []);

  useEffect(() => {
    if (!selectedSlot) return;
    const sheet = sheetRef.current;
    sheet?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); closeSheet(); return; }
      if (event.key !== 'Tab' || !sheet) return;
      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>('button:not([disabled])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedSlot, closeSheet]);

  function equippedInSlot(slot: GearSlot) {
    if (!slot.rendererSlot) return null;
    return gearView.appearance.equipment.find((entry) => entry.slot === slot.rendererSlot) ?? null;
  }

  function sheetItems(key: GearSlotKey): SheetItem[] {
    if (gearView.canChange) {
      return PREVIEW_CATALOG.filter((item) => item.category === 'equipment' && gearSlotForRendererSlot(item.slot) === key)
        .map((item) => ({ id: item.id, name: item.name, boosts: boostsFor(item.id), equipped: equipmentIds.includes(item.id) }));
    }
    if (!serverEquip) return [];
    return ownedItemsForSlot(verifiedGear?.ownedItemIds, key).map((id) => ({
      id,
      name: catalogItem(id)?.name ?? id,
      boosts: boostsFor(id),
      equipped: verifiedGear?.equippedItemIds.includes(id) === true,
    }));
  }

  function chooseItem(key: GearSlotKey, itemId: string, nextEquipped: boolean) {
    if (!isSlotUnlocked(level, key)) return;
    if (gearView.canChange) {
      if (nextEquipped) equip(itemId); else unequip(itemId);
    } else if (serverEquip) {
      onEquipItem?.(key, itemId, nextEquipped);
    }
    closeSheet();
  }

  function slotTile(slot: GearSlot) {
    const item = equippedInSlot(slot);
    const unlocked = isSlotUnlocked(level, slot.key);
    const itemName = item?.name ?? 'Empty';
    if (!unlocked) {
      return (
        <div key={slot.key} className="character-gear-slot character-slot-locked" role="group"
          aria-label={`${slot.label}: locked. ${slotLockText(slot.key)}`} data-slot={slot.key}>
          <span className="character-slot-label">{slot.label}</span>
          <span className="character-slot-item character-slot-lock-line"><LockIcon /> {slotLockText(slot.key)}</span>
        </div>
      );
    }
    if (!interactive) {
      return (
        <div key={slot.key} className="character-gear-slot character-slot-readonly" role="group"
          aria-label={`${slot.label}: ${itemName}`} data-slot={slot.key}>
          <span className="character-slot-label">{slot.label}</span>
          <span className={item ? 'character-slot-item' : 'character-slot-item character-slot-empty'}>{itemName}</span>
        </div>
      );
    }
    return (
      <button key={slot.key} type="button" className="character-gear-slot character-slot-button" data-slot={slot.key}
        aria-label={`${slot.label}: ${itemName}. Choose equipment`}
        aria-haspopup="dialog"
        aria-expanded={selectedSlot === slot.key}
        disabled={armorBusy}
        onClick={(event) => { returnFocusRef.current = event.currentTarget; setSelectedSlot(slot.key); }}>
        <span className="character-slot-label">{slot.label}</span>
        <span className={item ? 'character-slot-item' : 'character-slot-item character-slot-empty'}>{itemName}</span>
        <span className="character-slot-hint" aria-hidden="true">Change ›</span>
      </button>
    );
  }

  const selected = selectedSlot ? gearSlot(selectedSlot) : null;
  const items = selected ? sheetItems(selected.key) : [];
  const wornItem = items.find((item) => item.equipped) ?? null;

  return (
    <div className="preview-screen character-preview character-equipment-screen">
      <header className="character-header">
        {/* The signed-in route already titles the page with the player's name; show it once. */}
        <div>{displayName ? null : <h1 className="status-name">{gearView.appearance.name}</h1>}{/* Sample level title belongs to the standalone demo only; the Character route shows the real Lv bar. */}{!displayName && gearView.canChange && <p className="level-line">{levelTitle(base)}</p>}</div>
        <h2 className="character-header-note">EQUIPMENT</h2>
      </header>
      <section className="character-loadout-stage" aria-label={gearView.canChange ? 'Equipped character and gear preview' : gearView.source === 'verified' ? 'Server-verified equipped character' : 'Character with unverified equipment hidden'}>
        <div className="character-slot-column">{LEFT_GEAR_SLOTS.map(slotTile)}</div>
        <div className="character-avatar" aria-label="Full-body front-facing adventurer">
          <HomeCharacter model={homeCharacterModel(visibleAppearance)} idPrefix="character" beltPreviewStage={gearView.beltStage} />
        </div>
        <div className="character-slot-column">{RIGHT_GEAR_SLOTS.map(slotTile)}</div>
      </section>
      <p className="character-gear-note" role={gearView.canChange ? undefined : 'status'}>
        {gearView.canChange
          ? 'Tap an equipment slot to see what you can equip. Gear changes update your character.'
          : serverEquip
            ? (armorBusy ? 'Saving equipment…' : 'Tap a slot to equip.')
            : 'Equipment is not yet verified for this account. Preview items are hidden and cannot be equipped.'}
      </p>
      {interactive && selected ? (
        <>
          <button type="button" className="sheet-backdrop gear-sheet-backdrop" aria-label="Close equipment choices" tabIndex={-1} onClick={closeSheet} />
          <div ref={sheetRef} className="quest-sheet gear-sheet" role="dialog" aria-modal="true" aria-labelledby="gear-sheet-title">
            <div className="sheet-handle" aria-hidden="true" />
            <p className="sheet-kicker">{selected.label}</p>
            <h2 id="gear-sheet-title">Choose {selected.label.toLowerCase()}</h2>
            {items.length === 0 ? (
              <p className="sheet-area gear-sheet-empty">No items for this slot yet</p>
            ) : (
              <ul className="gear-sheet-list">
                {items.map((item) => (
                  <li key={item.id} className="gear-sheet-item">
                    <span className="gear-sheet-item-text">
                      <span className="gear-sheet-item-name">{item.name}{item.equipped ? <small className="inventory-equipped-label"> · Equipped</small> : null}</span>
                      <span className="gear-sheet-boosts">{item.boosts}</span>
                    </span>
                    <button type="button" className="mini-action" disabled={item.equipped || armorBusy}
                      aria-label={item.equipped ? `${item.name} equipped` : `Equip ${item.name}`}
                      onClick={() => chooseItem(selected.key, item.id, true)}>{item.equipped ? 'Equipped' : 'Equip'}</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="sheet-actions">
              {wornItem ? (
                <button type="button" className="sheet-ghost" disabled={armorBusy}
                  aria-label={`Unequip ${wornItem.name}`}
                  onClick={() => chooseItem(selected.key, wornItem.id, false)}>Unequip {wornItem.name}</button>
              ) : null}
              <button type="button" className="sheet-ghost" onClick={closeSheet}>Close</button>
            </div>
          </div>
        </>
      ) : null}
      {gearView.canChange && !hideSampleStats && <section className="character-stats" aria-label="Sample character attributes">
        <span>STR <strong>{base.strength}</strong></span><span>AGI <strong>{base.agility}</strong></span>
        <span>INT <strong>{base.intelligence}</strong></span><span>END <strong>{base.endurance}</strong></span>
        <span>LCK <strong>{base.luck}</strong></span>
      </section>}
    </div>
  );
}
