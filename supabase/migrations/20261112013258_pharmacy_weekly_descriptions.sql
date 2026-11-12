-- Display copy for the six Pharmacy weekly titles. Titles and ids stay put.
-- Reverse with supabase/rollbacks/20261112013258_pharmacy_weekly_descriptions_down.sql.
--
-- Existing pack rows are filled by an update that sets description and nothing else.
-- Running it again changes no row once the sentence is already stored.

alter table public.quests add column if not exists description text;

alter table public.quests drop constraint if exists quests_description_check;
alter table public.quests add constraint quests_description_check
  check (description is null or char_length(description) between 1 and 200);

create or replace function public.pharmacy_weekly_description(p_title text)
returns text language sql immutable set search_path = ''
as $$
  select case public.quest_title_key(p_title)
    when 'tech schedule' then 'Set the crew''s week in motion with a clear, fair plan.'
    when 'pharmacist schedule' then 'Keep the watch covered and every shift accounted for.'
    when 'supplies order' then 'Restock the essentials before the shelves run thin.'
    when 'u learn check' then 'Clear the training ledger and keep your skills sharp.'
    when 'attendance check' then 'Review the week''s coverage and catch gaps early.'
    when 'pto check' then 'Mark upcoming absences so the team can plan ahead.'
    else null
  end
$$;
revoke all on function public.pharmacy_weekly_description(text) from public, anon, authenticated;

-- New pack quests store the sentence. Other weekday quests stay blank.
create or replace function public._insert_weekly_autopilot_quest(p_owner uuid, p_title text, p_domain text, p_weekday integer)
returns uuid language plpgsql security definer set search_path = ''
as $ins$
declare v_id uuid; v_title text := pg_catalog.btrim(p_title); v_week date; v_scheduled date; v_copy text;
begin
 if p_owner is null then raise exception 'User id required'; end if;
 if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
 if p_domain not in ('hygiene','home','mental_health','personal_growth','finance','career','relationships','physical_health') then raise exception 'Invalid domain'; end if;
 if p_weekday is null or p_weekday not between 1 and 7 then raise exception 'Invalid weekday'; end if;
 v_week := public.quest_week_start(public.quest_game_day(pg_catalog.now(), public.quest_timezone(p_owner)));
 v_scheduled := v_week + (p_weekday - 1);
 v_copy := public.pharmacy_weekly_description(v_title);
 insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type, active, fixed_reveal, weekly_weekday, description)
 values (p_owner, v_title, p_domain, 'weekly', v_scheduled, 'scheduled', true, true, p_weekday, v_copy)
 returning id into v_id;
 return v_id;
end
$ins$;
revoke all on function public._insert_weekly_autopilot_quest(uuid, text, text, integer) from public, anon, authenticated, service_role;

-- p_owner null updates every account. Only description is written.
create or replace function public._sync_pharmacy_weekly_descriptions(p_owner uuid default null)
returns integer language plpgsql security definer set search_path = ''
as $sync$
declare n integer;
begin
  update public.quests q
     set description = public.pharmacy_weekly_description(q.title)
   where (p_owner is null or q.owner_id = p_owner)
     and q.fixed_reveal is true
     and q.weekly_weekday = 1
     and q.cadence = 'weekly'
     and q.domain = 'career'
     and public.pharmacy_weekly_description(q.title) is not null
     and q.description is distinct from public.pharmacy_weekly_description(q.title);
  get diagnostics n = row_count;
  return n;
end
$sync$;
revoke all on function public._sync_pharmacy_weekly_descriptions(uuid) from public, anon, authenticated, service_role;

select public._sync_pharmacy_weekly_descriptions();

notify pgrst, 'reload schema';
