'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TITLE_SEEN_KEY } from '../../lib/preview/previewSession';

/**
 * Launch gate for /preview/title.
 * The sessionStorage flag is documented in lib/preview/previewSession.ts.
 * Tab switches (visibilitychange / pageshow) never clear it.
 * TODO: a future setting may skip the title screen. Not built.
 */
export function TitleScreen() {
  const router = useRouter();

  useEffect(() => {
    function skipIfSeen() {
      try {
        if (sessionStorage.getItem(TITLE_SEEN_KEY) === '1') router.replace('/preview/home');
      } catch {
        // Storage can be blocked. Leave the title on screen.
      }
    }
    skipIfSeen();
    document.addEventListener('visibilitychange', skipIfSeen);
    window.addEventListener('pageshow', skipIfSeen);
    return () => {
      document.removeEventListener('visibilitychange', skipIfSeen);
      window.removeEventListener('pageshow', skipIfSeen);
    };
  }, [router]);

  function begin() {
    try {
      sessionStorage.setItem(TITLE_SEEN_KEY, '1');
    } catch {
      // The preview still opens. The flag is only a launch gate.
    }
    router.push('/preview/home');
  }

  return (
    <main className="title-screen">
      <div className="title-aurora" aria-hidden="true" />
      <button type="button" className="title-hit" onClick={begin}>
        <h1 className="title-word">LIFE ASCENSION</h1>
        <span className="title-tap">TAP TO BEGIN</span>
      </button>
    </main>
  );
}
