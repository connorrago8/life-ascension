create table public.ascension_entries (
  owner_id uuid not null references auth.users(id) on delete cascade,
  track text not null check (track in ('health', 'finance')),
  entry_date date not null,
  tracker jsonb not null check (jsonb_typeof(tracker) = 'object' and octet_length(tracker::text) <= 4096),
  quest_id uuid,
  primary key (owner_id, track, entry_date),
  foreign key (quest_id, owner_id) references public.quests(id, owner_id)
);

alter table public.ascension_entries enable row level security;
revoke all on public.ascension_entries from public, anon, authenticated;
grant select on public.ascension_entries to authenticated;
create policy ascension_owner_read on public.ascension_entries
  for select to authenticated using (owner_id = (select auth.uid()));

create function public.save_ascension_entry(p_track text, p_date date, p_tracker jsonb, p_complete boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_quest uuid;
  v_instance uuid;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if p_track is null or p_track not in ('health', 'finance')
    or p_date is null or p_date > v_today or p_date < v_today - 30
    or p_tracker is null or p_complete is null then
    raise exception 'Invalid tracker entry';
  end if;
  if p_track = 'finance' and (p_date < date '2026-12-03'
    or p_date >= date '2027-06-01' or (p_date - date '2026-12-03') % 14 <> 0) then
    raise exception 'Select a scheduled payday';
  end if;

  insert into public.ascension_entries(owner_id, track, entry_date, tracker)
  values (v_owner, p_track, p_date, p_tracker)
  on conflict (owner_id, track, entry_date) do update set tracker = excluded.tracker
  returning quest_id into v_quest;

  if p_complete and v_quest is null then
    if p_track = 'health' and (p_date < date '2026-11-26' or p_date < v_today - 2) then
      raise exception 'Choose an eligible lights-out night';
    end if;
    if p_track = 'finance' and length(trim(coalesce(p_tracker->>'decision', ''))) = 0 then
      raise exception 'Record your payday decision';
    end if;
    v_quest := public.create_scheduled_quest(
      case p_track when 'health' then 'Lights out by 11 PM' else 'Complete my payday money check' end,
      case p_track when 'health' then 'physical_health' else 'finance' end,
      'once', p_date
    );
    select id into strict v_instance from public.quest_instances where quest_id = v_quest;
    perform public.set_quest_instance_status(v_instance, 'complete');
    update public.ascension_entries set quest_id = v_quest
      where owner_id = v_owner and track = p_track and entry_date = p_date;
  end if;
end $$;

revoke all on function public.save_ascension_entry(text,date,jsonb,boolean) from public, anon;
grant execute on function public.save_ascension_entry(text,date,jsonb,boolean) to authenticated;
notify pgrst, 'reload schema';
