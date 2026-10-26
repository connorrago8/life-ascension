'use client';

import { useState } from 'react';
import type { VisibleSlot } from '../../lib/preview/appearance';
import { PREVIEW_CATALOG } from '../../lib/preview/catalog';
import { usePreviewAppearance } from './usePreviewAppearance';

const GROUPS: readonly { slot: VisibleSlot; label: string }[] = [
  { slot: 'head', label: 'Head' },
  { slot: 'chest', label: 'Armor' },
  { slot: 'legs', label: 'Legs' },
  { slot: 'feet', label: 'Boots' },
  { slot: 'main-hand', label: 'Weapons' },
  { slot: 'off-hand', label: 'Off hand' },
];

export function InventoryScreen() {
  const { equipmentIds, cosmeticIds, equip, unequip } = usePreviewAppearance();
  const [filter, setFilter] = useState<VisibleSlot | 'all' | 'cosmetic'>('all');
  const available = PREVIEW_CATALOG.filter((item) =>
    filter === 'all' ? item.category === 'equipment' :
    filter === 'cosmetic' ? item.category === 'cosmetic' : item.category === 'equipment' && item.slot === filter
  );
  const groups = filter === 'all' ? GROUPS : GROUPS.filter(({ slot }) => slot === filter);

  function row(item: (typeof PREVIEW_CATALOG)[number]) {
    const worn = item.category === 'cosmetic' ? cosmeticIds.includes(item.id) : equipmentIds.includes(item.id);
    return <li key={item.id} className="inventory-item-row">
      <span>{item.name}{worn ? <small className="inventory-equipped-label"> · Equipped</small> : null}</span>
      <button type="button" className="mini-action" onClick={() => worn ? unequip(item.id) : equip(item.id)}>
        {worn ? 'Unequip' : 'Equip'}
      </button>
    </li>;
  }

  return (
    <main className="preview-screen inventory-screen inventory-organized">
      <h1 className="status-name">Inventory</h1>
      <p className="character-gear-note">Browse your available equipment by slot. Equipping replaces the item in that slot.</p>
      <div className="inventory-filters" role="group" aria-label="Filter inventory">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All gear</button>
        {GROUPS.map(({ slot, label }) => <button key={slot} type="button" aria-pressed={filter === slot}
          onClick={() => setFilter(slot)}>{label}</button>)}
        <button type="button" aria-pressed={filter === 'cosmetic'} onClick={() => setFilter('cosmetic')}>Cosmetics</button>
      </div>
      {filter === 'cosmetic' ? (
        <section aria-labelledby="cosmetics-heading">
          <h2 id="cosmetics-heading">Cosmetics</h2>
          <ul className="inventory-list">{available.map(row)}</ul>
        </section>
      ) : groups.map(({ slot, label }) => {
        const items = available.filter((item) => item.slot === slot);
        return <section key={slot} className="inventory-group" aria-labelledby={`inventory-${slot}`}>
          <h2 id={`inventory-${slot}`}>{label}</h2>
          {items.length ? <ul className="inventory-list">{items.map(row)}</ul> :
            <p className="inventory-empty">No items available</p>}
        </section>;
      })}
      <p className="sheet-area">Preview equipment only. Changes are not saved to your account.</p>
    </main>
  );
}
