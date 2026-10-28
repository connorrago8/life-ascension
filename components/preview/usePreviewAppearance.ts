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
    localStorage.setItem(LOADOUT_KEY, JSON.stringify(loadout));
    sessionStorage.setItem(LOADOUT_KEY, JSON.stringify(loadout));
    const main = loadout.equipmentIds.find((id) => id === 'walking-staff' || id === 'wayfarer-lantern');
    if (main) sessionStorage.setItem(MAIN_HAND_STORAGE_KEY, main);
  } catch {
    // The in-memory choice still updates both drawings on this screen.
  }
}

function readLoadout(): Loadout {
  const base = defaultLoadout();
  try {
    // Prefer durable local preview state; migrate older session-only selections.
    const raw = localStorage.getItem(LOADOUT_KEY) ?? sessionStorage.getItem(LOADOUT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Loadout>;
      const equipmentIds = Array.isArray(parsed.equipmentIds)
        ? parsed.equipmentIds.filter((id): id is string => typeof id === 'string')
        : base.equipmentIds;
      const cosmeticIds = Array.isArray(parsed.cosmeticIds)
        ? parsed.cosmeticIds.filter((id): id is string => typeof id === 'string')
        : [];
      return { equipmentIds, cosmeticIds, colors: sanitizeAppearanceColors(parsed.colors) };
    }
    const main = sessionStorage.getItem(MAIN_HAND_STORAGE_KEY);
    if (main === 'wayfarer-lantern' || main === 'walking-staff') {
      return { ...base, ...equipCatalogId(base.equipmentIds, [], main) };
    }
  } catch {
    return base;
  }
  return base;
}

/** Preview-only appearance persists on this device across browser restarts.
 * This is not authenticated ownership or server-synced equipment. */
export function usePreviewAppearance(verifiedXp?: number) {
  const [loadout, setLoadout] = useState<Loadout>(defaultLoadout);

  useEffect(() => {
    const stored = readLoadout();
    if (verifiedXp !== undefined && verifiedXp < 10) {
      // Cached preview choices cannot bypass the current verified XP gate.
      stored.equipmentIds = stored.equipmentIds.filter((id) => id !== 'ashen-hood');
    }
    setLoadout(stored);
  }, [verifiedXp]);

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
    if (id === 'ashen-hood' && verifiedXp !== undefined && verifiedXp < 10) return;
    setLoadout((current) => {
      const next = { ...current, ...equipCatalogId(current.equipmentIds, current.cosmeticIds, id) };
      persist(next);
      return next;
    });
  }, [verifiedXp]);

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
