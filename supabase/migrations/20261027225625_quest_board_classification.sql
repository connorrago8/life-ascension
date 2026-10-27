-- Additive Milestone 1 classification. Apply only to an approved isolated database.
-- Legacy quests default to Side; scheduled/goal and cadence retain their meanings.
alter table public.quests add column quest_class text not null default 'side'
  check (quest_class in ('main','side'));

create or replace function public.set_quest_class(p_quest_id uuid, p_class text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_class is null or p_class not in ('main','side') then raise exception 'Invalid quest classification'; end if;
  update public.quests set quest_class=p_class where id=p_quest_id and owner_id=auth.uid() and active;
  if not found then raise exception 'Active quest not found'; end if;
  return p_class;
end $$;

create or replace function public.create_classified_quest(p_title text,p_domain text,p_cadence text,p_date date,p_quest_type text,p_class text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_class is null or p_class not in ('main','side') then raise exception 'Invalid quest classification'; end if;
  -- Preserve existing validation and atomic occurrence creation in the legacy function.
  v_id := public.create_scheduled_quest(p_title,p_domain,p_cadence,p_date,p_quest_type);
  update public.quests set quest_class=p_class where id=v_id and owner_id=auth.uid();
  return v_id;
end $$;
revoke all on function public.set_quest_class(uuid,text),public.create_classified_quest(text,text,text,date,text,text) from public,anon;
grant execute on function public.set_quest_class(uuid,text),public.create_classified_quest(text,text,text,date,text,text) to authenticated;
