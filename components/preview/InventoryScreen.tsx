'use client';

import { itemIds } from '../../lib/preview/appearance';
import { catalogItem, PREVIEW_CATALOG } from '../../lib/preview/catalog';
import { effectsForItems, formatGearEffects } from '../../lib/preview/equipmentEffects';
import { CharacterPair } from './CharacterPair';
import { usePreviewAppearance } from './usePreviewAppearance';

export function InventoryScreen() {
  const { appearance, equipmentIds, cosmeticIds, equip, unequip } = usePreviewAppearance();
  const effects = formatGearEffects(effectsForItems(itemIds(appearance)));
  const equipment = PREVIEW_CATALOG.filter((item) => item.category === 'equipment');
  const cosmetics = PREVIEW_CATALOG.filter((item) => item.category === 'cosmetic');
  const bag = [...equipment].sort((a, b) => Number(equipmentIds.includes(a.id)) - Number(equipmentIds.includes(b.id)));

  return (
    <main className="preview-screen inventory-screen">
      <h1 className="status-name">Inventory</h1>
      <CharacterPair appearance={appearance} idPrefix="inventory" compact />
      <p className="gear-line">Gear effects · {effects || 'None'}</p>
      <section aria-labelledby="equipment-heading">
        <h2 id="equipment-heading">Equipment</h2>
        <ul className="inventory-list">
          {bag.map((item) => (
            <ItemRow
              key={item.id}
              name={item.name}
              worn={equipmentIds.includes(item.id)}
              onEquip={() => equip(item.id)}
              onUnequip={() => unequip(item.id)}
            />
          ))}
        </ul>
      </section>
      <section aria-labelledby="cosmetic-heading">
        <h2 id="cosmetic-heading">Cosmetic</h2>
        <ul className="inventory-list">
          {cosmetics.map((item) => (
            <ItemRow
              key={item.id}
              name={item.name}
              worn={cosmeticIds.includes(item.id)}
              onEquip={() => equip(item.id)}
              onUnequip={() => unequip(item.id)}
            />
          ))}
        </ul>
      </section>
      <p className="sheet-area">{catalogItem('wayfarer-lantern') ? 'Preview equip only. Nothing is kept.' : ''}</p>
    </main>
  );
}

function ItemRow({
  name,
  worn,
  onEquip,
  onUnequip,
}: {
  name: string;
  worn: boolean;
  onEquip: () => void;
  onUnequip: () => void;
}) {
  return (
    <li>
      <span>{name}</span>
      {worn ? (
        <button type="button" className="mini-action" aria-label={`Unequip ${name}`} onClick={onUnequip}>Unequip</button>
      ) : (
        <button type="button" className="mini-action" aria-label={`Equip ${name}`} onClick={onEquip}>Equip</button>
      )}
    </li>
  );
}
