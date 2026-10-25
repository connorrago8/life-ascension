'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { slotsWithItems, type OwnedItem } from '../lib/equipment';
import { AdventurerSprite } from './AdventurerSprite';
import { EquipSlot } from './EquipSlot';

const LEFT = ['head', 'chest', 'main-hand'] as const;
const RIGHT = ['off-hand', 'feet', 'legs'] as const;

export type CharacterViewerHandle = { open: () => void };

type Props = {
  name: string;
  level: number;
  items: readonly OwnedItem[];
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

export const CharacterViewer = forwardRef<CharacterViewerHandle, Props>(function CharacterViewer(
  { name, level, items, returnFocusRef },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const equipped = slotsWithItems(items);

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
      return <EquipSlot key={entry.slot.key} slot={entry.slot} item={entry.item} />;
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
        <div className="viewer-stage">
          <div className="viewer-col">{column(LEFT)}</div>
          <div className="viewer-hero">
            <div className="avatar-circle avatar-circle-lg">
              <AdventurerSprite label={`${name} in beginner clothes`} />
            </div>
            <p className="viewer-caption">Beginner clothes</p>
          </div>
          <div className="viewer-col">{column(RIGHT)}</div>
        </div>
      </div>
    </dialog>
  );
});
