'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CompanionView } from './CompanionHome';
import { supabase } from '../../../lib/supabase';

export function useCompanionBoard() {
  const [board, setBoard] = useState<CompanionView | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');

  const reload = useCallback(async () => {
    try {
      const client = supabase();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) {
        setBoard(null);
        setReady(true);
        return;
      }
      const { data, error } = await client.rpc('companion_state');
      if (error) {
        setMessage("Couldn't load this right now. Your progress hasn't been changed.");
        setReady(true);
        return;
      }
      setBoard(data as CompanionView);
      setReady(true);
    } catch {
      setMessage("Couldn't load this right now. Your progress hasn't been changed.");
      setReady(true);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  return { board, ready, message, setMessage, reload };
}
