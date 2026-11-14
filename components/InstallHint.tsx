'use client';

import { useEffect, useState } from 'react';
import { shouldShowIosInstallHint } from '../lib/push/iosInstall';

const STORAGE_KEY = 'la.engage.ios-hint';

export function InstallHint() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = window.localStorage.getItem(STORAGE_KEY) === 'dismissed'; } catch { dismissed = false; }
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setOpen(shouldShowIosInstallHint({ userAgent: navigator.userAgent, standalone, dismissed }));
  }, []);

  if (!open) return null;

  function dismiss() {
    try { window.localStorage.setItem(STORAGE_KEY, 'dismissed'); } catch { /* private mode */ }
    setOpen(false);
  }

  return (
    <div className="engage-install" role="status">
      <p><strong>Add to Home Screen.</strong> On iPhone, web notifications need the installed app (iOS 16.4+). Tap Share, then Add to Home Screen.</p>
      <button type="button" onClick={dismiss}>Dismiss</button>
    </div>
  );
}
