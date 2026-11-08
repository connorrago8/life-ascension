-- Izzy companion batch 1. Disposable database only, after every migration.
\set ON_ERROR_STOP on

insert into auth.users(id) values
  ('00000000-0000-0000-0000-00000000c101'),
  ('00000000-0000-0000-0000-00000000c102'),
  ('00000000-0000-0000-0000-00000000c103');
create temp table b1_code(code text, bond uuid);
create temp table b1_quest(id uuid);
grant all on b1_code, b1_quest to authenticated;

do $$ begin
  assert to_regclass('public.quest_streaks') is null, 'no per-quest streak table';
  assert not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'quests' and column_name ilike '%streak%'
  );
  assert position('v_amount := 2' in pg_catalog.pg_get_functiondef('public._award_quest_xp(uuid,uuid)'::regprocedure)) = 0;
  assert position('_award_personal_quest_xp' in pg_catalog.pg_get_functiondef('public._award_quest_xp(uuid,uuid)'::regprocedure)) > 0;
  assert position('extensions.digest' in pg_catalog.pg_get_functiondef('public.companion_invite()'::regprocedure)) > 0;
  assert position('public.digest' in pg_catalog.pg_get_functiondef('public.companion_invite()'::regprocedure)) = 0;
  assert not has_table_privilege('authenticated', 'public.companion_bonds', 'INSERT');
  assert not has_table_privilege('authenticated', 'public.xp_ledger', 'INSERT');
  assert not has_table_privilege('anon', 'public.companion_quests', 'SELECT');
end $$;

-- Yesterday counts for Connor, so today's later quest receives the streak bonus.
insert into public.quests(id, owner_id, title, domain, cadence, scheduled_for, quest_type)
  values ('00000000-0000-0000-0000-00000000c111', '00000000-0000-0000-0000-00000000c101', 'Yesterday', 'home', 'once', current_date, 'scheduled');
insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at)
  values ('00000000-0000-0000-0000-00000000c112', '00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c111',
    public.quest_game_day(pg_catalog.now(), 'America/Chicago') - 1, 'completed',
    ((public.quest_game_day(pg_catalog.now(), 'America/Chicago') - 1)::timestamp + interval '12 hours') at time zone 'America/Chicago');
insert into public.xp_ledger(owner_id, instance_id, amount, awarded_at)
  values ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c112', 10,
    ((public.quest_game_day(pg_catalog.now(), 'America/Chicago') - 1)::timestamp + interval '12 hours') at time zone 'America/Chicago');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c101', false);
do $$
declare r jsonb;
begin
  r := public.companion_invite();
  assert r->>'code' is not null and length(r->>'code') = 12;
  delete from b1_code;
  insert into b1_code values (r->>'code', (r->>'bondId')::uuid);
end $$;

-- Invalid, own, expired, revoked.
do $$
declare ok boolean := false;
begin
  begin perform public.companion_accept('not-a-real-code'); exception when raise_exception then ok := sqlerrm = 'Invitation unavailable'; end;
  assert ok, 'invalid code';
  ok := false;
  begin perform public.companion_accept((select code from b1_code)); exception when raise_exception then ok := sqlerrm = 'You cannot accept your own invitation'; end;
  assert ok, 'own invitation';
end $$;
reset role;
update public.companion_bonds set expires_at = pg_catalog.now() - interval '1 minute' where id = (select bond from b1_code);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c102', false);
do $$
declare ok boolean := false;
begin
  begin perform public.companion_accept((select code from b1_code)); exception when raise_exception then ok := sqlerrm = 'Invitation expired'; end;
  assert ok, 'expired';
end $$;
reset role;
update public.companion_bonds set expires_at = pg_catalog.now() + interval '1 day', status = 'revoked', revoked_at = pg_catalog.now() where id = (select bond from b1_code);
set role authenticated;
do $$
declare ok boolean := false;
begin
  begin perform public.companion_accept((select code from b1_code)); exception when raise_exception then ok := sqlerrm = 'Invitation revoked'; end;
  assert ok, 'revoked';
end $$;

-- Fresh valid invite, accept, duplicate accept.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c101', false);
do $$
declare r jsonb;
begin
  r := public.companion_invite();
  delete from b1_code;
  insert into b1_code values (r->>'code', (r->>'bondId')::uuid);
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c102', false);
do $$
declare r jsonb;
begin
  r := public.companion_accept((select code from b1_code));
  assert (r->>'accepted')::boolean and (r->>'already')::boolean = false;
  r := public.companion_accept((select code from b1_code));
  assert (r->>'already')::boolean, 'duplicate accept';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c103', false);
