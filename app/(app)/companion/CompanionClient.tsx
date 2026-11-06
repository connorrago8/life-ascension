'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { companionError, type CompanionDashboard } from '../../../lib/companion/types';
import styles from './Companion.module.css';

export default function CompanionClient() {
  const client = useMemo(() => process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? supabase() : null, []);
  const [dashboard, setDashboard] = useState<CompanionDashboard | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false), generation = useRef(0), sendRequest = useRef('');
  const [message, setMessage] = useState(''), [error, setError] = useState(false);
  const [role, setRole] = useState('recipient'), [code, setCode] = useState(''), [createdCode, setCreatedCode] = useState('');
  const [preview, setPreview] = useState<{ name: string; yourRole: string } | null>(null);
  const [pairId, setPairId] = useState(''), [confirmRevoke, setConfirmRevoke] = useState('');
  const [title, setTitle] = useState(''), [category, setCategory] = useState('relationships');
  const [difficulty, setDifficulty] = useState(''), [dueDate, setDueDate] = useState(''), [reward, setReward] = useState(''), [mystery, setMystery] = useState(false);
  const [overlaps, setOverlaps] = useState<Record<string, string>>({}), [rainDates, setRainDates] = useState<Record<string, string>>({});

  const clearPrivateState = useCallback(() => {
    setDashboard(null); setCreatedCode(''); setPreview(null); setCode(''); setMessage(''); setError(false);
    setTitle(''); setReward(''); setDifficulty(''); setDueDate(''); setMystery(false); setCategory('relationships');
    setPairId(''); setConfirmRevoke(''); setOverlaps({}); setRainDates({}); sendRequest.current = '';
  }, []);
  const currentAccount = useRef<string | null>(null);
  const load = useCallback(async (): Promise<boolean> => {
    const mine = ++generation.current;
    setLoading(true);
    try {
      if (!client) { setSignedIn(false); clearPrivateState(); return false; }
      const auth = await client.auth.getUser();
      if (mine !== generation.current) return false;
      setSignedIn(!!auth.data.user && !auth.error);
      if (auth.error || !auth.data.user) { currentAccount.current = null; clearPrivateState(); return false; }
      if (currentAccount.current && currentAccount.current !== auth.data.user.id) clearPrivateState();
      currentAccount.current = auth.data.user.id;
      const result = await client.rpc('companion_command', { p_action: 'dashboard', p_payload: {} });
      if (mine !== generation.current) return false;
      if (result.error) { setError(true); setMessage(companionError(result.error.code, result.error.message)); setDashboard(null); return false; }
      setDashboard(result.data as CompanionDashboard);
      return true;
    } catch {
      if (mine === generation.current) { setError(true); setMessage(companionError()); setDashboard(null); }
      return false;
    } finally { if (mine === generation.current) setLoading(false); }
  }, [client, clearPrivateState]);
  useEffect(() => {
    void load();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = client?.auth.onAuthStateChange(event => {
      if (event !== 'SIGNED_OUT' && event !== 'SIGNED_IN') return;
      ++generation.current; currentAccount.current = null; clearPrivateState();
      setSignedIn(false);
      if (event === 'SIGNED_IN') timer = setTimeout(() => { void load(); }, 0);
      else setLoading(false);
    }).data.subscription;
    return () => { ++generation.current; clearTimeout(timer); subscription?.unsubscribe(); };
  }, [client, load, clearPrivateState]);

  async function command(action: string, payload: Record<string, unknown>, success: string, onSuccess?: (result: Record<string, unknown>) => void): Promise<boolean> {
    if (!client || busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError(false); setMessage('Saving…');
    const mine = generation.current;
    try {
      const result = await client.rpc('companion_command', { p_action: action, p_payload: payload });
      if (mine !== generation.current) return false;
      if (result.error) { setError(true); setMessage(companionError(result.error.code, result.error.message)); return false; }
      setMessage(success);
      if (action !== 'preview-invite') {
        const refreshGeneration = generation.current + 1;
        if (!await load() || generation.current !== refreshGeneration) return false;
      }
      onSuccess?.(result.data as Record<string, unknown>);
      return true;
    } catch {
      if (mine === generation.current) { setError(true); setMessage(companionError()); }
      return false;
    } finally { busyRef.current = false; setBusy(false); }
  }
  const senders = dashboard?.pairs.filter(p => p.status === 'active' && p.yourRole === 'sender') ?? [];
  const selectedPair = senders.some(p => p.id === pairId) ? pairId : senders[0]?.id ?? '';
  const disabled = busy || loading;
  return <main className={styles.root} aria-busy={disabled}>
    <a className={styles.back} href="/">← Back to Home</a>
    <header><p className={styles.eyebrow}>LIFE ASCENSION · PRIVATE COMPANION</p><h1>Quests from someone you love</h1>
      <p>Two accounts, with consent. Your XP stays yours. Companion quests earn <strong>2 XP total</strong> when completed in real life.</p></header>
    {message && <p className={error ? styles.error : styles.notice} role={error ? 'alert' : 'status'} aria-atomic="true">{message}</p>}
    {loading && <p role="status">Loading your private companion space…</p>}
    {!loading && !signedIn && <section className={styles.panel}><h2>Sign in with your own account</h2>
      <p>{client ? 'Use your account, never your companion’s credentials.' : 'Account connection is not configured for this build.'}</p>
      <a className="btn" href="/login?next=%2Fcompanion">Sign in</a></section>}
    {signedIn && <button className="btn ghost" disabled={disabled} onClick={() => { setMessage(''); setError(false); void load(); }}>Refresh shared status</button>}
    {dashboard && <>
      <p className={styles.account}>Your account: <span>{dashboard.viewerId}</span> · Your lifetime XP: <strong>{dashboard.personalXp}</strong></p>
      <section className={styles.panel} aria-labelledby="companion-connect"><h2 id="companion-connect">Connect privately</h2>
        <p>Share a code privately. Joining requests a connection; the inviter must confirm the other account before any quests are shared.</p>
        <form onSubmit={async event => { event.preventDefault(); await command('invite', { role }, 'Invitation created. Share the code only with your intended companion.', result => setCreatedCode(String(result.inviteCode))); }}>
          <fieldset disabled={disabled}><legend>My role in this companionship</legend>
            <label><input type="radio" name="companion-role" value="recipient" checked={role === 'recipient'} onChange={() => setRole('recipient')} /> I receive quests (Connor)</label>
            <label><input type="radio" name="companion-role" value="sender" checked={role === 'sender'} onChange={() => setRole('sender')} /> I send quests (Izzy)</label>
            <button className="btn" type="submit">Create private invitation</button></fieldset>
        </form>
        {createdCode && <div className={styles.code}><label>Invitation code · expires in 7 days<textarea readOnly value={createdCode} rows={3} onFocus={event => event.currentTarget.select()} /></label><p>Select and copy this code. It is shown only in this session.</p></div>}
        <form onSubmit={async event => { event.preventDefault(); await command('preview-invite', { code }, 'Review the role before requesting to join.', result => setPreview({ name: String(result.name), yourRole: String(result.yourRole) })); }}>
          <label>Have a companion’s code?<input autoComplete="off" value={code} maxLength={64} disabled={disabled} onChange={event => { setCode(event.target.value); setPreview(null); }} /></label>
          <button className="btn ghost" disabled={disabled || code.trim().length !== 64}>Review invitation</button>
        </form>
        {preview && <div className={styles.review}><p><strong>{preview.name}</strong> invites you to {preview.yourRole === 'sender' ? 'send them' : 'receive their'} quests. Only shared quest status is visible; private records and XP remain separate.</p>
          <button className="btn" disabled={disabled} onClick={async () => { await command('join', { code }, 'Connection requested. Ask your companion to confirm your account.', () => { setPreview(null); setCode(''); }); }}>I consent · request to join</button></div>}
        {dashboard.pairs.map(pair => <article className={styles.pair} key={pair.id}><h3>{pair.name} · {pair.status}</h3>
          <p>Your role: {pair.yourRole === 'sender' ? 'send quests' : 'receive quests'}</p>
          {pair.otherUserId && <p>Companion account: <span className={styles.id}>{pair.otherUserId}</span></p>}
          {pair.status === 'requested' && (pair.canConfirm ? <><p>Verify this account ID with your companion privately before confirming.</p><button className="btn" disabled={disabled} onClick={() => { void command('confirm', { pairId: pair.id }, 'Private companionship confirmed.'); }}>Confirm this companion account</button></> : <p>Waiting for the inviter to confirm your account.</p>)}
          {pair.status !== 'revoked' && (confirmRevoke === pair.id ? <div className={styles.review}><p>End shared access? Earned XP and your own accepted tasks stay yours.</p><div className={styles.actions}><button className="btn ghost" disabled={disabled} onClick={async () => { await command('revoke', { pairId: pair.id }, 'Shared access revoked. Earned XP was retained.', () => setConfirmRevoke('')); }}>Confirm revocation</button><button className="btn ghost" disabled={disabled} onClick={() => setConfirmRevoke('')}>Keep connection</button></div></div> : <button className="btn ghost" disabled={disabled} onClick={() => setConfirmRevoke(pair.id)}>Revoke shared access</button>)}
        </article>)}
      </section>
      {!!senders.length && <section className={styles.panel}><h2>Send a real-life quest</h2>
        <p>A voluntary invitation, not an obligation. Difficulty never changes the 2-XP total.</p>
        <form onSubmit={async event => { event.preventDefault(); sendRequest.current ||= crypto.randomUUID(); await command('send', { pairId: selectedPair, requestId: sendRequest.current, title, category, difficulty, dueDate, reward, mystery }, 'Quest delivered to the private inbox.', () => { sendRequest.current = ''; setTitle(''); setReward(''); setMystery(false); }); }}>
          <fieldset disabled={disabled}><legend>Quest details</legend>
            <label>Companion<select value={selectedPair} onChange={event => setPairId(event.target.value)}>{senders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label>What would you like them to do?<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></label>
            <label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{['relationships','hygiene','home','mental_health','personal_growth','finance','career','physical_health'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
            <label>Difficulty · optional<input maxLength={40} value={difficulty} onChange={event => setDifficulty(event.target.value)} /></label>
            <label>Due date · optional<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label>
            <label>Real-world reward promise · optional<textarea maxLength={1000} value={reward} onChange={event => setReward(event.target.value)} /></label>
            <label><input type="checkbox" checked={mystery} onChange={event => setMystery(event.target.checked)} /> Mystery reward: show ??? until acceptance</label>
            <p>Rewards are voluntary promises, not payments or guaranteed fulfillment.</p>
            <button className="btn" disabled={!title.trim() || (mystery && !reward.trim())}>Send to private inbox</button>
            <button className="btn ghost" type="button" onClick={() => { sendRequest.current = ''; setTitle(''); setReward(''); setMystery(false); }}>Start a new draft</button>
          </fieldset>
        </form>
        <p className={styles.muted}>If a send times out, refresh your outbox before starting another draft.</p>
      </section>}
      {(['incoming','outgoing'] as const).map(side => <section className={styles.panel} key={side}><h2>{side === 'incoming' ? 'Your quest inbox' : 'Your sent quests'}</h2>
        {!dashboard.quests.some(q => q.incoming === (side === 'incoming')) && <p>No quests here yet. There is nothing you need to catch up on.</p>}
        {dashboard.quests.filter(q => q.incoming === (side === 'incoming')).map(q => <article className={styles.offer} key={q.id}>
          <h3>{q.title}</h3><p><strong>{q.status}</strong> · {q.category.replaceAll('_', ' ')}{q.difficulty ? ` · ${q.difficulty}` : ''}{q.dueDate ? ` · Due ${q.dueDate}` : ''}</p>
          {q.hasReward && <div className={styles.reward}><h4>Reward promise</h4><p>{q.reward ?? '??? — revealed only after you accept'}</p></div>}
          {q.incoming && q.status === 'pending' && <><label>Is this the same real-life task as one on your board?<select disabled={disabled} value={overlaps[q.id] ?? ''} onChange={event => setOverlaps({ ...overlaps, [q.id]: event.target.value })}>
            <option value="">Match by title, or create a new task</option>{dashboard.overlaps.map(o => <option key={o.id} value={o.id}>{o.title}{o.completed ? ' · already completed, upgrade to 2 total' : ''}</option>)}</select></label>
            <div className={styles.actions}><button className="btn" disabled={disabled} onClick={() => { void command('accept', { questId: q.id, instanceId: overlaps[q.id] ?? '' }, 'Quest accepted. Matching task credit is capped at 2 XP total.'); }}>{q.mystery ? 'Accept + reveal reward' : 'Accept quest'}</button>
              <button className="btn ghost" disabled={disabled} onClick={() => { void command('decline', { questId: q.id }, 'Quest declined. No XP was changed.'); }}>Decline</button></div></>}
          {q.incoming && ['accepted','rain-check'].includes(q.status) && <><button className="btn" disabled={disabled} onClick={() => { void command('complete', { questId: q.id }, 'Real-life completion saved. This task is worth 2 XP total.'); }}>I completed this in real life · 2 XP total</button>
            <label>Rain check until<input disabled={disabled} type="date" value={rainDates[q.id] ?? ''} onChange={event => setRainDates({ ...rainDates, [q.id]: event.target.value })} /></label>
            <button className="btn ghost" disabled={disabled || !rainDates[q.id]} onClick={() => { void command('rain-check', { questId: q.id, until: rainDates[q.id] }, 'Rain check saved. No XP penalty.'); }}>Save rain check</button>{q.rainCheckUntil && <p>Rain check: {q.rainCheckUntil} · no penalty</p>}</>}
          {q.status === 'completed' && <p>Completed · 2 XP total for this task, retained across reloads.</p>}
        </article>)}
      </section>)}
    </>}
  </main>;
}
