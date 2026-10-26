'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  SAMPLE_APPEARANCE,
  swapMainHand,
  withEquippedItem,
  WALKING_STAFF,
  WAYFARER_LANTERN,
  type Appearance,
} from '../../lib/preview/appearance';
import { MAIN_HAND_STORAGE_KEY } from '../../lib/preview/previewSession';

function appearanceForStoredId(id: string | null): Appearance {
  if (id === WAYFARER_LANTERN.id) return withEquippedItem(SAMPLE_APPEARANCE, WAYFARER_LANTERN);
  if (id === WALKING_STAFF.id) return withEquippedItem(SAMPLE_APPEARANCE, WALKING_STAFF);
  return SAMPLE_APPEARANCE;
}

/** Sample gear choice kept in sessionStorage so Home and Adventure match. */
export function usePreviewAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(SAMPLE_APPEARANCE);

  useEffect(() => {
    try {
      setAppearance(appearanceForStoredId(sessionStorage.getItem(MAIN_HAND_STORAGE_KEY)));
    } catch {
      setAppearance(SAMPLE_APPEARANCE);
    }
  }, []);

  const toggleMainHand = useCallback(() => {
    setAppearance((current) => {
      const next = swapMainHand(current);
      const held = next.equipment.find((item) => item.slot === 'main-hand');
      try {
        if (held) sessionStorage.setItem(MAIN_HAND_STORAGE_KEY, held.id);
      } catch {
        // The in-memory swap still updates both drawings on this screen.
      }
      return next;
    });
  }, []);

  return { appearance, toggleMainHand };
}
