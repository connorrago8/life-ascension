'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {NAV_ITEMS} from '../../lib/nav';
type IconName='home'|'quests'|'play'|'character'|'more';
function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === 'home' && <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />}
      {name === 'quests' && (
        <>
          <path d="M7 4.5h8.2A2.8 2.8 0 0 1 18 7.3V19H8.5" />
          <path d="M7 4.5A2.5 2.5 0 0 0 4.5 7v11.2A2.3 2.3 0 0 1 6.8 20" />
          <path d="M9.2 9.2h5.2M9.2 12.4h5.2M9.2 15.6h3.2" />
        </>
      )}
      {name === 'play' && (
        <>
          <path d="M6.2 5.2 15.4 16.8" />
          <path d="M17.8 5.2 8.6 16.8" />
          <path d="M4.8 8.4 7.5 5.4" />
          <path d="M19.2 8.4 16.5 5.4" />
          <path d="M14.4 16.2 16.2 19.6" />
          <path d="M9.6 16.2 7.8 19.6" />
        </>
      )}
      {name === 'character' && (
        <>
          <circle cx="12" cy="8.4" r="3.1" />
          <path d="M5.6 19.4c1.1-2.8 3.4-4.2 6.4-4.2s5.3 1.4 6.4 4.2" />
        </>
      )}
      {name === 'more' && (
        <>
          <circle cx="6" cy="12" r="1.35" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.35" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}

export function AppNav(){
 const pathname=usePathname()||'/';
 const [previewQuery,setPreviewQuery]=useState('');
 useEffect(()=>{setPreviewQuery(new URLSearchParams(window.location.search).get('preview') === '1'?'?preview=1':'')},[pathname]);
 return <nav className="app-nav" aria-label="Primary"><Link href="/" className="nav-brand">LIFE ASCENSION</Link><div className="nav-links">{NAV_ITEMS.map(item=>{
 const current=item.href==='/'?pathname==='/':pathname===item.href||pathname.startsWith(item.href+'/');
 const play=item.id==='play';
 return <Link key={item.id} href={play ? `${item.href}${previewQuery}` : item.href} className={play?'nav-link nav-play':'nav-link'} aria-current={current?'page':undefined}><Icon name={item.id}/><span>{item.label}</span></Link>;
 })}</div></nav>;
}
