-- Draft, additive companion slice. Apply only to an explicitly isolated reviewed environment.
begin;
create schema if not exists companion_private;
revoke all on schema companion_private from public, anon, authenticated;
grant usage on schema companion_private to authenticated;

create table public.companion_pairs (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 inviter_id uuid not null references auth.users(id) on delete cascade,
 member_id uuid references auth.users(id) on delete cascade,
 inviter_role text not null check(inviter_role in ('sender','recipient')),
 status text not null default 'pending' check(status in ('pending','requested','active','revoked')),
 created_at timestamptz not null default now(),
 check(member_id is null or member_id <> inviter_id),
 check(status not in ('requested','active') or member_id is not null)
);
create table companion_private.invitations (
 pair_id uuid primary key references public.companion_pairs(id) on delete cascade,
 code_hash text not null unique,
 expires_at timestamptz not null
);
create table public.companion_quests (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 pair_id uuid not null references public.companion_pairs(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 title text not null check(length(btrim(title)) between 1 and 120),
 category text not null check(category in ('hygiene','home','mental_health','personal_growth','finance','career','relationships','physical_health')),
 difficulty text check(length(difficulty) <= 40),
 due_date date,
 has_reward boolean not null default false,
 mystery boolean not null default false,
 status text not null default 'pending' check(status in ('pending','accepted','declined','rain-check','completed')),
 accepted_at timestamptz,
 rain_check_until date,
 instance_id uuid unique,
 created_at timestamptz not null default now(),
 unique(sender_id,request_id),
 foreign key(instance_id,recipient_id) references public.quest_instances(id,owner_id),
 check(sender_id <> recipient_id),
 check(not mystery or has_reward),
 check((status in ('pending','declined') and accepted_at is null and instance_id is null)
    or (status in ('accepted','rain-check','completed') and accepted_at is not null and instance_id is not null))
);
create table companion_private.quest_rewards (
 quest_id uuid primary key references public.companion_quests(id) on delete cascade,
 promise text not null check(length(btrim(promise)) between 1 and 1000)
);
create index companion_quests_pair on public.companion_quests(pair_id,created_at);
create index companion_pairs_member on public.companion_pairs(member_id);
create index companion_pairs_inviter on public.companion_pairs(inviter_id);
alter table public.companion_pairs enable row level security;
alter table public.companion_quests enable row level security;
alter table companion_private.invitations enable row level security;
alter table companion_private.quest_rewards enable row level security;
create policy companion_pair_read on public.companion_pairs for select to authenticated
 using(inviter_id=(select auth.uid()) or member_id=(select auth.uid()));
create policy companion_quest_read on public.companion_quests for select to authenticated
 using((sender_id=(select auth.uid()) or recipient_id=(select auth.uid())) and exists(
  select 1 from public.companion_pairs p where p.id=pair_id and p.status='active'
  and ((select auth.uid())=p.inviter_id or (select auth.uid())=p.member_id)));
create policy companion_invite_read on companion_private.invitations for select to authenticated
 using(exists(select 1 from public.companion_pairs p where p.id=pair_id and p.inviter_id=(select auth.uid())));
create policy companion_reward_read on companion_private.quest_rewards for select to authenticated
 using(exists(select 1 from public.companion_quests q where q.id=quest_id and
  (q.sender_id=(select auth.uid()) or (q.recipient_id=(select auth.uid()) and (not q.mystery or q.accepted_at is not null)))));
revoke all on public.companion_pairs,public.companion_quests from public,anon,authenticated;
grant select on public.companion_pairs,public.companion_quests to authenticated;
revoke all on companion_private.invitations,companion_private.quest_rewards from public,anon,authenticated;

-- Preserve the existing one-row-per-instance ledger. Only accepted attribution can qualify for2.
alter table public.xp_ledger drop constraint xp_ledger_amount_check;
alter table public.xp_ledger add constraint xp_ledger_amount_check check(amount in (1,2));
create function companion_private.credit_amount() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.companion_quests q where q.instance_id=new.instance_id
   and q.recipient_id=new.owner_id and q.accepted_at is not null) then new.amount:=2;
 else new.amount:=1;
 end if;
 return new;
end $$;
revoke all on function companion_private.credit_amount() from public,anon,authenticated;
create trigger companion_credit_amount before insert or update on public.xp_ledger
 for each row execute function companion_private.credit_amount();

