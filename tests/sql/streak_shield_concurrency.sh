#!/usr/bin/env bash
# Disposable local database only, after migrations. Never run against hosted data.
set -euo pipefail
db="${DB:-life_ascension_streak_test}"
owner=00000000-0000-0000-0000-00000000c420
other=00000000-0000-0000-0000-00000000c421
psql -v ON_ERROR_STOP=1 -q -d "$db" <<SQL
insert into auth.users(id) values ('$owner'), ('$other');
do \$\$
declare d date; q uuid; i uuid; today date := public.quest_game_day(now(), 'America/Chicago');
begin
  foreach d in array array[today - 4, today - 2] loop
    q := gen_random_uuid(); i := gen_random_uuid();
    insert into public.quests(id, owner_id, title, domain, cadence, scheduled_for, quest_type)
      values(q, '$owner', 'shield race fixture', 'home', 'once', d, 'scheduled');
    insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at)
      values(i, '$owner', q, d, 'completed', (d::timestamp + interval '12 hours') at time zone 'America/Chicago');
    insert into public.xp_ledger(owner_id, instance_id, amount, awarded_at)
      values('$owner', i, 10, (d::timestamp + interval '12 hours') at time zone 'America/Chicago');
  end loop;
end \$\$;
set role authenticated;
select set_config('request.jwt.claim.sub', '$other', false);
do \$\$
begin
  begin
    perform public.confirm_streak_shield(((now() at time zone 'America/Chicago') - interval '5 hours')::date - 3);
    raise exception 'ownership check failed';
  exception when raise_exception then
    assert sqlerrm = 'Shield requires one missed day between completed days', sqlerrm;
  end;
end \$\$;
SQL
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
for request in 1 2; do
  psql -v ON_ERROR_STOP=1 -qAt -d "$db" > "$work/$request" <<SQL &
set role authenticated;
select set_config('request.jwt.claim.sub', '$owner', false);
select public.confirm_streak_shield(((now() at time zone 'America/Chicago') - interval '5 hours')::date - 3)->>'status';
SQL
  if [[ "$request" == 1 ]]; then first_pid=$!; else second_pid=$!; fi
done
wait "$first_pid"
wait "$second_pid"
grep -q '^used$' "$work/1"
grep -q '^used$' "$work/2"
psql -v ON_ERROR_STOP=1 -q -d "$db" <<SQL
do \$\$ begin
  assert (select count(*) from public.streak_shields where owner_id = '$owner') = 1, 'exactly one receipt';
  assert not exists (select 1 from public.streak_shields where owner_id = '$other'), 'other account unchanged';
  assert (select sum(amount) from public.xp_ledger where owner_id = '$owner') = 20, 'shield grants no XP';
end \$\$;
SQL
echo 'PASS shield concurrent confirmation: one owner-scoped receipt, no XP'
