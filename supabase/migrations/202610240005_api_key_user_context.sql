-- API-key callers have no Supabase user JWT, so auth.uid() is null on a service-role
-- connection. These wrappers are executable only by service_role. Each one checks the
-- service-role JWT claim, pins request.jwt.claim.sub to the already authenticated user,
-- and calls the existing owner-checked function in the same transaction.
-- Do not grant them to anon or authenticated. Do not pass a user id supplied by the model.

create or replace function public._bind_service_role_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim_role text;
  claims text;
begin
  if p_user_id is null then
    raise exception 'Authentication required';
  end if;

  claim_role := nullif(pg_catalog.current_setting('request.jwt.claim.role', true), '');
  if claim_role is null then
    claims := nullif(pg_catalog.current_setting('request.jwt.claims', true), '');
    if claims is not null then
      claim_role := claims::jsonb ->> 'role';
    end if;
  end if;
  if claim_role is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', p_user_id::text, true);
end;
$$;

create or replace function public.create_scheduled_quest_as_user(
  p_user_id uuid,
  p_title text,
  p_domain text,
  p_cadence text,
  p_date date,
  p_quest_type text default 'scheduled'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._bind_service_role_user(p_user_id);
  return public.create_scheduled_quest(p_title, p_domain, p_cadence, p_date, p_quest_type);
end;
$$;

create or replace function public.ensure_quest_instance_as_user(
  p_user_id uuid,
  p_quest_id uuid,
  p_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._bind_service_role_user(p_user_id);
  return public.ensure_quest_instance(p_quest_id, p_date);
end;
$$;

create or replace function public.set_quest_instance_status_as_user(
  p_user_id uuid,
  p_instance_id uuid,
  p_action text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._bind_service_role_user(p_user_id);
  return public.set_quest_instance_status(p_instance_id, p_action);
end;
$$;

create or replace function public.add_quest_progress_as_user(
  p_user_id uuid,
  p_quest_id uuid,
  p_note text,
  p_percent integer default null,
  p_instance_id uuid default null,
  p_source text default 'api'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._bind_service_role_user(p_user_id);
  return public.add_quest_progress(p_quest_id, p_note, p_percent, p_instance_id, p_source);
end;
$$;

create or replace function public.get_lifetime_xp_as_user(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._bind_service_role_user(p_user_id);
  return public.get_lifetime_xp();
end;
$$;

revoke all on function public._bind_service_role_user(uuid) from public, anon, authenticated, service_role;
revoke all on function public.create_scheduled_quest_as_user(uuid, text, text, text, date, text) from public, anon, authenticated;
revoke all on function public.ensure_quest_instance_as_user(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.set_quest_instance_status_as_user(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.add_quest_progress_as_user(uuid, uuid, text, integer, uuid, text) from public, anon, authenticated;
revoke all on function public.get_lifetime_xp_as_user(uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    -- Reads on the API-key path use the service-role client and filter owner_id in the route.
    -- Writes stay inside the owner-checked functions above. No insert, update, or delete grant.
    grant select on table public.quests to service_role;
    grant select on table public.quest_instances to service_role;
    grant execute on function public.create_scheduled_quest_as_user(uuid, text, text, text, date, text) to service_role;
    grant execute on function public.ensure_quest_instance_as_user(uuid, uuid, date) to service_role;
    grant execute on function public.set_quest_instance_status_as_user(uuid, uuid, text) to service_role;
    grant execute on function public.add_quest_progress_as_user(uuid, uuid, text, integer, uuid, text) to service_role;
    grant execute on function public.get_lifetime_xp_as_user(uuid) to service_role;
  end if;
end;
$$;

notify pgrst, 'reload schema';
