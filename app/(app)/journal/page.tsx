'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { groupJournal, type JournalOccurrence } from '../../../lib/questBoard';

const PAGE_SIZE = 50;
export default function CompletedJournal() {
  const [rows, setRows] = useState<JournalOccurrence[]>([]);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [signedOut, setSignedOut] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setRows([]); setBusy(true); setError(''); setHasMore(false);
    const load = async () => {
      try {
        const client = supabase();
        const auth = await client.auth.getUser();
        if (current !== generation.current) return;
        if (auth.error) throw auth.error;
        if (!auth.data.user) { setSignedOut(true); return; }
        setSignedOut(false);
        const owner = auth.data.user.id;
        const result = await client.from('quest_instances').select('id,quest_id,completed_at')
          .eq('owner_id', owner).eq('status', 'completed')
          .order('completed_at', { ascending: false }).order('id', { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        if (result.error) throw result.error;
        const instances = (result.data ?? []).slice(0, PAGE_SIZE);
        let entries: JournalOccurrence[] = [];
        if (instances.length) {
          const [quests, ledger] = await Promise.all([
            client.from('quests').select('id,title').eq('owner_id', owner).in('id', [...new Set(instances.map(i => i.quest_id))]),
            client.from('xp_ledger').select('instance_id,amount').eq('owner_id', owner).in('instance_id', instances.map(i => i.id)),
          ]);
          if (quests.error || ledger.error) throw quests.error ?? ledger.error;
          entries = instances.map(i => ({ id: i.id, completed_at: i.completed_at,
            title: quests.data?.find(q => q.id === i.quest_id)?.title ?? 'Completed quest',
            xp: ledger.data?.find(l => l.instance_id === i.id)?.amount ?? null,
          }));
        }
        if (current !== generation.current) return;
        setRows(entries); setHasMore((result.data?.length ?? 0) > PAGE_SIZE);
      } catch { if (current === generation.current) setError('Couldn’t load your completed quests.'); }
      finally { if (current === generation.current) setBusy(false); }
    };
    void load();
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = supabase().auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          ++generation.current; setRows([]); setPage(0); setRetry(n => n + 1);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch { /* load reports configuration failures */ }
    return () => { ++generation.current; unsubscribe?.(); };
  }, [page, retry]);
  return <main className="wrap"><header className="top"><div><div className="eyebrow">LIFE ASCENSION</div>
    <h1>Completed Journal</h1><p className="muted">Your accomplishments, grouped by completion date in Chicago time.</p></div>
    <a className="btn ghost" href="/">Quest Board</a></header>
    {busy ? <p role="status">Loading your accomplishments…</p> : error ?
      <section className="panel"><p role="alert">{error}</p><button className="btn" onClick={() => setRetry(n => n + 1)}>Retry</button></section> :
      signedOut ? <a className="btn" href="/login?next=%2Fjournal">Sign in to view your Journal</a> : <>
        {rows.length === 0 && <p>No completed quests on this page.</p>}
        {groupJournal(rows).map(group => <section className="panel" key={group.day}><h2>{group.day}</h2>
          {group.entries.map(entry => <article className="quest" key={entry.id}><div className="quest-main">
            <h3 className="quest-title">{entry.title}</h3><p className="muted">Completed · {entry.xp === null ? 'Reward not verified' : `+${entry.xp} XP verified`}</p>
          </div></article>)}</section>)}
        <nav className="actions" aria-label="Journal pages"><button className="btn ghost" disabled={page === 0} onClick={() => setPage(n => n - 1)}>Newer</button>
          <span aria-live="polite">Page {page + 1}</span><button className="btn ghost" disabled={!hasMore} onClick={() => setPage(n => n + 1)}>Older</button></nav>
      </>}
  </main>;
}
