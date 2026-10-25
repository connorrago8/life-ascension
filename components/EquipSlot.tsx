import { slotAccessibleLabel, type EquipmentSlot, type OwnedItem } from '../lib/equipment';
import { SlotIcon } from './SlotIcon';

export function EquipSlot({ slot, item }: { slot: EquipmentSlot; item: OwnedItem | null }) {
  const label = slotAccessibleLabel(slot.label, item);
  return (
    <div
      className={item ? 'equip-slot is-owned' : 'equip-slot'}
      role="img"
      aria-label={label}
      data-slot={slot.key}
    >
      <SlotIcon slot={slot.key} />
    </div>
  );
}
