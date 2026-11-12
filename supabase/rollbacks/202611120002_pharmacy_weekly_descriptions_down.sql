-- Reverse 202611120002_pharmacy_weekly_descriptions.sql.
-- Restores weekday inserts without a description, then drops the column.

create or replace function public._insert_weekly_autopilot_quest(p_owner uuid, p_title text, p_domain text, p_weekday integer)
returns uuid language plpgsql security definer set search_path = ''
as $ins$
declare v_id uuid; v_title text := pg_catalog.btrim(p_title); v_week date; v_scheduled date;
begin
 if p_owner is null then raise exception 'User id required'; end if;
 if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
 if p_domain not in ('hygiene','home','mental_health','personal_growth','finance','career','relationships','physical_health') then raise exception 'Invalid domain'; end if;
 if p_weekday is null or p_weekday not between 1 and 7 then raise exception 'Invalid weekday'; end if;
 v_week := public.quest_week_start(public.quest_game_day(pg_catalog.now(), public.quest_timezone(p_owner)));
 v_scheduled := v_week + (p_weekday - 1);
 insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type, active, fixed_reveal, weekly_weekday)
 values (p_owner, v_title, p_domain, 'weekly', v_scheduled, 'scheduled', true, true, p_weekday)
 returning id into v_id;
 return v_id;
end
$ins$;
revoke all on function public._insert_weekly_autopilot_quest(uuid, text, text, integer) from public, anon, authenticated, service_role;

drop function if exists public._sync_pharmacy_weekly_descriptions(uuid);
drop function if exists public.pharmacy_weekly_description(text);

alter table public.quests drop constraint if exists quests_description_check;
alter table public.quests drop column if exists description;

notify pgrst, 'reload schema';
