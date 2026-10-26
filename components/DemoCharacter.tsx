'use client';

import { useRef, useState } from 'react';
import { attributeEntries } from '../lib/attributes';
import { ATTRIBUTE_PREVIEW } from '../lib/character';
import {
  DEMO_BANNER,
  DEMO_COSMETIC_NOTE,
  DEMO_LEVEL,
  DEMO_NAME,
  DEMO_SLOT_NOTE,
  DEMO_XP,
  DEMO_XP_FOR_NEXT,
  DEMO_XP_INTO_LEVEL,
  demoItemFor,
  initialEquippedSlots,
  itemsFromEquipped,
  toggleEquipped,
} from '../lib/demoGear';
import { slotsWithItems, type SlotKey } from '../lib/equipment';
import { WELLNESS_EMPTY, wellnessSnapshot } from '../lib/wellness';
import { AdventurerSprite } from './AdventurerSprite';
import { CharacterViewer, type CharacterViewerHandle } from './CharacterViewer';
import { EquipSlot } from './EquipSlot';
import { SlotIcon } from './SlotIcon';
import { cosmeticOverlays } from './spriteArt';

type Props = {
  /** Test seam. The page omits this, so every sample cosmetic starts equipped. */
  initialEquipped?: readonly SlotKey[];
};

/** Keep slot order and drop duplicates. An omitted list means everything is worn. */
function startingSlots(slots: readonly SlotKey[] | undefined): SlotKey[] {
  if (!slots) return initialEquippedSlots();
  const picked = new Set(slots);
  return initialEquippedSlots().filter((slot) => picked.has(slot));
}

export function DemoCharacter({ initialEquipped }: Props) {
  const [equipped, setEquipped] = useState<readonly SlotKey[]>(() => startingSlots(initialEquipped));
  const avatarRef = useRef<HTMLButtonElement>(null);
  const viewerRef = useRef<CharacterViewerHandle>(null);

  const items = itemsFromEquipped(equipped);
  const slots = slotsWithItems(items);
  const attributes = attributeEntries(null);
  const wellness = wellnessSnapshot(null);
  const fraction = DEMO_XP_FOR_NEXT <= 0 ? 0 : DEMO_XP_INTO_LEVEL / DEMO_XP_FOR_NEXT;

  function toggle(slot: SlotKey) {
    setEquipped((current) => toggleEquipped(current, slot));
  }

  return (
    <main className="screen character-screen demo-screen" data-demo="items">
      <p className="demo-banner" role="status">{DEMO_BANNER}</p>
      <p className="demo-note">{DEMO_COSMETIC_NOTE}</p>
      <p className="demo-note">{DEMO_SLOT_NOTE}</p>
      <p className="page-brand">LIFE ASCENSION</p>
      <section className="avatar-card" aria-label="Adventurer">
        <button
          ref={avatarRef}
          type="button"
          className="avatar-hit"
          aria-haspopup="dialog"
          aria-label={`${DEMO_NAME}, level ${DEMO_LEVEL}. Expand character`}
          onClick={() => viewerRef.current?.open()}
        >
          <span className="avatar-circle">
            <AdventurerSprite overlays={cosmeticOverlays(items)} />
          </span>
        </button>
        <div className="avatar-meta">
          <h1 className="char-name">{DEMO_NAME}</h1>
          <p className="char-level">Level {DEMO_LEVEL}</p>
          <div
            className="xp-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={DEMO_XP_FOR_NEXT}
            aria-valuenow={DEMO_XP_INTO_LEVEL}
            aria-label="Progress to next level"
          >
            <span className="xp-fill" style={{ width: `${fraction * 100}%` }} />
          </div>
          <p className="xp-fraction">{DEMO_XP_INTO_LEVEL} / {DEMO_XP_FOR_NEXT} XP</p>
        </div>
      </section>

      <ul className="equip-row" aria-label="Equipment">
        {slots.map(({ slot, item }) => {
          const sample = demoItemFor(slot.key);
          const on = Boolean(item);
          return (
            <li key={slot.key}>
              <button
                type="button"
                className="equip-toggle"
                data-equip-control="slot"
                data-slot={slot.key}
                aria-pressed={on}
                aria-label={on ? `Unequip ${sample.name}` : `Equip ${sample.name}`}
                onClick={() => toggle(slot.key)}
              >
                <EquipSlot slot={slot} item={item} labelled={false} />
              </button>
            </li>
          );
        })}
      </ul>

      <section className="demo-bag" aria-labelledby="demo-bag-heading">
        <h2 id="demo-bag-heading">Bag</h2>
        <ul>
          {slots.map(({ slot, item }) => {
            const sample = demoItemFor(slot.key);
            const on = Boolean(item);
            return (
              <li key={slot.key}>
                <button
                  type="button"
                  data-equip-control="bag"
                  data-slot={slot.key}
                  data-kind={sample.kind}
                  aria-pressed={on}
                  onClick={() => toggle(slot.key)}
                >
                  <span className="demo-bag-icon" aria-hidden="true"><SlotIcon slot={slot.key} /></span>
                  <span className="demo-bag-copy">
                    <span className="demo-kind">{sample.kind}</span>
                    <span className="demo-item-name">{sample.name}</span>
                  </span>
                  <span className="demo-state">{on ? 'Equipped' : 'In bag'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="stat-block" aria-label="Attributes">
        <div className="stat-grid">
          {attributes.map((attribute) => (
            <div key={attribute.key} className="stat">
              <span className="stat-label">{attribute.short}</span>
              <span className="stat-value" aria-label={attribute.pending ? `${attribute.label}, not recorded` : `${attribute.label} ${attribute.value}`}>
                {attribute.value}
              </span>
            </div>
          ))}
        </div>
        <p className="soon-note">
          Coming soon
          <span className="sr-only">. {ATTRIBUTE_PREVIEW}</span>
        </p>
      </section>

      <section className="wellness" id="wellness" aria-labelledby="wellness-heading">
        <h2 id="wellness-heading">Wellness</h2>
        {wellness.connected ? (
          <div className="wellness-readings">
            {wellness.sleepHours != null && <p>Sleep {wellness.sleepHours} h</p>}
            {wellness.steps != null && <p>Steps {wellness.steps}</p>}
          </div>
        ) : (
          <p className="wellness-empty">{WELLNESS_EMPTY}</p>
        )}
      </section>

      <p className="demo-xp-note">This preview shows {DEMO_XP} lifetime XP. Equipping a cosmetic does not grant any.</p>

      <CharacterViewer
        ref={viewerRef}
        name={DEMO_NAME}
        level={DEMO_LEVEL}
        items={items}
        returnFocusRef={avatarRef}
        notice={DEMO_BANNER}
        detail={DEMO_COSMETIC_NOTE}
        onToggleSlot={toggle}
        showEquippedList
      />
    </main>
  );
}

export default DemoCharacter;
