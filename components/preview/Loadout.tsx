import type { ReactNode } from 'react';
import { EquipSlot } from '../EquipSlot';
import { EQUIPMENT_SLOTS, type SlotKey } from '../../lib/equipment';
import { visibleItem, type Appearance, type VisibleSlot } from '../../lib/preview/appearance';

const LEFT: readonly VisibleSlot[] = ['head', 'chest', 'main-hand'];
const RIGHT: readonly VisibleSlot[] = ['off-hand', 'feet', 'legs'];

function Slot({
  appearance,
  slot,
  onSwapMain,
}: {
  appearance: Appearance;
  slot: VisibleSlot;
  onSwapMain?: () => void;
}) {
  const item = visibleItem(appearance, slot);
  const owned = item ? { slot: item.slot as SlotKey, name: item.name } : null;
  const equipmentSlot = EQUIPMENT_SLOTS.find((entry) => entry.key === slot);
  if (!equipmentSlot) return null;
  const icon = <EquipSlot slot={equipmentSlot} item={owned} />;
  if (!onSwapMain || slot !== 'main-hand') return icon;
  const label = item ? `${item.name}. Swap preview gear.` : 'Main hand empty. Swap preview gear.';
  return (
    <button type="button" className="slot-hit" onClick={onSwapMain} aria-label={label}>
      {icon}
    </button>
  );
}

export function Loadout({
  appearance,
  onSwapMain,
  children,
}: {
  appearance: Appearance;
  onSwapMain?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="loadout">
      <div className="loadout-col">
        {LEFT.map((slot) => (
          <Slot key={slot} appearance={appearance} slot={slot} onSwapMain={onSwapMain} />
        ))}
      </div>
      <div className="loadout-hero">{children}</div>
      <div className="loadout-col">
        {RIGHT.map((slot) => (
          <Slot key={slot} appearance={appearance} slot={slot} />
        ))}
      </div>
    </div>
  );
}
