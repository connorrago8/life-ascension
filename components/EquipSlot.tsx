'use client';

import { useRef } from 'react';
import { EQUIPMENT_PREVIEW } from '../lib/character';

export const SLOTS = [
  { key: 'head', label: 'Head', icon: '/character/slot-head.png', side: 'left' },
  { key: 'chest', label: 'Chest', icon: '/character/slot-chest.png', side: 'left' },
  { key: 'main-hand', label: 'Main Hand', icon: '/character/slot-main.png', side: 'left' },
  { key: 'off-hand', label: 'Off Hand', icon: '/character/slot-off.png', side: 'right' },
  { key: 'legs', label: 'Legs', icon: '/character/slot-legs.png', side: 'right' },
  { key: 'feet', label: 'Feet', icon: '/character/slot-feet.png', side: 'right' },
] as const;

export type EquipmentSlot = (typeof SLOTS)[number];

export function EquipSlot({ slot }: { slot: EquipmentSlot }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `slot-${slot.key}-title`;

  function open() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }

  return (
    <div className="equip-slot-wrap" data-slot={slot.key}>
      <button
        type="button"
        className="equip-slot"
        onClick={open}
        aria-haspopup="dialog"
        aria-label={`${slot.label}. ${EQUIPMENT_PREVIEW}`}
      >
        <img src={slot.icon} alt="" width={48} height={48} className="equip-icon pixelated" />
        <span className="equip-label">{slot.label}</span>
      </button>
      <dialog
        ref={dialogRef}
        className="equip-dialog"
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <p className="eyebrow">Preview</p>
        <h2 id={titleId}>{slot.label}</h2>
        <p>{EQUIPMENT_PREVIEW}</p>
        <button type="button" className="btn warm" onClick={() => dialogRef.current?.close()}>Close</button>
      </dialog>
    </div>
  );
}
