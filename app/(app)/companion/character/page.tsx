'use client';

import { useEffect, useState } from 'react';
import { CompanionWardrobe } from '../../../../components/companion/CompanionWardrobe';
import { clearCompanionRoleCache } from '../../../../lib/companionAccess';
import { COMPANION_COLORS, COMPANION_TITLES } from '../../../../lib/companion';
import { supabase } from '../../../../lib/supabase';
import { useCompanionBoard } from '../useCompanionBoard';

export default function CompanionCharacterPage() {
  const { board, ready, message, setMessage, reload } = useCompanionBoard();
  const [name, setName] = useState('');
  const [title, setTitle] = useState<string>(COMPANION_TITLES[0]);
  const [color, setColor] = useState<string>(COMPANION_COLORS[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!board?.identity) return;
    setName(board.identity.displayName);
    setTitle(board.identity.title);
    if (board.identity.questColor) setColor(board.identity.questColor);
  }, [board]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const { error } = await supabase().rpc('companion_set_identity', { p_name: name, p_title: title, p_color: color });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Saved.');
    await reload();
  }

  async function signOut() {
    clearCompanionRoleCache();
    try {
      await supabase().auth.signOut();
    } catch { /* The role cache is already clear. */ }
    window.location.assign('/');
  }

  if (!ready) return <main className="wrap companion-page"><p className="role-loading" role="status">Loading…</p></main>;
  return (
    <main className="wrap companion-page">
      <h1>Character</h1>
      <CompanionWardrobe />
      <form onSubmit={(event) => void save(event)}>
        <label htmlFor="companion-name">Display name</label>
        <input id="companion-name" className="field" maxLength={40} value={name} onChange={(event) => setName(event.target.value)} required />
        <label htmlFor="companion-title">Title</label>
        <select id="companion-title" className="field" value={title} onChange={(event) => setTitle(event.target.value)}>
          {COMPANION_TITLES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <label htmlFor="companion-color">Quest color</label>
        <select id="companion-color" className="field" value={color} onChange={(event) => setColor(event.target.value)}>
          {COMPANION_COLORS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button className="btn" type="submit" disabled={busy}>Save</button>
      </form>
      <button className="btn ghost" type="button" onClick={() => void signOut()}>Sign out</button>
      {message && <p className="message" role="status">{message}</p>}
    </main>
  );
}
