'use client';

import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

async function flush() {
  try {
    await fetch('/api/push/flush', { method: 'POST' });
  } catch { /* The quest action already succeeded. Delivery can retry. */ }
}

/** Registers the push worker and drains this account's outbox. No fetch caching. */
export function PushBridge({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancel = false;
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => undefined);
    if (!enabled) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void flush();
    }, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') void flush(); };
    document.addEventListener('visibilitychange', onVisible);
    void flush();

    const live: { unsubscribe(): void } = { unsubscribe() {} };
    try {
      const client = supabase();
      void client.auth.getUser().then(({ data, error }) => {
        if (cancel || error || !data.user) return;
        const channel = client.channel(`push-outbox-${data.user.id}`)
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'push_outbox', filter: `actor_id=eq.${data.user.id}`,
          }, () => { void flush(); })
          .subscribe();
        live.unsubscribe = () => { void client.removeChannel(channel); };
      }).catch(() => undefined);
    } catch { /* Supabase is not configured in this browser. */ }

    return () => {
      cancel = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      live.unsubscribe();
    };
  }, [enabled]);

  return null;
}
