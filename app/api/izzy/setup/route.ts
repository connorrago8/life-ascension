import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
 const body=await request.json().catch(()=>null);
 if(body?.confirmedConsent!==true)
  return NextResponse.json({error:'Consent confirmation required'},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!anon||!secret)
  return NextResponse.json({error:'Unavailable'},{status:503});
 const jar=await cookies();
 const client=createServerClient(url,anon,{cookies:{getAll:()=>jar.getAll(),setAll:()=>{}}});
 const {data,error}=await client.auth.getUser();
 if(error||!data.user) return NextResponse.json({error:'Unauthorized'},{status:401});
 const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:companionId,error:registrationError}=await admin.rpc('register_consented_izzy_companion',{p_owner_id:data.user.id});
 if(registrationError) return NextResponse.json({error:'Companion setup unavailable'},{status:409});
 const {data:proposalCount,error:linkError}=await admin.rpc('link_verified_izzy_weekly_submission',{p_owner_id:data.user.id});
 if(linkError) return NextResponse.json({error:'Companion registered; submission link unavailable',companionId},{status:409});
 return NextResponse.json({companionId,proposalCount},{headers:{'Cache-Control':'private, no-store'}});
}
