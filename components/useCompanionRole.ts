'use client';

import { useEffect, useState } from 'react';
import {
  clearCompanionRoleCache,
  readCompanionRoleCache,
  roleFromCompanionState,
  writeCompanionRoleCache,
  type SessionRole,
} from '../lib/companionAccess';
import { supabase } from '../lib/supabase';

export type CompanionRoleState = { status: 'loading' | 'ready'; mode: SessionRole };

function ready(mode: SessionRole): CompanionRoleState {
  return { status: 'ready', mode };
}

export function useCompanionRole(enabled = true): CompanionRoleState {
  const [state, setState] = useState<CompanionRoleState>(() => {
    const cached = readCompanionRoleCache();
    return cached ? ready(cached.mode) : { status: 'loading', mode: 'signed-out' };
  });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let unsubscribe = () => {};
    const apply = (next: CompanionRoleState) => {
      if (active) setState(next);
    };
    async function resolve(userId: string | null) {
      if (!userId) {
        clearCompanionRoleCache();
        apply(ready('signed-out'));
        return;
      }
      const cached = readCompanionRoleCache();
      if (cached && cached.userId !== userId) {
        clearCompanionRoleCache();
        apply({ status: 'loading', mode: 'signed-out' });
      } else if (cached?.userId === userId) {
        apply(ready(cached.mode));
      }
      const { data, error } = await supabase().rpc('companion_state');
      const mode = roleFromCompanionState({
        signedIn: true,
        bond: error || !data || typeof data !== 'object' ? null : (data as { bond?: { role?: string; status?: string } | null }).bond,
      });
      if (mode === 'signed-out') {
        clearCompanionRoleCache();
      } else {
        writeCompanionRoleCache({ userId, mode });
      }
      apply(ready(mode));
    }
    try {
      const client = supabase();
      void client.auth.getUser().then(({ data, error }) => {
        void resolve(error ? null : data.user?.id ?? null);
      });
      const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
        const userId = session?.user?.id ?? null;
        if (event === 'SIGNED_OUT' || !userId) {
          clearCompanionRoleCache();
          apply(ready('signed-out'));
          return;
        }
        const cached = readCompanionRoleCache();
        if (cached && cached.userId !== userId) {
          clearCompanionRoleCache();
          apply({ status: 'loading', mode: 'signed-out' });
        }
        void resolve(userId);
      });
      unsubscribe = () => subscription.unsubscribe();
    } catch {
      clearCompanionRoleCache();
      apply(ready('signed-out'));
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled]);

  return state;
}
