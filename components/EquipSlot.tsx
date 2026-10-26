import { slotAccessibleLabel, type EquipmentSlot, type OwnedItem } from '../lib/equipment';
import { SlotIcon } from './SlotIcon';

export function EquipSlot({
  slot,
  item,
  labelled = true,
}: {
  slot: EquipmentSlot;
  item: OwnedItem | null;
  /** When a parent button names the control, the slot stays visual only. */
  labelled?: boolean;
}) {
  const label = slotAccessibleLabel(slot.label, item);
  return (
    <div
      className={item ? 'equip-slot is-owned' : 'equip-slot'}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? label : undefined}
      aria-hidden={labelled ? undefined : true}
      data-slot={slot.key}
    >
      <SlotIcon slot={slot.key} />
      {item ? <span className="equip-name">{item.name}</span> : null}
    </div>
  );
}
