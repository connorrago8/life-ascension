-- Izzy batch 2. Disposable database only. No new XP.
\set ON_ERROR_STOP on

insert into auth.users(id) values
  ('00000000-0000-0000-0000-00000000c301'),
  ('00000000-0000-0000-0000-00000000c302');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c301', false);
select public.companion_invite()->>'code' as code \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c302', false);
select public.companion_accept(:'code');

do $$
declare r jsonb; today date := public.quest_today(); future date := public.quest_today() + 3; sent jsonb; state jsonb;
  before integer; dow integer; repeat uuid;
begin
  r := public.companion_set_identity('Izzy', 'Lantern Keeper', 'rose');
  assert r->>'questColor' = 'rose';
  assert (select avatar_path from public.companion_identities where user_id = auth.uid()) is null, 'avatar slot starts empty';
  begin
    perform public.companion_set_identity('Izzy', 'Lantern Keeper', 'gold');
    raise exception 'invalid color was accepted';
  exception when raise_exception then
    assert sqlerrm = 'Invalid color';
  end;

  sent := public.companion_send_quest('Off-day tidy', null, future, null, 'daily');
  assert (sent->>'dueOn')::date = future, sent::text;
  assert sent->>'status' = 'accepted';

  select count(*) into before from public.xp_ledger where owner_id = '00000000-0000-0000-0000-00000000c301';
  r := public.companion_set_reward('Movie night', 5);
  assert r->>'rewardId' is not null;
  state := public.companion_state();
  assert (state->'rewards'->0->>'text') = 'Movie night';
  assert (state->'rewards'->0->>'unlocked')::boolean = false;
  assert (select count(*) from public.xp_ledger where owner_id = '00000000-0000-0000-0000-00000000c301') = before, 'reward awarded XP';

  dow := pg_catalog.date_part('isodow', today)::integer;
  r := public.companion_save_repeat('Take out the trash', null, dow, 'daily');
  repeat := (r->>'repeatId')::uuid;
  state := public.companion_state();
  assert (select count(*) from public.companion_repeat_spawns where repeat_id = repeat) = 1, 'repeat did not spawn today';
  perform public.companion_state();
  assert (select count(*) from public.companion_repeat_spawns where repeat_id = repeat) = 1, 'repeat spawned twice';
  perform public.companion_pause_repeat(repeat, false);
end $$;
reset role;
delete from public.companion_repeat_spawns
  where repeat_id in (select id from public.companion_repeats where title = 'Take out the trash');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c302', false);
do $$
declare repeat uuid;
begin
  perform public.companion_state();
  select id into repeat from public.companion_repeats where title = 'Take out the trash';
  assert (select count(*) from public.companion_repeat_spawns where repeat_id = repeat) = 0, 'paused repeat spawned';
  perform public.companion_delete_repeat(repeat);
  assert (select deleted_at from public.companion_repeats where id = repeat) is not null;
end $$;

-- Finish one quest. Izzy is told, she can say thank you, and neither step mints XP.
do $$
declare sent jsonb; done jsonb; state jsonb; before integer; inst uuid;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c302', true);
  sent := public.companion_send_quest('The Evening Reset', null, null, null, 'daily');
  inst := (sent->>'instanceId')::uuid;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c301', true);
  select count(*) into before from public.xp_ledger where owner_id = auth.uid();
  begin
    perform public.companion_nudge((sent->>'questId')::uuid);
    raise exception 'Connor nudged his own quest';
  exception when raise_exception then
    assert sqlerrm = 'Quest not found';
  end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c302', true);
  perform public.companion_nudge((sent->>'questId')::uuid);
  begin
    perform public.companion_nudge((sent->>'questId')::uuid);
    raise exception 'second nudge was accepted';
  exception when raise_exception then
    assert sqlerrm = 'Already nudged today';
  end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c301', true);
  state := public.companion_state();
  assert exists (
    select 1 from jsonb_array_elements(state->'quests') q
    where q->>'id' = sent->>'questId' and (q->>'nudgedToday')::boolean
  ), state::text;
  done := public.companion_complete_quest((sent->>'questId')::uuid);
  assert (done->>'xp_awarded')::int = 10;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c302', true);
  state := public.companion_state();
  assert exists (
    select 1 from jsonb_array_elements(state->'notices') n
    where n->>'kind' = 'completed' and n->>'questId' = sent->>'questId'
  ), state::text;
  perform public.companion_thank((sent->>'questId')::uuid);
  perform public.companion_thank((sent->>'questId')::uuid);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c301', true);
  state := public.companion_state();
  assert (select count(*) from public.companion_notices where quest_id = (sent->>'questId')::uuid and kind = 'thanks') = 1, 'thank-you duplicated';
  assert exists (select 1 from jsonb_array_elements(state->'notices') n where n->>'kind' = 'thanks');
  assert (state->'milestones'->0->>'earned')::boolean = false;
  assert (select count(*) from public.xp_ledger where instance_id = inst) = 1, 'thank or nudge minted XP';

  begin
    perform public.companion_register_proof(inst, (select bond_id::text from public.companion_quests where instance_id = inst) || '/' || inst::text, 'text/plain', 10);
    raise exception 'bad type accepted';
  exception when raise_exception then
    assert sqlerrm = 'Use a JPEG, PNG, or WebP photo';
  end;
  perform public.companion_register_proof(inst, (select bond_id::text from public.companion_quests where instance_id = inst) || '/' || inst::text, 'image/jpeg', 120);
  assert (select count(*) from public.xp_ledger where instance_id = inst) = 1, 'photo awarded XP';
end $$;

-- A companion weekly quest can be finished before the seeded reveal.
do $$
declare sent jsonb; err text;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c302', true);
  sent := public.companion_send_quest('Deep clean the kitchen', null, null, null, 'weekly');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c301', true);
  assert (select companion_one_shot from public.quests where id = (
    select quest_id from public.companion_quests where id = (sent->>'questId')::uuid
  )), 'weekly companion quest is one-shot';
  begin
    perform public.companion_complete_quest((sent->>'questId')::uuid);
  exception when raise_exception then
    err := sqlerrm;
  end;
  assert err is distinct from 'This weekly quest is not on your board yet', coalesce(err, 'completed');
end $$;

reset role;
do $$
begin
  assert position('companion_one_shot' in pg_catalog.pg_get_functiondef('public._check_weekly_window(uuid,uuid,date)'::regprocedure)) > 0;
end $$;
select 'companion batch 2 smoke passed' as result;
