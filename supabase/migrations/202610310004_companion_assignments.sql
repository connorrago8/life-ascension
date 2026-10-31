-- Companion-assigned tasks use the existing transactional completion path.
create table public.quest_companion_assignments (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 companion_id uuid not null,
 quest_id uuid not null,
 requested_title text not null check(char_length(btrim(requested_title)) between 1 and 120),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(owner_id,companion_id,quest_id),
 foreign key(companion_id,owner_id) references public.quest_companions(id,owner_id) on delete cascade,
 foreign key(quest_id,owner_id) references public.quests(id,owner_id) on delete cascade
);
create index quest_companion_assignments_owner_quest_idx on public.quest_companion_assignments(owner_id,quest_id);
alter table public.quest_companion_assignments enable row level security;
create policy companion_assignments_owner_read on public.quest_companion_assignments for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.quest_companion_assignments from anon,authenticated;
grant select on public.quest_companion_assignments to authenticated;
alter table public.xp_ledger drop constraint if exists xp_ledger_amount_check;
alter table public.xp_ledger add constraint xp_ledger_amount_check check(amount in (1,2));
create or replace function public.quest_companion_assign_to_owner(p_companion_id uuid,p_title text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid := auth.uid(); v_title text := btrim(p_title); v_quest uuid;
begin
 if v_owner is null then raise exception 'Authentication required'; end if;
 if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid quest title'; end if;
 if not exists(select 1 from public.quest_companions where id=p_companion_id and owner_id=v_owner and consent_confirmed_at is not null) then raise exception 'Companion unavailable'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':' || lower(regexp_replace(v_title,'[[:space:]]+',' ','g')),0));
 select id into v_quest from public.quests
 where owner_id=v_owner and active and lower(regexp_replace(btrim(title),'[[:space:]]+',' ','g'))=lower(regexp_replace(v_title,'[[:space:]]+',' ','g'))
 order by created_at asc limit 1;
 if v_quest is null then
  insert into public.quests(owner_id,title,domain,cadence,xp,active)
  values(v_owner,v_title,'relationships','once',1,true) returning id into v_quest;
 end if;
 insert into public.quest_companion_assignments(owner_id,companion_id,quest_id,requested_title)
 values(v_owner,p_companion_id,v_quest,v_title)
 on conflict(owner_id,companion_id,quest_id) do update set active=true,requested_title=excluded.requested_title;
 return v_quest;
end $$;
revoke all on function public.quest_companion_assign_to_owner(uuid,text) from public,anon;
grant execute on function public.quest_companion_assign_to_owner(uuid,text) to authenticated;
create or replace function public.set_quest_instance_status(p_instance_id uuid,p_action text)
returns text language plpgsql security definer set search_path='' as $$
declare inst public.quest_instances%rowtype; v_amount integer := 1;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_action not in ('complete','defer','resume') then raise exception 'Unsupported action'; end if;
 select * into inst from public.quest_instances where id=p_instance_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Instance not found'; end if;
 if inst.status='completed' then return 'completed'; end if;
 if p_action='complete' then
  if exists(select 1 from public.quest_companion_assignments where owner_id=auth.uid() and quest_id=inst.quest_id and active and created_at<=now()) then v_amount:=2; end if;
  update public.quest_instances set status='completed',completed_at=now() where id=inst.id;
  insert into public.xp_ledger(owner_id,instance_id,amount) values(auth.uid(),inst.id,v_amount) on conflict(instance_id) do nothing;
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
end $$;
revoke all on function public.set_quest_instance_status(uuid,text) from public,anon;
grant execute on function public.set_quest_instance_status(uuid,text) to authenticated;
