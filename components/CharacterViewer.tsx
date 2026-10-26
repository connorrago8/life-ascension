'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { slotsWithItems, type OwnedItem, type SlotKey } from '../lib/equipment';
import { AdventurerSprite } from './AdventurerSprite';
import { EquipSlot } from './EquipSlot';
import { cosmeticOverlays } from './spriteArt';

const LEFT = ['headwear', 'armor', 'weapon'] as const satisfies readonly SlotKey[];
const RIGHT = ['shield', 'cloak', 'companion'] as const satisfies readonly SlotKey[];

export type CharacterViewerHandle = { open: () => void };

type Props = {
  name: string;
  level: number;
  items: readonly OwnedItem[];
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  /** Persistent note, shown again while the dialog covers the page. */
  notice?: string;
  /** Short line under the notice. Cosmetics call this out in the demo. */
  detail?: string;
  /** When set, each slot is a button that toggles that item. */
  onToggleSlot?: (slot: SlotKey) => void;
  /** Lists what is worn. The live character screen leaves this off while every slot is empty. */
  showEquippedList?: boolean;
};

export const CharacterViewer = forwardRef<CharacterViewerHandle, Props>(function CharacterViewer(
  { name, level, items, returnFocusRef, notice, detail, onToggleSlot, showEquippedList = false },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const equipped = slotsWithItems(items);
  const worn = equipped.filter((entry) => entry.item);
  const overlays = cosmeticOverlays(items);
  const spriteLabel = worn.length > 0
    ? `${name} wearing ${worn.map((entry) => entry.item?.name).filter(Boolean).join(', ')}`
    : `${name} in beginner clothes`;

  useImperativeHandle(ref, () => ({
    open() {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      dialog.showModal();
      setOpen(true);
      closeRef.current?.focus();
    },
  }));

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  function close() {
    dialogRef.current?.close();
  }

  function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  function column(keys: readonly string[]) {
    return keys.map((key) => {
      const entry = equipped.find((slot) => slot.slot.key === key);
      if (!entry) return null;
      if (!onToggleSlot) return <EquipSlot key={entry.slot.key} slot={entry.slot} item={entry.item} />;
      const pressed = Boolean(entry.item);
      const action = pressed && entry.item ? `Unequip ${entry.item.name}` : `Equip ${entry.slot.label}`;
      return (
        <button
          key={entry.slot.key}
          type="button"
          className="equip-toggle"
          data-equip-control="viewer"
          data-slot={entry.slot.key}
          aria-pressed={pressed}
          aria-label={action}
          onClick={() => onToggleSlot(entry.slot.key)}
        >
          <EquipSlot slot={entry.slot} item={entry.item} labelled={false} />
        </button>
      );
    });
  }

  return (
    <dialog
      ref={dialogRef}
      className="viewer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="character-viewer-title"
      onKeyDown={trapTab}
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
      onClose={() => {
        setOpen(false);
        returnFocusRef.current?.focus();
      }}
    >
      <div className="viewer-panel">
        <div className="viewer-sticky">
          <div className="viewer-top">
            <div>
              <p className="page-brand">LIFE ASCENSION</p>
              <h2 id="character-viewer-title">{name}</h2>
              <p className="viewer-level">Level {level}</p>
            </div>
            <button ref={closeRef} type="button" className="viewer-close" onClick={close} aria-label="Close">
              <span aria-hidden="true">×</span>
            </button>
          </div>
          {notice ? <p className="demo-banner" role="status">{notice}</p> : null}
          {detail ? <p className="demo-note">{detail}</p> : null}
        </div>
        <div className="viewer-stage">
          <div className="viewer-col">{column(LEFT)}</div>
          <div className="viewer-hero">
            <div className="avatar-circle avatar-circle-lg">
              <AdventurerSprite label={spriteLabel} overlays={overlays} />
            </div>
            <p className="viewer-caption">{worn.length > 0 ? 'Beginner clothes, plus cosmetics' : 'Beginner clothes'}</p>
          </div>
          <div className="viewer-col">{column(RIGHT)}</div>
        </div>
        {showEquippedList ? (
          <section className="viewer-gear" aria-label="Equipped items">
            <h3>Equipped</h3>
            {worn.length === 0 ? (
              <p className="viewer-gear-empty">Nothing equipped</p>
            ) : (
              <ul>
                {worn.map((entry) => (
                  <li key={entry.slot.key}>
                    <span className="viewer-gear-slot">{entry.item?.kind || entry.slot.label}</span>
                    <span>{entry.item?.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </dialog>
  );
});