-- Use the existing completion contract: current quest-day daily instances, eligible
-- unfinished one-time tasks/goals, or a legitimate completion made this quest day.
create function companion_private.eligible_instance(p_instance uuid) returns boolean
 language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.quest_instances qi join public.quests qs on qs.id=qi.quest_id
 where qi.id=p_instance and qi.owner_id=auth.uid() and qs.active and (
  (qi.status='completed' and (qi.completed_at at time zone 'America/Chicago' - interval '5 hours')::date=(now() at time zone 'America/Chicago' - interval '5 hours')::date)
  or (qi.status<>'completed' and (
   (qs.cadence='daily' and qi.due_date=(now() at time zone 'America/Chicago' - interval '5 hours')::date)
   or (qs.cadence='once' and (qs.quest_type='goal' or qi.due_date<=(now() at time zone 'America/Chicago' - interval '5 hours')::date))))));
$$;
revoke all on function companion_private.eligible_instance(uuid) from public,anon,authenticated;

create function companion_private.command(p_action text,p_payload jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); p public.companion_pairs%rowtype; q public.companion_quests%rowtype;
 i public.quest_instances%rowtype; sender uuid; recipient uuid; token text; v_id uuid; v_personal_quest_id uuid;
 v_title text; v_category text; v_reward text; v_mystery boolean; v_due date; v_difficulty text; v_request uuid;
 v_day date:=(now() at time zone 'America/Chicago' - interval '5 hours')::date;
 v_response jsonb;
