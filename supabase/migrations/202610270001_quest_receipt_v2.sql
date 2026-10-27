-- Versioned quest completion receipt. Keeps the legacy TEXT-returning RPC intact.
-- The caller receives a quest-scoped, server-authoritative receipt from the same transaction.
create or replace function public.set_quest_instance_status_v2(p_instance_id uuid,p_action text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  inst public.quest_instances%rowtype;
  q public.quests%rowtype;
  v_today date := (now() at time zone 'America/Chicago')::date;
  ledger_entry_id uuid;
  receipt_status text;
  receipt_xp integer := 0;
  receipt_awarded_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_action is null or p_action not in ('complete','defer','resume') then
    raise exception 'Unsupported action';
  end if;

  select * into inst
  from public.quest_instances
  where id=p_instance_id and owner_id=auth.uid()
  for update;

  if not found then
    raise exception 'Instance not found';
  end if;

  -- Mirror archived quest and due-date enforcement from the effective 0007 RPC.
  select * into q from public.quests where id=inst.quest_id and owner_id=auth.uid();
  if not found then raise exception 'Quest not found'; end if;
  if inst.status <> 'completed' and not q.active then
    raise exception 'Active quest not found';
  end if;
  if p_action='complete' then
    if inst.status <> 'completed' then
      if q.cadence='daily' and (inst.due_date > v_today or inst.due_date < q.scheduled_for) then
        raise exception 'Future daily quests cannot be completed';
      end if;
      if q.cadence='daily' and inst.due_date < v_today-2 then
        raise exception 'Daily quests can only be completed for today or the previous 2 days';
      end if;
      if q.cadence='once' and q.quest_type<>'goal' and inst.due_date > v_today then
        raise exception 'Future scheduled quest cannot be completed yet';
      end if;
    end if;
    if inst.status='completed' then
      receipt_status := 'already_awarded';
    else
      update public.quest_instances
      set status='completed', completed_at=now()
      where id=inst.id;

      insert into public.xp_ledger(owner_id,instance_id,amount)
      values(auth.uid(),inst.id,1)
      on conflict(instance_id) do nothing
      returning id into ledger_entry_id;

      if ledger_entry_id is not null then
        receipt_status := 'awarded';
        receipt_xp := 1;
      else
        receipt_status := 'already_awarded';
      end if;

      insert into public.quest_events(owner_id,instance_id,event_type)
      values(auth.uid(),inst.id,'completed');
    end if;

    -- The initial RPC response may be lost after COMMIT. A retry must report
    -- durable ledger evidence, not just XP newly minted by this invocation.
    select awarded_at into receipt_awarded_at
    from public.xp_ledger
    where instance_id=inst.id and owner_id=auth.uid();
    if receipt_awarded_at is null then
      -- A completed instance without a ledger row is an anomaly, not proof of XP.
      receipt_status := 'not_awarded';
    end if;
    return jsonb_build_object(
      'schema_version', 1,
      'status', 'completed',
      'quest_instance_id', inst.id,
      'quest_completion_confirmed', true,
      'reward_status', receipt_status,
      'xp_awarded', receipt_xp,
      'reward_confirmed', (receipt_awarded_at is not null),
      'reward_awarded_at', receipt_awarded_at
    );
  elsif p_action='defer' and inst.status='available' then
    update public.quest_instances set status='deferred' where id=inst.id;
    insert into public.quest_events(owner_id,instance_id,event_type)
    values(auth.uid(),inst.id,'deferred');
    return jsonb_build_object(
      'schema_version', 1,
      'status', 'deferred',
      'quest_instance_id', inst.id,
      'quest_completion_confirmed', false,
      'reward_status', 'not_awarded',
      'xp_awarded', 0,
      'reward_confirmed', false,
      'reward_awarded_at', null
    );
  elsif p_action='resume' and inst.status='deferred' then
    update public.quest_instances set status='available' where id=inst.id;
    insert into public.quest_events(owner_id,instance_id,event_type)
    values(auth.uid(),inst.id,'resumed');
    return jsonb_build_object(
      'schema_version', 1,
      'status', 'available',
      'quest_instance_id', inst.id,
      'quest_completion_confirmed', false,
      'reward_status', 'not_awarded',
      'xp_awarded', 0,
      'reward_confirmed', false,
      'reward_awarded_at', null
    );
  end if;

  -- Invalid/no-op transitions never mint XP. If a completed state is read,
  -- only the existing ledger row can substantiate a reward confirmation.
  if inst.status='completed' then
    select awarded_at into receipt_awarded_at
    from public.xp_ledger
    where instance_id=inst.id and owner_id=auth.uid();
  end if;
  return jsonb_build_object(
    'schema_version', 1,
    'status', inst.status,
    'quest_instance_id', inst.id,
    'quest_completion_confirmed', (inst.status='completed'),
    'reward_status', case when receipt_awarded_at is not null then 'already_awarded' else 'not_awarded' end,
    'xp_awarded', 0,
    'reward_confirmed', (receipt_awarded_at is not null),
    'reward_awarded_at', receipt_awarded_at
  );
end;
$$;

revoke all on function public.set_quest_instance_status_v2(uuid,text) from public,anon;
grant execute on function public.set_quest_instance_status_v2(uuid,text) to authenticated;
