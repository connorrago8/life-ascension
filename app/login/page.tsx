'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '../../lib/supabase';

function returnPath(){
 const next=new URLSearchParams(window.location.search).get('next');
 if(!next||/[\x00-\x1f\x7f]/.test(next)||!next.startsWith('/')||next.startsWith('//')||next.includes('\\'))return '/';
 try{
  const u=new URL(next,window.location.origin);
  return u.origin===window.location.origin?u.pathname+u.search+u.hash:'/';
 }catch{return '/'}
}
export default function Login(){
 const router=useRouter();
 const [email,setEmail]=useState('');
 const [code,setCode]=useState('');
 const [sent,setSent]=useState(false);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  void supabase().auth.getUser().then(({data:{user}})=>{if(active&&user)router.replace(returnPath())});
  const {data:{subscription}}=supabase().auth.onAuthStateChange((_event,session)=>{if(active&&session?.user)router.replace(returnPath())});
  return ()=>{active=false;subscription.unsubscribe()};
 },[router]);
 async function requestCode(e:React.FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setMessage('');
  const {error}=await supabase().auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:window.location.origin+'/auth/callback?next='+encodeURIComponent(returnPath())}});
  if(error)setMessage('Unable to send a code right now. Check your email address or try again later.');else{setSent(true);setMessage('Enter the 6-digit code sent to your email.')}
  setBusy(false);
 }
 async function verify(e:React.FormEvent){
  e.preventDefault();if(busy||!/^\d{6}$/.test(code))return;setBusy(true);setMessage('');
  const {error}=await supabase().auth.verifyOtp({email:email.trim(),token:code,type:'email'});
  if(error)setMessage('That code is invalid or expired. Request a new code and try again.');else router.replace(returnPath());
  setBusy(false);
 }
 return <main className="wrap"><div className="eyebrow">LIFE ASCENSION</div><h1>Sign in to your adventure</h1>
 {!sent?<form className="panel" onSubmit={requestCode}><label htmlFor="email">Email</label><input id="email" className="field" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><button className="btn" disabled={busy}>{busy?'Sending…':'Email me a 6-digit code'}</button><p role="status">{message}</p></form>
 :<form className="panel" onSubmit={verify}><p className="muted">Code sent to {email}</p><label htmlFor="otp">6-digit sign-in code</label><input id="otp" className="field" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}/><button className="btn" disabled={busy||code.length!==6}>{busy?'Checking…':'Verify code and sign in'}</button><button className="btn ghost" type="button" disabled={busy} onClick={()=>{setSent(false);setCode('');setMessage('')}}>Use a different email / resend code</button><p role="status">{message}</p></form>}
 </main>;
}