begin
 if u is null then raise exception 'Sign-in required'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid request'; end if;
 if p_action='invite' then
  if p_payload->>'role' is null or p_payload->>'role' not in ('sender','recipient') then raise exception 'Choose your companion role'; end if;
  token:=replace(pg_catalog.gen_random_uuid()::text,'-','')||replace(pg_catalog.gen_random_uuid()::text,'-','');
  insert into public.companion_pairs(inviter_id,inviter_role) values(u,p_payload->>'role') returning * into p;
  insert into companion_private.invitations values(p.id,encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '7 days');
  return jsonb_build_object('inviteCode',token,'expiresAt',now()+interval '7 days');
 elsif p_action in ('preview-invite','join') then
  token:=lower(btrim(p_payload->>'code'));
  if token is null or token !~ '^[0-9a-f]{64}$' then raise exception 'Invitation unavailable'; end if;
  select cp.* into p from public.companion_pairs cp join companion_private.invitations inv on inv.pair_id=cp.id
   where inv.code_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update of cp;
  if not found or p.inviter_id=u or p.status='revoked' then raise exception 'Invitation unavailable'; end if;
  if p.status in ('active','requested') then
   if p.member_id=u and p_action='join' then return jsonb_build_object('requested',true); end if;
   raise exception 'Invitation unavailable';
  end if;
  if not exists(select 1 from companion_private.invitations inv where inv.pair_id=p.id and inv.expires_at>now()) then raise exception 'Invitation unavailable'; end if;
  if p_action='preview-invite' then
   return jsonb_build_object('name',coalesce((select display_name from public.profiles where id=p.inviter_id),'Your companion'),
     'yourRole',case when p.inviter_role='sender' then 'recipient' else 'sender' end);
  end if;
  update public.companion_pairs set member_id=u,status='requested' where id=p.id;
  return jsonb_build_object('requested',true);
 elsif p_action='confirm' then
  select * into p from public.companion_pairs where id=(p_payload->>'pairId')::uuid and inviter_id=u for update;
  if not found or p.status not in ('requested','active') then raise exception 'Invitation unavailable'; end if;
  if p.status='active' then return jsonb_build_object('confirmed',true); end if;
  if not exists(select 1 from companion_private.invitations inv where inv.pair_id=p.id and inv.expires_at>now()) then raise exception 'Invitation unavailable'; end if;
  update public.companion_pairs set status='active' where id=p.id;
  return jsonb_build_object('confirmed',true);
 elsif p_action='dashboard' then
  select jsonb_build_object('viewerId',u,'personalXp',coalesce((select sum(amount) from public.xp_ledger where owner_id=u),0),
   'pairs',coalesce((select jsonb_agg(jsonb_build_object('id',cp.id,'status',cp.status,'canConfirm',cp.inviter_id=u,
     'otherUserId',case when cp.inviter_id=u then cp.member_id else cp.inviter_id end,
     'yourRole',case when (cp.inviter_role='sender' and cp.inviter_id=u) or (cp.inviter_role='recipient' and cp.member_id=u) then 'sender' else 'recipient' end,
     'name',coalesce((select display_name from public.profiles where id=case when cp.inviter_id=u then cp.member_id else cp.inviter_id end),'Your companion')) order by cp.created_at)
     from public.companion_pairs cp where u in(cp.inviter_id,cp.member_id)),'[]'::jsonb),
   'quests',coalesce((select jsonb_agg(jsonb_build_object('id',cq.id,'pairId',cq.pair_id,'title',cq.title,'category',cq.category,
     'difficulty',cq.difficulty,'dueDate',cq.due_date,'rainCheckUntil',cq.rain_check_until,'instanceId',cq.instance_id,
     'incoming',cq.recipient_id=u,'status',case when qi.status='completed' then 'completed' else cq.status end,
     'hasReward',cq.has_reward,'mystery',cq.mystery,
     'reward',case when cq.sender_id=u or not cq.mystery or cq.accepted_at is not null
       then (select promise from companion_private.quest_rewards where quest_id=cq.id) else null end) order by cq.created_at desc)
     from public.companion_quests cq join public.companion_pairs cp on cp.id=cq.pair_id
     left join public.quest_instances qi on qi.id=cq.instance_id
     where cp.status='active' and u in(cq.sender_id,cq.recipient_id)),'[]'::jsonb),
   'overlaps',coalesce((select jsonb_agg(jsonb_build_object('id',sub.id,'title',sub.title,'completed',sub.status='completed')) from
    (select qi.id,qs.title,qi.status from public.quest_instances qi join public.quests qs on qs.id=qi.quest_id
     where qi.owner_id=u and companion_private.eligible_instance(qi.id)
     and not exists(select 1 from public.companion_quests cq where cq.instance_id=qi.id)
     order by qi.created_at desc limit 50) sub),'[]'::jsonb)) into v_response;
  return v_response;
 elsif p_action='revoke' then
  select * into p from public.companion_pairs where id=(p_payload->>'pairId')::uuid and u in(inviter_id,member_id) for update;
  if not found then raise exception 'Companionship unavailable'; end if;
  update public.companion_pairs set status='revoked' where id=p.id;
  return jsonb_build_object('revoked',true);
 elsif p_action='send' then
  select * into p from public.companion_pairs where id=(p_payload->>'pairId')::uuid and status='active' and u in(inviter_id,member_id) for update;
  if not found then raise exception 'Companionship unavailable'; end if;
  sender:=case when p.inviter_role='sender' then p.inviter_id else p.member_id end;
  recipient:=case when p.inviter_role='recipient' then p.inviter_id else p.member_id end;
  if u<>sender then raise exception 'Only the agreed sender can assign quests'; end if;
  v_title:=btrim(p_payload->>'title'); v_category:=coalesce(nullif(p_payload->>'category',''),'relationships');
  v_reward:=nullif(btrim(p_payload->>'reward'),''); v_mystery:=coalesce((p_payload->>'mystery')::boolean,false);
  v_due:=nullif(p_payload->>'dueDate','')::date; v_difficulty:=nullif(btrim(p_payload->>'difficulty'),''); v_request:=(p_payload->>'requestId')::uuid;
  if v_title is null or length(v_title) not between 1 and 120 or v_request is null then raise exception 'A title and send identifier are required'; end if;
  if v_category not in ('hygiene','home','mental_health','personal_growth','finance','career','relationships','physical_health') then raise exception 'Invalid category'; end if;
  if length(v_reward)>1000 or length(v_difficulty)>40 then raise exception 'Text is too long'; end if;
  if v_mystery and v_reward is null then raise exception 'A mystery needs a reward promise'; end if;
  if v_due is not null and (v_due<v_day or v_due>v_day+366) then raise exception 'Due date must be within the next year'; end if;
  select * into q from public.companion_quests where sender_id=u and request_id=v_request;
  if found then
   if q.pair_id<>p.id or q.title<>v_title or q.category<>v_category or q.due_date is distinct from v_due or q.difficulty is distinct from v_difficulty
    or q.mystery<>v_mystery or (select promise from companion_private.quest_rewards where quest_id=q.id) is distinct from v_reward then
     raise exception 'This send attempt already exists; refresh before editing';
   end if;
   return jsonb_build_object('questId',q.id);
  end if;
  insert into public.companion_quests(pair_id,sender_id,recipient_id,request_id,title,category,difficulty,due_date,has_reward,mystery)
   values(p.id,sender,recipient,v_request,v_title,v_category,v_difficulty,v_due,v_reward is not null,v_mystery) returning id into v_id;
  if v_reward is not null then insert into companion_private.quest_rewards values(v_id,v_reward); end if;
  return jsonb_build_object('questId',v_id);
 elsif p_action in ('accept','decline','rain-check','complete') then
  -- Lock ordering is pair → companion quest → personal instance, for every shared mutation.
  select cp.* into p from public.companion_pairs cp join public.companion_quests cq on cq.pair_id=cp.id
   where cq.id=(p_payload->>'questId')::uuid and cq.recipient_id=u and cp.status='active' for update of cp;
  if not found then raise exception 'Quest unavailable'; end if;
  select * into q from public.companion_quests where id=(p_payload->>'questId')::uuid and recipient_id=u for update;
  if p_action='decline' then
   if q.status='declined' then return jsonb_build_object('declined',true); end if;
   if q.status<>'pending' then raise exception 'Only pending quests can be declined'; end if;
   update public.companion_quests set status='declined' where id=q.id;
   return jsonb_build_object('declined',true);
  elsif p_action='accept' then
   if q.accepted_at is not null then return jsonb_build_object('accepted',true); end if;
   if q.status<>'pending' then raise exception 'Quest unavailable'; end if;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text||':'||v_day::text||':'||lower(btrim(q.title)),0));
   v_id:=nullif(p_payload->>'instanceId','')::uuid;
   if v_id is null then
    -- Exact-title overlap is automatic; differently-worded overlap is explicitly selected by the recipient.
    select qi.id into v_id from public.quest_instances qi join public.quests qs on qs.id=qi.quest_id
     where qi.owner_id=u and companion_private.eligible_instance(qi.id) and lower(btrim(qs.title))=lower(btrim(q.title))
     order by qi.created_at limit 1;
   end if;
   if v_id is null then
    select qs.id into v_personal_quest_id from public.quests qs where qs.owner_id=u and qs.active
     and (qs.scheduled_for is null or qs.scheduled_for<=v_day) and lower(btrim(qs.title))=lower(btrim(q.title))
     order by qs.created_at limit 1;
    if found then v_id:=public.ensure_quest_instance(v_personal_quest_id,v_day); end if;
   end if;
   if v_id is not null then
    select * into i from public.quest_instances where id=v_id and owner_id=u for update;
    if not found or not companion_private.eligible_instance(i.id) then raise exception 'Overlap must be your eligible real-life task'; end if;
    if exists(select 1 from public.companion_quests cq where cq.instance_id=i.id) then raise exception 'This task already has companion credit'; end if;
   else
    insert into public.quests(owner_id,title,domain,cadence,scheduled_for,quest_type)
     values(u,q.title,q.category,'once',v_day,'goal') returning id into v_personal_quest_id;
    insert into public.quest_instances(owner_id,quest_id,due_date) values(u,v_personal_quest_id,coalesce(q.due_date,v_day)) returning * into i;
   end if;
   update public.companion_quests set status='accepted',accepted_at=now(),instance_id=i.id where id=q.id;
   if i.status='completed' then
    insert into public.xp_ledger(owner_id,instance_id,amount) values(u,i.id,2)
     on conflict(instance_id) do update set amount=2;
   end if;
   return jsonb_build_object('accepted',true);
  end if;
  if q.accepted_at is null then raise exception 'Accept this quest first'; end if;
  select * into i from public.quest_instances where id=q.instance_id and owner_id=u for update;
  if not found then raise exception 'Personal quest unavailable'; end if;
  if p_action='rain-check' then
   if i.status='completed' then raise exception 'This task is already completed'; end if;
   v_due:=nullif(p_payload->>'until','')::date;
   if v_due is null or v_due<v_day or v_due>v_day+366 then raise exception 'Choose a rain-check date within the next year'; end if;
   perform public.set_quest_instance_status(i.id,'defer');
   update public.companion_quests set status='rain-check',rain_check_until=v_due where id=q.id;
   return jsonb_build_object('rainChecked',true);
  end if;
  perform public.set_quest_instance_status(i.id,'complete');
  update public.companion_quests set status='completed' where id=q.id;
  return jsonb_build_object('completed',true,'totalXpForTask',2);
 end if;
 raise exception 'Unsupported companion action';
exception
 when integrity_constraint_violation then raise exception 'Companion conflict; refresh before retrying';
 when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then raise exception 'Invalid companion request';
end $$;
revoke all on function companion_private.command(text,jsonb) from public,anon;
grant execute on function companion_private.command(text,jsonb) to authenticated;
create function public.companion_command(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
 language sql security invoker set search_path='' as $$ select companion_private.command(p_action,p_payload); $$;
revoke all on function public.companion_command(text,jsonb) from public,anon;
grant execute on function public.companion_command(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
