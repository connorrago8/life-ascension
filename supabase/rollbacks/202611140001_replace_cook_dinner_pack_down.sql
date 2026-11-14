-- Restores the previous starter function, including Cook dinner together.
-- Renames only the wind-down rows this migration introduced when they are still unmarked.

update public.couple_quests q
set title = 'Cook dinner together',
    description = 'Turn ingredients and teamwork into a meal worth remembering.',
    title_key = public.couple_title_key('Cook dinner together')
where q.title = 'Evening wind-down'
  and q.description = 'Put the day down together before sleep.'
  and not exists (select 1 from public.couple_quest_marks m where m.quest_id = q.id);

create or replace function public.couple_add_quest_pack()
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare b public.companion_bonds%rowtype; v_added integer := 0; v_before integer;
begin
  b := public._couple_active_bond();
  select count(*) into v_before from public.couple_quests where bond_id = b.id;
  insert into public.couple_quests(bond_id, title, description, cadence, kind, title_key, created_by)
  select b.id, pack.title, pack.description, pack.cadence, 'shared', public.couple_title_key(pack.title), auth.uid()
  from (values
    ('Cook dinner together', 'Turn ingredients and teamwork into a meal worth remembering.', 'weekly'),
    ('A walk without phones', 'Leave the noise behind and rediscover the art of talking.', 'weekly'),
    ('Coffee date', 'Share a warm drink and an unhurried hour.', 'weekly'),
    ('Plan our next adventure', 'Put a new pin on the map of your shared story.', 'weekly'),
    ('One thoughtful surprise', 'Make an ordinary day unexpectedly bright.', 'weekly'),
    ('Game night', 'Trade the day''s demands for a little friendly competition.', 'weekly'),
    ('Sunday reset', 'Restore your shared space before the next chapter begins.', 'weekly'),
    ('Try something new', 'Step outside the familiar and bring home a new memory.', 'monthly'),
    ('At-home movie night', 'Dim the lights and disappear into a story together.', 'weekly'),
    ('Make a shared playlist', 'Build a soundtrack only the two of you fully understand.', 'monthly'),
    ('Memory lane', 'Revisit the moments that brought you here.', 'monthly'),
    ('Workout together', 'Move side by side, at your own pace.', 'weekly'),
    ('A real check-in', 'Make room for the things that matter but rarely get said.', 'weekly'),
    ('Call someone we love', 'Keep a connection strong beyond your own front door.', 'weekly'),
    ('Our next chapter', 'Choose one shared goal and take its first small step.', 'monthly')
  ) as pack(title, description, cadence)
  where not exists (
    select 1 from public.couple_quests q
    where q.bond_id = b.id and q.title_key = public.couple_title_key(pack.title)
  );
  get diagnostics v_added = row_count;
  return pg_catalog.jsonb_build_object('added', v_added, 'skipped', 15 - v_added,
    'total', (select count(*) from public.couple_quests where bond_id = b.id), 'before', v_before);
end $$;
revoke all on function public.couple_add_quest_pack() from public, anon;
grant execute on function public.couple_add_quest_pack() to authenticated;
