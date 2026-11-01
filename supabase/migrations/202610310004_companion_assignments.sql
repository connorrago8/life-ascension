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
-- Companion assignment does not change the +1 XP contract. Completion stays on
-- set_quest_instance_status / _award_quest_xp, which mint one ledger row of 1 XP.
create or replace function public.quest_companion_assign_to_owner(p_companion_id uuid,p_title text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid := auth.uid(); v_title text := btrim(p_title); v_quest uuid;
begin
 if v_owner is null then raise exception 'Authentication required'; end if;
 if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid quest title'; end if;
 -- Reject title variants that differ only by whitespace before looking up the existing quest.
 v_title := regexp_replace(v_title,'[[:space:]]+',' ','g');
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

-- Owner-controlled assignment retirement. Past ledger rows stay as they were.
create or replace function public.quest_companion_retire_assignment(p_assignment_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_owner uuid := auth.uid();
begin
 if v_owner is null then raise exception 'Authentication required'; end if;
 update public.quest_companion_assignments set active=false
 where id=p_assignment_id and owner_id=v_owner and active;
 return found;
end $$;
revoke all on function public.quest_companion_retire_assignment(uuid) from public,anon;
grant execute on function public.quest_companion_retire_assignment(uuid) to authenticated;
