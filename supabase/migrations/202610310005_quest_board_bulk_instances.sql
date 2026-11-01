-- One authenticated RPC replaces hundreds of client-side instance-creation requests.
-- Reuses the existing authoritative ensure_quest_instance implementation and its locking.
create or replace function public.quest_board_v3_ensure_instances(p_day date)
returns integer language plpgsql security definer set search_path='' as $$
declare v_owner uuid := auth.uid(); v_count integer := 0; q record;
begin
 if v_owner is null then raise exception 'Authentication required'; end if;
 if p_day is null or p_day <> ((now() - interval '5 hours') at time zone 'America/Chicago')::date
 then raise exception 'Only the current quest day is allowed'; end if;
 for q in
  select id from public.quests
  where owner_id=v_owner and active
   and (scheduled_for is null or scheduled_for<=p_day)
  order by id
 loop
  perform public.ensure_quest_instance(q.id,p_day);
  v_count:=v_count+1;
 end loop;
 return v_count;
end $$;
revoke all on function public.quest_board_v3_ensure_instances(date) from public,anon;
grant execute on function public.quest_board_v3_ensure_instances(date) to authenticated;
