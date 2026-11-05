-- API-key progress operations reuse the established authenticated user-binding mechanism.
-- Never trust a caller-supplied owner id; the API authenticates the key first.
create or replace function public.log_quest_progress_as_user(
 p_user_id uuid,p_instance_id uuid,p_request_id uuid,p_delta integer
) returns table(current_amount integer,status text,completed_now boolean)
language plpgsql security definer set search_path = ''
as $$
begin
 perform public._bind_service_role_user(p_user_id);
 return query select * from public.log_quest_progress(p_instance_id,p_request_id,p_delta);
end $$;
revoke all on function public.log_quest_progress_as_user(uuid,uuid,uuid,integer)
 from public,anon,authenticated,service_role;
do $$
begin
 if exists(select 1 from pg_catalog.pg_roles where rolname='service_role') then
  grant execute on function public.log_quest_progress_as_user(uuid,uuid,uuid,integer) to service_role;
 end if;
end $$;
notify pgrst, 'reload schema';
