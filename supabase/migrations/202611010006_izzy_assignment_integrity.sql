-- IZ-7: Strengthen approved assignment links against the real quest instance.
-- Validate existing data before adding foreign keys; fail migration rather than
-- trusting a client-supplied quest_id or occurrence ID.
do $$
begin
  if to_regclass('public.quests') is null
     or to_regclass('public.quest_instances') is null then
    raise exception 'Quest schema unavailable: cannot verify Izzy assignments';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quest_instances'
      and column_name='owner_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quest_instances'
      and column_name='quest_id'
  ) then
    raise exception 'Quest instance owner/quest linkage unavailable';
  end if;
end;
$$;

-- This composite unique key allows a foreign key to prove that the stored
-- owner, quest and instance refer to the SAME actual occurrence.
create unique index if not exists quest_instances_izzy_owner_quest_identity
  on public.quest_instances(id, owner_id, quest_id);

alter table public.izzy_approved_assignments
  add constraint izzy_approved_assignment_occurrence_fk
  foreign key (quest_instance_id, owner_id, quest_id)
  references public.quest_instances(id, owner_id, quest_id)
  on delete restrict;

-- The curse must refer to the same quest as its approved assignment.
create unique index if not exists izzy_approved_assignments_id_quest_identity
  on public.izzy_approved_assignments(id, quest_id);

alter table public.izzy_secret_curses
  add constraint izzy_curse_assignment_quest_fk
  foreign key (assignment_id, quest_id)
  references public.izzy_approved_assignments(id, quest_id)
  on delete restrict;

comment on constraint izzy_approved_assignment_occurrence_fk
  on public.izzy_approved_assignments is
  'Database-enforced owner/quest/occurrence identity; not a source label.';
comment on constraint izzy_curse_assignment_quest_fk
  on public.izzy_secret_curses is
  'Curse quest must match the linked approved Izzy assignment.';
