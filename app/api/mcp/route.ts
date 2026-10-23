import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
const domains = ['hygiene','home','mental_health','personal_growth','finance','career','relationships','physical_health'];
const tools = [
 {name:'create_quest',description:'Create a quest for a planned future action. Never use this to mark something completed.',inputSchema:{type:'object',properties:{title:{type:'string'},domain:{type:'string',enum:domains},cadence:{type:'string',enum:['once','daily']},due_date:{type:'string',description:'Optional ISO date YYYY-MM-DD'}},required:['title','domain','cadence']}},
 {name:'update_progress',description:'Record a task in progress; does not award XP.',inputSchema:{type:'object',properties:{quest_id:{type:'string'},note:{type:'string'}},required:['quest_id','note']}},
 {name:'submit_completion',description:'Submit an explicit completed-action report. Server validates and awards XP at most once.',inputSchema:{type:'object',properties:{quest_id:{type:'string'},due_date:{type:'string',description:'Optional ISO date YYYY-MM-DD; defaults to today'},confirmed_complete:{type:'boolean',description:'Explicit affirmative completion assertion; do not set for partial, negated or planned actions'}},required:['quest_id','confirmed_complete']}},
 {name:'list_quests',description:'Read the current user\'s quests and instances.',inputSchema:{type:'object',properties:{due_date:{type:'string',description:'Optional ISO date; defaults to today'},include_history:{type:'boolean',description:'Set true to include historical instances'}}}},
 {name:'get_character_progress',description:'Read lifetime XP and completed quest count.',inputSchema:{type:'object',properties:{}}}
];
const fail=(id:unknown,code:number,message:string)=>NextResponse.json({jsonrpc:'2.0',id,error:{code,message}});
export async function GET(){return NextResponse.json({status:'authentication_required'}, {status:401});}
export async function POST(req:NextRequest){
 const auth=req.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer '))return NextResponse.json({error:'Bearer token required'}, {status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return NextResponse.json({error:'Server not configured'}, {status:503});
 const db=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:identityError}=await db.auth.getUser(auth.slice(7));
 if(identityError||!user)return NextResponse.json({error:'Invalid or expired user token'}, {status:401});
 let body: {jsonrpc?:string;id?:unknown;method?:string;params?:{name?:string;arguments?:Record<string,unknown>}};
 try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON'}, {status:400})}
 const id=body.id??null;
 if(body.method==='initialize')return NextResponse.json({jsonrpc:'2.0',id,result:{protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'life-ascension',version:'0.1.0'}}});
 if(body.method==='notifications/initialized')return new Response(null,{status:202});
 if(body.method==='tools/list')return NextResponse.json({jsonrpc:'2.0',id,result:{tools}});
 if(body.method!=='tools/call')return fail(id,-32601,'Method not found');
 const name=body.params?.name,args=body.params?.arguments||{};
 const bad=(msg:string)=>fail(id,-32602,msg);
 const iso=(v:unknown)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;};
 const today=new Date().toISOString().slice(0,10);
 let result:unknown;
 if(name==='create_quest'){
  const title=typeof args.title==='string'?args.title.trim():'';
  if(!title||title.length>120||!domains.includes(String(args.domain))||!['once','daily'].includes(String(args.cadence)))return bad('Invalid quest fields');
  if(args.due_date!==undefined&&!iso(args.due_date))return bad('Invalid due date');
  const proposedDate=String(args.due_date||today);
  const proposedOffset=Math.round((Date.parse(proposedDate+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
  if(proposedOffset>1||proposedOffset< -30)return bad('Scheduling beyond tomorrow is not yet supported. No quest was created.');
  const r=await db.from('quests').insert({owner_id:user.id,title,domain:args.domain,cadence:args.cadence}).select('id,title,domain,cadence').single();
  if(r.error)return fail(id,-32000,r.error.message);
  const date=args.due_date||today;
  const ensured=await db.rpc('ensure_quest_instance',{p_quest_id:r.data.id,p_date:date});
  if(ensured.error)return fail(id,-32000,'Quest created, but instance scheduling failed: '+ensured.error.message);
  result={...r.data,instance_id:ensured.data,due_date:date};
 }else if(name==='update_progress'){
  if(typeof args.quest_id!=='string'||typeof args.note!=='string'||!args.note.trim()||args.note.length>500)return bad('Quest ID and short progress note required');
  const q=await db.from('quests').select('id').eq('id',args.quest_id).eq('owner_id',user.id).single();
  if(q.error)return bad('Quest not found');
  // No schema for partial progress yet. Do not misrepresent a note as persisted.
  return fail(id,-32001,'Progress notes require a migration before they can be saved');
 }else if(name==='submit_completion'){
  if(typeof args.quest_id!=='string'||args.confirmed_complete!==true)return bad('Quest ID and explicit confirmed_complete=true required');
  const date=args.due_date||today;
  if(!iso(date))return bad('Invalid due date');
  const offset=Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
  if(offset>1||offset< -30)return bad('Completion date is outside allowed instance window');
  const quest=await db.from('quests').select('id').eq('id',args.quest_id).eq('owner_id',user.id).eq('active',true).single();
  if(quest.error)return bad('Quest not found');
  const ensured=await db.rpc('ensure_quest_instance',{p_quest_id:args.quest_id,p_date:date});
  if(ensured.error)return fail(id,-32000,ensured.error.message);
  const r=await db.rpc('set_quest_instance_status',{p_instance_id:ensured.data,p_action:'complete'});
  if(r.error)return fail(id,-32000,r.error.message);
  result={quest_id:args.quest_id,instance_id:ensured.data,recorded:r.data==='completed',server_result:r.data};
 }else if(name==='list_quests'){
  const date=args.due_date||today;
  if(!iso(date))return bad('Invalid due date');
  let instancesQuery=db.from('quest_instances').select('id,quest_id,due_date,status').eq('owner_id',user.id);
  if(args.include_history!==true)instancesQuery=instancesQuery.eq('due_date',date);
  const [q,i]=await Promise.all([db.from('quests').select('id,title,domain,cadence,active').eq('owner_id',user.id),instancesQuery.limit(500)]);
  if(q.error||i.error)return fail(id,-32000,q.error?.message||i.error?.message||'Query failed');
  result={quests:q.data,instances:i.data};
 }else if(name==='get_character_progress'){
  const [l,i]=await Promise.all([db.from('xp_ledger').select('amount').eq('owner_id',user.id),db.from('quest_instances').select('id').eq('owner_id',user.id).eq('status','completed')]);
  if(l.error||i.error)return fail(id,-32000,l.error?.message||i.error?.message||'Query failed');
  result={lifetime_xp:(l.data||[]).reduce((sum,row)=>sum+row.amount,0),completed_instances:i.data?.length||0};
 }else return bad('Unknown tool');
 return NextResponse.json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(result)}]}});
}
