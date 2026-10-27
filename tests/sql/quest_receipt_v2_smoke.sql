-- Versioned completion receipt is quest-scoped and reports newly awarded XP only once.
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000b1');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select set_config('request.jwt.claim.role', '', false);
set role authenticated;

do $$
declare
  v_user uuid := '00000000-0000-0000-0000-0000000000b1';
  v_quest uuid;
  v_inst uuid;
  r jsonb;
begin
  insert into public.quests(owner_id,title,domain,cadence,xp)
  values(v_user,'Receipt contract test','personal_growth','once',1)
  returning id into v_quest;
  v_inst := public.ensure_quest_instance(v_quest,current_date);

  r := public.set_quest_instance_status_v2(v_inst,'complete');
  if r->>'schema_version' <> '1'
     or r->>'status' <> 'completed'
     or r->>'quest_instance_id' <> v_inst::text
     or r->>'quest_completion_confirmed' <> 'true'
     or r->>'reward_status' <> 'awarded'
     or r->>'xp_awarded' <> '1' then
    raise exception 'first completion receipt invalid: %', r;
  end if;

  r := public.set_quest_instance_status_v2(v_inst,'complete');
  if r->>'reward_status' <> 'already_awarded'
     or r->>'xp_awarded' <> '0'
     or r->>'quest_completion_confirmed' <> 'true' then
    raise exception 'duplicate completion receipt invalid: %', r;
  end if;

  if (select count(*) from public.xp_ledger where instance_id=v_inst) <> 1 then
    raise exception 'duplicate receipt created duplicate XP ledger entry';
  end if;

  begin
    perform public.set_quest_instance_status_v2('00000000-0000-0000-0000-0000000000ff','complete');
    raise exception 'unknown instance was accepted';
  exception when others then
    if sqlerrm = 'unknown instance was accepted' then raise; end if;
    if sqlerrm <> 'Instance not found' then raise; end if;
  end;

  raise notice 'PASS v2 receipt confirms first award once and duplicate retry reports zero newly awarded XP';
end
$$;
reset role;
