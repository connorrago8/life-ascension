'use client';

import { useState } from 'react';
import { CompanionWardrobe } from '../../../../components/companion/CompanionWardrobe';
import { cosmeticTitle } from '../../../../lib/levelTitles';
import { clearCompanionRoleCache } from '../../../../lib/companionAccess';
import { supabase } from '../../../../lib/supabase';
import { useCompanionBoard } from '../useCompanionBoard';

export default function CompanionCharacterPage() {
  const { ready, message } = useCompanionBoard();
  const [menu, setMenu] = useState(false);

  async function signOut() {
    clearCompanionRoleCache();
    try {
      await supabase().auth.signOut();
    } catch { /* The role cache is already clear. */ }
    window.location.assign('/');
  }

  if (!ready) return <main className="wrap companion-page"><p className="role-loading" role="status">Gathering your story…</p></main>;
  return (
    <main className="wrap companion-page">
      <header className="cq-char-head">
        <h1>Character</h1>
        <button className="btn ghost" type="button" aria-expanded={menu} onClick={() => setMenu((value) => !value)}>Menu</button>
      </header>
      {menu && (
        <div className="companion-card cq-menu" role="dialog" aria-label="Settings">
          <p className="muted">Name, title, and color stay as they are.</p>
          <button className="btn ghost" type="button" onClick={() => void signOut()}>Sign out</button>
        </div>
      )}
      <CompanionWardrobe />
      <p className="muted">Gear is cosmetic. Logged activities raise the level. Nothing here is for combat.</p>
      {message && <p className="message" role="status">{message}</p>}
    </main>
  );
}
