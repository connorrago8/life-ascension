-- Draft-only migration. Do not apply to production without separate approval.
-- Partial progress is opt-in: null target_amount retains one-tap completion.
-- Existing 1 XP per completed instance is unchanged.
alter table public.quests
  add column target_amount integer,
  add column progress_unit text,
  add column progress_increment integer;
alter table public.quests
  add constraint quests_progress_config_valid check (
    (target_amount is null and progress_unit is null and progress_increment is null)
    or (target_amount between 1 and 1000000
        and char_length(btrim(progress_unit)) between 1 and 32
        and progress_increment between 1 and target_amount)
  );
alter table public.quest_instances
  add column current_amount integer not null default 0,
  add column progress_updated_at timestamptz;
alter table public.quest_instances
  add constraint quest_instances_nonnegative_progress check (current_amount >= 0);

create table public.quest_progress_operations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  instance_id uuid not null,
  request_id uuid not null,
  delta integer not null check (delta <> 0),
  resulting_amount integer not null check (resulting_amount >= 0),
  resulting_status text not null check (resulting_status in ('available','completed')),
  created_at timestamptz not null default now(),
  unique(owner_id, request_id),
  foreign key(instance_id, owner_id)
    references public.quest_instances(id, owner_id) on delete cascade
);
create index quest_progress_operations_instance_idx
  on public.quest_progress_operations(owner_id, instance_id, created_at);
alter table public.quest_progress_operations enable row level security;
create policy quest_progress_operations_read
  on public.quest_progress_operations for select to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.quest_progress_operations from public, anon, authenticated;
grant select on public.quest_progress_operations to authenticated;

-- One request ID identifies one immutable operation. A retry returns its original result.
-- Lock the parent quest, then instance, before reading the journal to serialize updates.
-- The existing completion RPC remains the sole source of XP ledger writes.
create or replace function public.log_quest_progress(
  p_instance_id uuid,
  p_request_id uuid,
  p_delta integer
)
returns table(current_amount integer, status text, completed_now boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_inst public.quest_instances%rowtype;
  v_quest public.quests%rowtype;
  v_old public.quest_progress_operations%rowtype;
  v_next integer;
  v_status text;
  v_today date;
  v_lock bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_instance_id is null or p_request_id is null or p_delta is null or p_delta = 0 then
    raise exception 'Invalid progress request';
  end if;
  -- Serialize same request IDs even when different quest instances are targeted.
  -- This prevents a concurrent unique-key collision from surfacing as an unhandled error.
  v_lock := pg_catalog.hashtextextended(v_user::text || ':' || p_request_id::text, 0);
  perform pg_catalog.pg_advisory_xact_lock(v_lock);
  -- Lock quest BEFORE instance, matching configure_quest_progress lock order.
  -- The first lookup is owner-scoped and only identifies the parent quest.
  select * into v_quest from public.quests
    where id = (select quest_id from public.quest_instances
                where id=p_instance_id and owner_id=v_user)
      and owner_id=v_user for update;
  if not found then raise exception 'Quest not found'; end if;
  select * into v_inst from public.quest_instances
    where id = p_instance_id and owner_id = v_user for update;
  if not found then raise exception 'Instance not found'; end if;

  select * into v_old from public.quest_progress_operations
    where owner_id = v_user and request_id = p_request_id;
  if found then
    if v_old.instance_id <> p_instance_id or v_old.delta <> p_delta then
      raise exception 'Request ID reused with different payload';
    end if;
    return query select v_old.resulting_amount, v_old.resulting_status, false;
    return;
  end if;

  if not v_quest.active then raise exception 'Active quest not found'; end if;
  if v_quest.target_amount is null then raise exception 'Quest does not track partial progress'; end if;
  if v_inst.status <> 'available' then raise exception 'Instance is not available for progress'; end if;
  if v_inst.current_amount > v_quest.target_amount then
    raise exception 'Stored progress exceeds target; configuration requires repair';
  end if;
  -- Match the existing completion RPC's Chicago-time eligibility checks before accepting progress.
  v_today := (now() at time zone 'America/Chicago')::date;
  if v_quest.cadence = 'daily' and (v_inst.due_date > v_today or v_inst.due_date < v_today - 2
      or (v_quest.scheduled_for is not null and v_inst.due_date < v_quest.scheduled_for)) then
    raise exception 'Daily progress is outside the completion window';
  end if;
  if v_quest.cadence = 'once' and v_quest.quest_type <> 'goal' and v_inst.due_date > v_today then
    raise exception 'Future scheduled quest cannot log progress yet';
  end if;
  if p_delta < 0 and p_delta <> -v_quest.progress_increment then
    raise exception 'Undo must reverse one default increment';
  end if;
  if p_delta > v_quest.target_amount then raise exception 'Progress amount exceeds target'; end if;
  if p_delta < 0 and not exists (
      select 1 from public.quest_progress_operations
      where instance_id=v_inst.id and owner_id=v_user and delta>0
  ) then raise exception 'No progress operation to undo'; end if;
  v_next := v_inst.current_amount + p_delta;
  if v_next < 0 or v_next > v_quest.target_amount then
    raise exception 'Progress would exceed allowed range';
  end if;

  update public.quest_instances
    set current_amount = v_next, progress_updated_at = now()
    where id = v_inst.id;
  v_status := 'available';
  if v_next = v_quest.target_amount then
    -- Existing RPC enforces date windows, archive rules, and awards 1 XP once.
    v_status := public.set_quest_instance_status(v_inst.id, 'complete');
  end if;
  insert into public.quest_progress_operations
    (owner_id, instance_id, request_id, delta, resulting_amount, resulting_status)
    values (v_user, v_inst.id, p_request_id, p_delta, v_next, v_status);
  return query select v_next, v_status, (v_status = 'completed');
end
$$;
revoke all on function public.log_quest_progress(uuid,uuid,integer) from public, anon;
grant execute on function public.log_quest_progress(uuid,uuid,integer) to authenticated;
notify pgrst, 'reload schema';