do $$
declare ok boolean := false;
begin
  begin perform public.companion_accept((select code from b1_code)); exception when raise_exception then ok := sqlerrm = 'Invitation unavailable'; end;
  assert ok, 'third account cannot accept';
  assert (select count(*) from public.companion_bonds) = 0, 'third account sees no bonds';
  assert (select count(*) from public.companion_quests) = 0;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c102', false);
do $$
declare r jsonb; q jsonb;
begin
  r := public.companion_set_identity('Izzy', 'Lantern Keeper');
  assert r->>'title' = 'Lantern Keeper';
  begin perform public.companion_set_identity('Izzy', 'Not A Title'); exception when raise_exception then
    assert sqlerrm = 'Invalid title';
  end;
  q := public.companion_send_quest('The Evening Reset', 'Tidy for fifteen minutes', null, 'Choose our movie');
  assert q->>'status' = 'accepted', q::text;
  assert q->>'cadence' = 'daily';
  assert (select instance_id from public.companion_quests where id = (q->>'questId')::uuid) is not null, 'send did not place the quest';
  delete from b1_quest;
  insert into b1_quest values ((q->>'questId')::uuid);
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c101', false);
do $$
declare r jsonb; rows integer;
begin
  r := public.companion_respond_quest((select id from b1_quest), true);
  assert r->>'status' = 'accepted';
  select count(*) into rows from public.xp_ledger where owner_id = auth.uid();
  assert rows = 1, 'no XP on acceptance';
  r := public.companion_complete_quest((select id from b1_quest));
  assert (r->>'xp_awarded')::int = 10 and (r->>'first_of_day')::boolean and (r->>'streak_fire')::int = 1, r::text;
  r := public.companion_complete_quest((select id from b1_quest));
  assert coalesce((r->>'xp_awarded')::int, 0) = 0, r::text;
  assert (select count(*) from public.xp_ledger where instance_id = (select instance_id from public.companion_quests where id = (select id from b1_quest))) = 1;
end $$;

-- Second quest the same game day receives the streak bonus. F stays 1.
do $$
declare sent jsonb; r jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c102', true);
  sent := public.companion_send_quest('Read together', null, null, null);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c101', true);
  perform public.companion_respond_quest((sent->>'questId')::uuid, true);
  r := public.companion_complete_quest((sent->>'questId')::uuid);
  assert (r->>'xp_awarded')::int = 11 and (r->>'first_of_day')::boolean = false and (r->>'streak_fire')::int = 1, r::text;
end $$;

-- Overlap with a normal quest is one credit.
do $$
declare today date := public.quest_today(); existing uuid; sent jsonb; accepted jsonb; r jsonb; n integer;
begin
  existing := public.ensure_quest_instance(public.create_scheduled_quest('Fold laundry', 'home', 'daily', today, 'scheduled'), today);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c102', true);
  sent := public.companion_send_quest('fold laundry', null, null, null);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c101', true);
  accepted := public.companion_respond_quest((sent->>'questId')::uuid, true);
  assert (accepted->>'instanceId')::uuid = existing, accepted::text;
  r := public.companion_complete_quest((sent->>'questId')::uuid);
  assert (r->>'xp_awarded')::int > 0;
  r := public.set_quest_instance_status_v2(existing, 'complete');
  assert coalesce((r->>'xp_awarded')::int, 0) = 0;
  select count(*) into n from public.xp_ledger where instance_id = existing;
  assert n = 1, 'overlap minted a second row';
end $$;

-- Izzy sees the completion. Respond is a no-op and still awards nothing.
-- A weekly quest is one instance for the week that contains the chosen day.
do $$
declare sent jsonb; before integer; n integer; qid uuid;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c101', true);
  select count(*) into before from public.xp_ledger where owner_id = auth.uid();
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c102', true);
  sent := public.companion_send_quest('Get rid of the cardboard boxes', 'cardboard boxes', null, null, 'weekly');
  assert sent->>'status' = 'accepted' and sent->>'cadence' = 'weekly', sent::text;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c101', true);
  qid := (select quest_id from public.companion_quests where id = (sent->>'questId')::uuid);
  assert (select cadence from public.quests where id = qid) = 'weekly', 'weekly cadence';
  assert (select companion_one_shot from public.quests where id = qid), 'one-shot flag';
  assert (select due_date from public.quest_instances where id = (sent->>'instanceId')::uuid)
    = (sent->>'dueOn')::date - (pg_catalog.date_part('isodow', (sent->>'dueOn')::date)::integer - 1), 'week of the chosen day';
  assert (select count(*) from public.xp_ledger where owner_id = auth.uid()) = before, 'weekly send awarded XP';
  perform public.ensure_quest_instance(qid, public.quest_today());
  select count(*) into n from public.quest_instances where quest_id = qid;
  assert n = 1, 'one-shot weekly minted another week';
