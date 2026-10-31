-- Quest Board 3.0: concurrency-safe, immutable daily selections.
-- Apply only after review and after 202610310001_quest_board_v3_storage.sql.
create or replace function public.quest_board_v3_freeze_selection(p_day date, p_quest_ids uuid[])
returns uuid[] language plpgsql security definer set search_path = ''
as $$
declare v_owner uuid; v_today date; v_result uuid[]; v_count int;
begin
 v_owner := (select auth.uid());
 if v_owner is null then raise exception 'Sign-in required'; end if;
 v_today := ((now() - interval '5 hours') at time zone 'America/Chicago')::date;
 if p_day is distinct from v_today then raise exception 'Only the current quest day can be selected'; end if;
 if p_quest_ids is null or cardinality(p_quest_ids) > 10 then raise exception 'Invalid selection size'; end if;
 select count(*) into v_count from unnest(p_quest_ids) as ids(id);
 if v_count <> (select count(distinct id) from unnest(p_quest_ids) as ids(id)) then raise exception 'Duplicate quest IDs'; end if;
 if exists (
   select 1 from unnest(p_quest_ids) as ids(id)
   left join public.quests q on q.id=ids.id and q.owner_id=v_owner and q.active and q.cadence='daily'
   where q.id is null
 ) then raise exception 'Selection contains unavailable quests'; end if;
 insert into public.quest_board_v3_selections(owner_id,day,quest_ids)
 values(v_owner,p_day,p_quest_ids)
 on conflict(owner_id,day) do nothing;
 select quest_ids into v_result from public.quest_board_v3_selections where owner_id=v_owner and day=p_day;
 return v_result;
end $$;
revoke all on function public.quest_board_v3_freeze_selection(date,uuid[]) from public,anon;
grant execute on function public.quest_board_v3_freeze_selection(date,uuid[]) to authenticated;

-- Single free reroll per Chicago quest day, enforced atomically.
create or replace function public.quest_board_v3_use_reroll(p_day date)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_owner uuid; v_today date; v_inserted int;
begin
 v_owner := (select auth.uid());
 if v_owner is null then raise exception 'Sign-in required'; end if;
 v_today := ((now() - interval '5 hours') at time zone 'America/Chicago')::date;
 if p_day is distinct from v_today then raise exception 'Invalid reroll day'; end if;
 insert into public.quest_board_v3_bonus_rerolls(owner_id,day,rerolls)
 values(v_owner,p_day,1)
 on conflict(owner_id,day) do nothing;
 get diagnostics v_inserted = row_count;
 return v_inserted=1;
end $$;
revoke all on function public.quest_board_v3_use_reroll(date) from public,anon;
grant execute on function public.quest_board_v3_use_reroll(date) to authenticated;
