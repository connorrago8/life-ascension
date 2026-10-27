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
  ledger_entry_id uuid;
  receipt_status text;
  receipt_xp integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_action not in ('complete','defer','resume') then
    raise exception 'Unsupported action';
  end if;

  select * into inst
  from public.quest_instances
  where id=p_instance_id and owner_id=auth.uid()
  for update;

  if not found then
    raise exception 'Instance not found';
  end if;

  if p_action='complete' then
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

    return jsonb_build_object(
      'schema_version', 1,
      'status', 'completed',
      'quest_instance_id', inst.id,
      'quest_completion_confirmed', true,
      'reward_status', receipt_status,
      'xp_awarded', receipt_xp,
      'level_up', false
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
      'level_up', false
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
      'level_up', false
    );
  end if;

  return jsonb_build_object(
    'schema_version', 1,
    'status', inst.status,
    'quest_instance_id', inst.id,
    'quest_completion_confirmed', (inst.status='completed'),
    'reward_status', case when inst.status='completed' then 'already_awarded' else 'not_awarded' end,
    'xp_awarded', 0,
    'level_up', false
  );
end;
$$;

revoke all on function public.set_quest_instance_status_v2(uuid,text) from public,anon;
grant execute on function public.set_quest_instance_status_v2(uuid,text) to authenticated;
