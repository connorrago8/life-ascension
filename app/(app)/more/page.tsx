'use client';

import Link from 'next/link';
import { clearCompanionRoleCache } from '../../../lib/companionAccess';
import { supabase } from '../../../lib/supabase';
import { useCompanionRole } from '../../../components/useCompanionRole';
import { StreakShieldNote } from '../../../components/couple/StreakShieldNote';

const LINKS = [
  { href: '/more/relationship', label: 'Relationship & invitations', note: 'Bond, invites, and partner settings' },
  { href: '/more/history', label: 'Activity history', note: 'Your logged activities' },
  { href: '/more/rewards', label: 'Reward notes', note: 'A personal note. Nothing here is redeemed.' },
  { href: '/quests/manage', label: 'Manage quests', note: 'Edit and archive your own quests' },
  { href: '/quests/journal', label: 'Quest notes', note: 'Notes on your completions' },
  { href: '/settings/api-keys', label: 'API keys', note: 'Private keys for your account' },
  { href: '/settings/wellness', label: 'Wellness', note: 'Readings stay on your account' },
] as const;

export default function MorePage() {
  const role = useCompanionRole();
  async function signOut() {
    clearCompanionRoleCache();
    try { await supabase().auth.signOut(); } catch { /* Cache is already clear. */ }
    window.location.assign('/');
  }
  return (
    <main className="wrap more-page">
      <p className="eyebrow">SETTINGS</p>
      <h1>More</h1>
      <nav className="more-list" aria-label="Settings">
        {LINKS.map((item) => (
          <Link key={item.href} href={item.href}>
            <strong>{item.label}</strong>
            <small>{item.note}</small>
          </Link>
        ))}
        {role.mode !== 'companion' && (
          <Link href="/play"><strong>Play</strong><small>Connor&apos;s adventure</small></Link>
        )}
      </nav>
      <section aria-label="Streak shield">
        <h2>Streak shield</h2>
        <StreakShieldNote />
      </section>
      <button className="btn ghost" type="button" onClick={() => { void signOut(); }}>Sign out</button>
    </main>
  );
}
