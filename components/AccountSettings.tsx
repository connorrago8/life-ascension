'use client';
import Link from 'next/link';
import {supabase} from '../lib/supabase';
import {clearCompanionRoleCache} from '../lib/companionAccess';
export function AccountSettings(){
 async function signOut(){clearCompanionRoleCache();const {error}=await supabase().auth.signOut();if(!error)window.location.assign('/')}
 return <details className="workspace-disclosure account-settings"><summary>Account settings</summary><div className="account-settings-links"><Link href="/settings/password">Set or change password</Link><Link href="/settings/api-keys">API keys</Link><Link href="/companion">Partner connection</Link><button className="btn ghost" onClick={()=>void signOut()}>Sign out</button></div></details>;
}
