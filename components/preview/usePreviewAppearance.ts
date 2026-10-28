'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  appearanceFromLoadout,
  sanitizeAppearanceColors,
  type Appearance,
  type AppearanceColors,
} from '../../lib/preview/appearance';
import {
  colorsForCosmetics,
  DEFAULT_EQUIPMENT_IDS,
  equipCatalogId,
  unequipCatalogId,
} from '../../lib/preview/catalog';
import { MAIN_HAND_STORAGE_KEY } from '../../lib/preview/previewSession';

const LOADOUT_KEY = 'life-ascension.preview.loadout';
const MAIN_HAND_IDS = ['walking-staff', 'wayfarer-lantern', 'initiate-sword'] as const;
function isMainHandId(value: string | null): value is (typeof MAIN_HAND_IDS)[number] {
  return value !== null && MAIN_HAND_IDS.some((id) => id === value);
}

type Loadout = {
  equipmentIds: string[];
  cosmeticIds: string[];
  colors: Partial<AppearanceColors>;
};

function defaultLoadout(): Loadout {
  return { equipmentIds: [...DEFAULT_EQUIPMENT_IDS], cosmeticIds: [], colors: {} };
}

function appearanceFor(loadout: Loadout): Appearance {
  return appearanceFromLoadout({
    equipmentIds: loadout.equipmentIds,
    colors: { ...loadout.colors, ...colorsForCosmetics(loadout.cosmeticIds) },
  });
}

function persist(loadout: Loadout) {
  try {
    sessionStorage.setItem(LOADOUT_KEY, JSON.stringify(loadout));
    const main = loadout.equipmentIds.find((id) => isMainHandId(id));
    if (main) sessionStorage.setItem(MAIN_HAND_STORAGE_KEY, main);
    else sessionStorage.removeItem(MAIN_HAND_STORAGE_KEY);
  } catch {
    // The in-memory choice still updates both drawings on this screen.
  }
}

function readLoadout(): Loadout {
  const base = defaultLoadout();
  try {
    const raw = sessionStorage.getItem(LOADOUT_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      // Stored preview data is untrusted and may be null or a primitive.
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base;
      const saved = parsed as Partial<Loadout>;
      const equipmentIds = Array.isArray(saved.equipmentIds)
        ? saved.equipmentIds.filter((id): id is string => typeof id === 'string' && id.length <= 80).slice(0, 32)
        : base.equipmentIds;
      const cosmeticIds = Array.isArray(saved.cosmeticIds)
        ? saved.cosmeticIds.filter((id): id is string => typeof id === 'string' && id.length <= 80).slice(0, 32)
        : [];
      return { equipmentIds, cosmeticIds, colors: sanitizeAppearanceColors(saved.colors) };
    }
    const main = sessionStorage.getItem(MAIN_HAND_STORAGE_KEY);
    if (isMainHandId(main)) {
      return { ...base, ...equipCatalogId(base.equipmentIds, [], main) };
    }
  } catch {
    return base;
  }
  return base;
}

/** Sample look kept in sessionStorage so Home, Adventure, and Inventory match. */
export function usePreviewAppearance() {
  const [loadout, setLoadout] = useState<Loadout>(defaultLoadout);

  useEffect(() => {
    setLoadout(readLoadout());
  }, []);

  const toggleMainHand = useCallback(() => {
    setLoadout((current) => {
      const nextId = current.equipmentIds.includes('wayfarer-lantern') ? 'walking-staff' : 'wayfarer-lantern';
      const next = equipCatalogId(current.equipmentIds, current.cosmeticIds, nextId);
      const stored = { ...current, ...next };
      persist(stored);
      return stored;
    });
  }, []);

  const equip = useCallback((id: string) => {
    setLoadout((current) => {
      const next = { ...current, ...equipCatalogId(current.equipmentIds, current.cosmeticIds, id) };
      persist(next);
      return next;
    });
  }, []);

  const unequip = useCallback((id: string) => {
    setLoadout((current) => {
      const next = { ...current, ...unequipCatalogId(current.equipmentIds, current.cosmeticIds, id) };
      persist(next);
      return next;
    });
  }, []);

  const applyColors = useCallback((colors: Partial<AppearanceColors>) => {
    setLoadout((current) => {
      const next = { ...current, colors: sanitizeAppearanceColors({ ...current.colors, ...colors }) };
      persist(next);
      return next;
    });
  }, []);

  return {
    appearance: appearanceFor(loadout),
    equipmentIds: loadout.equipmentIds,
    cosmeticIds: loadout.cosmeticIds,
    toggleMainHand,
    equip,
    unequip,
    applyColors,
  };
}
