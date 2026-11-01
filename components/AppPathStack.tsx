'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect } from 'react';
import { notePop, noteVisit, readPathStack, writePathStack } from '../lib/inAppBack';

/** Remembers in-app paths so Back can pop when the previous entry is the target. */
export function AppPathStack() {
  const pathname = usePathname() || '/';
  useEffect(() => {
    const onPop = () => writePathStack(notePop(readPathStack()));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useLayoutEffect(() => {
    writePathStack(noteVisit(readPathStack(), pathname));
  }, [pathname]);
  return null;
}
