-- Atomic creation of an opt-in tracked quest. Failure rolls back both quest and configuration.
-- Untracked quests continue using create_scheduled_quest unchanged.
create or replace function public.create_tracked_quest(
 p_title text, p_domain text, p_cadence text, p_date date, p_quest_type text,
 p_target integer, p_unit text, p_increment integer
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 -- Validate configuration BEFORE creating the quest.
 if p_target is null or p_target not between 1 and 1000000
    or p_unit is null or char_length(btrim(p_unit)) not between 1 and 32
    or p_increment is null or p_increment not between 1 and p_target then
   raise exception 'Invalid progress configuration';
 end if;
 v_id := public.create_scheduled_quest(p_title,p_domain,p_cadence,p_date,p_quest_type);
 perform public.configure_quest_progress(v_id,p_target,p_unit,p_increment);
 return v_id;
end $$;
revoke all on function public.create_tracked_quest(text,text,text,date,text,integer,text,integer) from public,anon;
grant execute on function public.create_tracked_quest(text,text,text,date,text,integer,text,integer) to authenticated;
notify pgrst, 'reload schema';