end $$;

-- Izzy sees the completion. A no-op decline awards nothing.
do $$
declare state jsonb; sent jsonb; before integer;
begin
  state := public.companion_state();
  assert exists (
    select 1 from jsonb_array_elements(state->'quests') q
    where q->>'title' = 'The Evening Reset' and q->>'status' = 'completed'
  ), state::text;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c102', true);
  state := public.companion_state();
  assert exists (
    select 1 from jsonb_array_elements(state->'quests') q
    where q->>'title' = 'The Evening Reset' and q->>'status' = 'completed'
  );
  sent := public.companion_send_quest('Skip this', null, null, null);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c101', true);
  select count(*) into before from public.xp_ledger where owner_id = auth.uid();
  perform public.companion_respond_quest((sent->>'questId')::uuid, false);
  assert (select status from public.companion_quests where id = (sent->>'questId')::uuid) = 'accepted', 'decline is no longer a step';
  assert (select count(*) from public.xp_ledger where owner_id = auth.uid()) = before;
end $$;

-- Manual activity uses Izzy's streak. Void reverses XP and keeps the row.
do $$
declare req uuid := gen_random_uuid(); r jsonb; net bigint; n integer;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c101', true);
  r := public.companion_log_activity(req, 'Finished her project', 'Recorded by Connor');
  assert (r->>'xpAwarded')::int = 10 and (r->>'already')::boolean = false, r::text;
  r := public.companion_log_activity(req, 'Finished her project', 'Recorded by Connor');
  assert (r->>'already')::boolean and (r->>'xpAwarded')::int = 0, 'request replay';
  r := public.companion_log_activity(gen_random_uuid(), 'Finished her project', null);
  assert (r->>'already')::boolean and (r->>'xpAwarded')::int = 0, 'same activity deduped';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c102', true);
  net := public.get_lifetime_xp();
  assert net = 10, net::text;
  r := public.companion_state();
  assert exists (
    select 1 from jsonb_array_elements(r->'activities') a
    where a->>'title' = 'Finished her project' and (a->>'voided')::boolean = false
      and a->>'recordedBy' = '00000000-0000-0000-0000-00000000c101'
  );
  perform public.companion_void_activity((
    select id from public.companion_activities where subject_id = auth.uid() limit 1
  ));
  assert public.get_lifetime_xp() = 0, 'void did not reverse XP';
  select count(*) into n from public.xp_ledger where owner_id = auth.uid();
  assert n = 1, 'void deleted history';
  assert (select count(*) from public.xp_ledger_adjustments where owner_id = auth.uid()) = 1;
  perform public.companion_void_activity((
    select id from public.companion_activities where subject_id = auth.uid() limit 1
  ));
  assert public.get_lifetime_xp() = 0, 'second void changed XP';
end $$;

-- Revocation keeps earned XP and blocks a new quest. A stranger cannot write.
do $$
declare before bigint; ok boolean := false; bond uuid;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c101', true);
  before := public.get_lifetime_xp();
  select id into bond from public.companion_bonds where status = 'active' and inviter_id = auth.uid();
  perform public.companion_revoke(bond);
  assert public.get_lifetime_xp() = before, 'revoke changed XP';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c102', true);
  begin perform public.companion_send_quest('After revoke', null, null, null); exception when raise_exception then ok := sqlerrm = 'Companion connection required'; end;
  assert ok, 'quest after revoke';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c103', true);
  ok := false;
  begin perform public.companion_log_activity(gen_random_uuid(), 'Nope', null); exception when raise_exception then ok := sqlerrm = 'Companion connection required'; end;
  assert ok, 'stranger log';
  ok := false;
  begin perform public.companion_respond_quest(gen_random_uuid(), true); exception when raise_exception then ok := sqlerrm = 'Quest not found'; end;
  assert ok, 'stranger respond';
end $$;
reset role;

select 'companion batch 1 smoke passed' as result;
