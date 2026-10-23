create extension if not exists pgcrypto;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text check(char_length(display_name)<=80),created_at timestamptz not null default now());
create table public.quests(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,title text not null check(char_length(btrim(title)) between 1 and 120),domain text not null default 'personal_growth' check(domain in ('hygiene','home','mental_health','personal_growth','finance','career','relationships','physical_health')),cadence text not null default 'once' check(cadence in ('once','daily')),xp integer not null default 1 check(xp=1),active boolean not null default true,created_at timestamptz not null default now(),unique(id,owner_id));
create table public.quest_instances(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,quest_id uuid not null,due_date date not null,status text not null default 'available' check(status in ('available','completed','deferred')),completed_at timestamptz,created_at timestamptz not null default now(),unique(quest_id,due_date),unique(id,owner_id),foreign key(quest_id,owner_id) references public.quests(id,owner_id) on delete cascade,check((status='completed' and completed_at is not null) or (status<>'completed' and completed_at is null)));
create table public.quest_events(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,instance_id uuid not null,event_type text not null check(event_type in ('completed','deferred','resumed')),created_at timestamptz not null default now(),foreign key(instance_id,owner_id) references public.quest_instances(id,owner_id) on delete cascade);
create table public.xp_ledger(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,instance_id uuid not null unique,amount integer not null check(amount=1),evidence_type text not null default 'self_report' check(evidence_type='self_report'),awarded_at timestamptz not null default now(),foreign key(instance_id,owner_id) references public.quest_instances(id,owner_id) on delete cascade);
create index on public.quests(owner_id);
create index on public.quest_instances(owner_id,due_date);
create index on public.quest_events(owner_id,created_at);
create index on public.xp_ledger(owner_id,awarded_at);
alter table public.profiles enable row level security;
alter table public.quests enable row level security;
alter table public.quest_instances enable row level security;
alter table public.quest_events enable row level security;
alter table public.xp_ledger enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profile_insert on public.profiles for insert to authenticated with check(id=(select auth.uid()));
create policy profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy quests_read on public.quests for select to authenticated using(owner_id=(select auth.uid()));
create policy quests_insert on public.quests for insert to authenticated with check(owner_id=(select auth.uid()) and xp=1);
create policy instances_read on public.quest_instances for select to authenticated using(owner_id=(select auth.uid()));
create policy events_read on public.quest_events for select to authenticated using(owner_id=(select auth.uid()));
create policy xp_read on public.xp_ledger for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.quest_instances,public.quest_events,public.xp_ledger from anon,authenticated;
grant select on public.quest_instances,public.quest_events,public.xp_ledger to authenticated;
grant select,insert on public.quests to authenticated;
grant select,insert,update on public.profiles to authenticated;
create or replace function public.ensure_quest_instance(p_quest_id uuid,p_date date default current_date)
returns uuid language plpgsql security definer set search_path='' as $$
declare q public.quests%rowtype; instance_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_date is null or p_date > current_date+1 or p_date < current_date-30 then raise exception 'Date outside allowed window'; end if;
 select * into q from public.quests where id=p_quest_id and owner_id=auth.uid() and active;
 if not found then raise exception 'Quest not found'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(q.id::text,0));
 if q.cadence='once' then
  select id into instance_id from public.quest_instances where quest_id=q.id limit 1;
  if found then return instance_id; end if;
 end if;
 insert into public.quest_instances(owner_id,quest_id,due_date) values(auth.uid(),q.id,p_date)
 on conflict(quest_id,due_date) do update set due_date=excluded.due_date returning id into instance_id;
 return instance_id;
end;$$;
create or replace function public.set_quest_instance_status(p_instance_id uuid,p_action text)
returns text language plpgsql security definer set search_path='' as $$
declare inst public.quest_instances%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_action not in ('complete','defer','resume') then raise exception 'Unsupported action'; end if;
 select * into inst from public.quest_instances where id=p_instance_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Instance not found'; end if;
 if inst.status='completed' then return 'completed'; end if;
 if p_action='complete' then
  update public.quest_instances set status='completed',completed_at=now() where id=inst.id;
  insert into public.xp_ledger(owner_id,instance_id,amount) values(auth.uid(),inst.id,1) on conflict(instance_id) do nothing;
  insert into public.quest_events(owner_id,instance_id,event_type) values(auth.uid(),inst.id,'completed');
  return 'completed';
 elsif p_action='defer' and inst.status='available' then
  update public.quest_instances set status='deferred' where id=inst.id;
  insert into public.quest_events(owner_id,instance_id,event_type) values(auth.uid(),inst.id,'deferred');
  return 'deferred';
 elsif p_action='resume' and inst.status='deferred' then
  update public.quest_instances set status='available' where id=inst.id;
  insert into public.quest_events(owner_id,instance_id,event_type) values(auth.uid(),inst.id,'resumed');
  return 'available';
 end if;
 return inst.status;
end;$$;
revoke all on function public.ensure_quest_instance(uuid,date),public.set_quest_instance_status(uuid,text) from public,anon;
grant execute on function public.ensure_quest_instance(uuid,date),public.set_quest_instance_status(uuid,text) to authenticated;
