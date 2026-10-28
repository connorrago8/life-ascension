-- Opt-in configuration is owner-scoped and only allowed before any instance has progress.
create or replace function public.configure_quest_progress(
  p_quest_id uuid, p_target integer, p_unit text, p_increment integer
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_owner uuid := auth.uid();
begin
 if v_owner is null then raise exception 'Authentication required'; end if;
 if p_target is null or p_target < 1 or p_target > 1000000
    or p_unit is null or char_length(btrim(p_unit)) not between 1 and 32
    or p_increment is null or p_increment < 1 or p_increment > p_target then
   raise exception 'Invalid progress configuration';
 end if;
 perform 1 from public.quests where id=p_quest_id and owner_id=v_owner and active for update;
 if not found then raise exception 'Active quest not found'; end if;
 if exists(select 1 from public.quest_instances
           where quest_id=p_quest_id and (status='completed' or current_amount<>0)) then
   raise exception 'Quest already has completion or progress history';
 end if;
 update public.quests set target_amount=p_target,progress_unit=btrim(p_unit),progress_increment=p_increment
 where id=p_quest_id and owner_id=v_owner;
end $$;
revoke all on function public.configure_quest_progress(uuid,integer,text,integer) from public,anon;
grant execute on function public.configure_quest_progress(uuid,integer,text,integer) to authenticated;
