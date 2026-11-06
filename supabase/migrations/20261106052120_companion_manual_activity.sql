-- Private manual companion tracking. No writes to account quests or XP ledgers.
begin;
create table companion_private.activity_entries (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 pair_id uuid not null references public.companion_pairs(id),
 request_id uuid not null,
 title text not null check(length(btrim(title)) between 1 and 120),
 title_key text not null,
 activity_date date not null,
 created_at timestamptz not null default now(),
 unique(owner_id,request_id)
);
create index activity_owner_week on companion_private.activity_entries(owner_id,pair_id,activity_date);
create table companion_private.activity_corrections (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 entry_id uuid not null unique references companion_private.activity_entries(id),
 owner_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 reason text not null check(length(btrim(reason)) between 1 and 240),
 created_at timestamptz not null default now(),
 unique(owner_id,request_id)
);
alter table companion_private.activity_entries enable row level security;
alter table companion_private.activity_corrections enable row level security;
create policy activity_owner_read on companion_private.activity_entries for select to authenticated using(owner_id=(select auth.uid()));
create policy correction_owner_read on companion_private.activity_corrections for select to authenticated using(owner_id=(select auth.uid()));
revoke all on companion_private.activity_entries,companion_private.activity_corrections from public,anon,authenticated;
-- Tables stay non-client-readable; only explicit owner-scoped RPC projections are exposed.
create function companion_private.activity_command(p_action text,p_payload jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); p public.companion_pairs%rowtype; e companion_private.activity_entries%rowtype;
 c companion_private.activity_corrections%rowtype; pair uuid; request uuid;
 title text; key text; reason text; day date; week date; today date:=(now() at time zone 'America/Chicago')::date;
begin
 if u is null then raise exception 'Sign-in required'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid journal request'; end if;
 pair:=(p_payload->>'pairId')::uuid;
 select * into p from public.companion_pairs where id=pair and
  ((inviter_id=u and inviter_role='recipient') or (member_id=u and inviter_role='sender')) for update;
 if not found then raise exception 'Journal unavailable'; end if;
 if p_payload ? 'date' and coalesce(p_payload->>'date','')<>'' and (p_payload->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid journal request'; end if;
 if p_action='week' then
  day:=coalesce(nullif(p_payload->>'date','')::date,today);
  week:=day-(extract(isodow from day)::integer-1);
  return jsonb_build_object('viewerId',u,'pairId',pair,'weekStart',week,'weekEnd',week+6,'today',today,
   'canLog',p.status='active','provenance','Manual record by you; not synced to either account XP ledger',
   'weeklyXp',(select count(*) from companion_private.activity_entries a where a.owner_id=u and a.pair_id=pair
    and a.activity_date>=week and a.activity_date<week+7 and not exists(select 1 from companion_private.activity_corrections x where x.entry_id=a.id)),
   'entries',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'date',a.activity_date,
     'recordedAt',a.created_at,'recordedBy',u,'manualXp',1,'corrected',x.id is not null,'correctionReason',x.reason,'correctedAt',x.created_at)
     order by a.activity_date desc,a.created_at desc,a.id) from companion_private.activity_entries a
     left join companion_private.activity_corrections x on x.entry_id=a.id
     where a.owner_id=u and a.pair_id=pair and a.activity_date>=week and a.activity_date<week+7),'[]'::jsonb));
 elsif p_action='log' then
  if p.status<>'active' then raise exception 'Active companionship required to log'; end if;
  request:=(p_payload->>'requestId')::uuid;
  title:=btrim(p_payload->>'title'); day:=(p_payload->>'date')::date;
  if request is null or title is null or length(title) not between 1 and 120 or day is null or day>today then raise exception 'Choose a completed activity and a past or current Chicago date'; end if;
  key:=btrim(lower(regexp_replace(title,'\s+',' ','g')));
  if key='' then raise exception 'Choose a completed activity and a past or current Chicago date'; end if;
  -- Serialize owner requests, including retries across distinct companion profiles.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text||':manual-journal',0));
  select * into e from companion_private.activity_entries where owner_id=u and request_id=request;
  if found then
   if e.pair_id<>pair or e.title<>title or e.activity_date<>day then raise exception 'Refresh before changing a saved activity'; end if;
   return jsonb_build_object('entryId',e.id,'saved',true);
  end if;
  if exists(select 1 from companion_private.activity_entries a where a.owner_id=u and a.pair_id=pair and a.activity_date=day and a.title_key=key
    and not exists(select 1 from companion_private.activity_corrections x where x.entry_id=a.id)) then raise exception 'This activity is already logged for that day'; end if;
  insert into companion_private.activity_entries(owner_id,pair_id,request_id,title,title_key,activity_date)
   values(u,pair,request,title,key,day) returning * into e;
  return jsonb_build_object('entryId',e.id,'saved',true);
 elsif p_action='correct' then
  request:=(p_payload->>'requestId')::uuid; reason:=btrim(p_payload->>'reason');
  if request is null or reason is null or length(reason) not between 1 and 240 then raise exception 'Add a short correction reason'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text||':manual-journal',0));
  select * into e from companion_private.activity_entries where id=(p_payload->>'entryId')::uuid and owner_id=u and pair_id=pair for update;
  if not found then raise exception 'Journal entry unavailable'; end if;
  select * into c from companion_private.activity_corrections where owner_id=u and request_id=request;
  if found then
   if c.entry_id<>e.id or c.reason<>reason then raise exception 'Refresh before changing a saved correction'; end if;
   return jsonb_build_object('corrected',true);
  end if;
  if exists(select 1 from companion_private.activity_corrections where entry_id=e.id) then raise exception 'This entry already has a correction'; end if;
  insert into companion_private.activity_corrections(entry_id,owner_id,request_id,reason) values(e.id,u,request,reason);
  return jsonb_build_object('corrected',true);
 end if;
 raise exception 'Invalid journal request';
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range or unique_violation or check_violation then
 raise exception 'Invalid journal request';
end $$;
revoke all on function companion_private.activity_command(text,jsonb) from public,anon;
grant execute on function companion_private.activity_command(text,jsonb) to authenticated;
create function public.companion_activity(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
 language sql security invoker set search_path='' as $$ select companion_private.activity_command(p_action,p_payload); $$;
revoke all on function public.companion_activity(text,jsonb) from public,anon;
grant execute on function public.companion_activity(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
