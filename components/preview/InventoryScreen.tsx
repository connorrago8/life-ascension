'use client';

import { equipmentInOrder, itemIds, VISIBLE_SLOTS, visibleItem } from '../../lib/preview/appearance';
import { effectsForItems, formatGearEffects } from '../../lib/preview/equipmentEffects';
import { levelTitle, SAMPLE_PROGRESSION } from '../../lib/preview/progression';
import { usePreviewAppearance } from './usePreviewAppearance';

export function InventoryScreen() {
  const { appearance, toggleMainHand } = usePreviewAppearance();
  const held = visibleItem(appearance, 'main-hand');
  const effects = formatGearEffects(effectsForItems(itemIds(appearance)));

  return (
    <main className="preview-screen inventory-screen">
      <h1 className="status-name">Inventory</h1>
      <p className="level-line">{levelTitle(SAMPLE_PROGRESSION)}</p>
      <ul className="inventory-list">
        {VISIBLE_SLOTS.map((slot) => {
          const item = equipmentInOrder(appearance).find((entry) => entry.slot === slot);
          return (
            <li key={slot}>
              <span className="inventory-slot">{slot}</span>
              <span>{item ? item.name : 'Empty'}</span>
            </li>
          );
        })}
      </ul>
      <button type="button" className="sheet-action" onClick={toggleMainHand}>
        Swap main hand
      </button>
      <p className="held-caption">Holding {held ? held.name : 'nothing'}</p>
      <section className="split-stats" aria-label="Gear effects">
        <h2>Gear effects</h2>
        <p>{effects || 'None'}</p>
        <p className="sheet-area">Bonuses come from equipped items. Level stays {SAMPLE_PROGRESSION.level}.</p>
      </section>
    </main>
  );
}
