'use client';

import { createContext, useContext } from 'react';

export const TransitionContext = createContext<(href: string) => void>(() => {});

export function usePreviewTransition() {
  return useContext(TransitionContext);
}
