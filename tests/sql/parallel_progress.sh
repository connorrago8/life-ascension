#!/usr/bin/env bash
set -euo pipefail
db="${1:?database required}"
psql -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000f1') on conflict(id) do nothing;
insert into public.quests(id,owner_id,title,domain,cadence,target_amount,progress_unit,progress_increment)
values ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f1','Parallel saves','home','daily',8,'units',1);
insert into public.quest_instances(id,owner_id,quest_id,due_date)
values ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f2',(now() at time zone 'America/Chicago')::date);
insert into public.quests(id,owner_id,title,domain,cadence,target_amount,progress_unit,progress_increment)
values ('00000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-0000000000f1','Config race','home','daily',8,'units',1);
insert into public.quest_instances(id,owner_id,quest_id,due_date)
values ('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f4',(now() at time zone 'America/Chicago')::date);
SQL
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
pids=()
for i in $(seq 1 20); do
  (
    printf "select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',false);\nset role authenticated;\nselect * from public.log_quest_progress('00000000-0000-0000-0000-0000000000f3',('00000000-0000-0000-0000-' || lpad(to_hex(%s),12,'0'))::uuid,1);\n" "$((80000+i))" |
      psql -d "$db" -v ON_ERROR_STOP=1 > "$tmp/$i.log" 2>&1
  ) &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid" || true; done
# At least eight requests must have succeeded; failures beyond target are expected.
successes=$(grep -lE '^[[:space:]]*[0-9]+[[:space:]]*\|[[:space:]]*(available|completed)[[:space:]]*\|' "$tmp"/[0-9]*.log | wc -l || true)
if [ "$successes" -lt 8 ]; then
  echo "Only $successes progress requests succeeded" >&2
  cat "$tmp"/*.log >&2
  exit 1
fi
psql -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
do $$
begin
 if (select current_amount from public.quest_instances where id='00000000-0000-0000-0000-0000000000f3')<>8 then
  raise exception 'Parallel saves did not stop at target';
 end if;
 if (select count(*) from public.quest_progress_operations where instance_id='00000000-0000-0000-0000-0000000000f3')<>8 then
  raise exception 'Parallel saves applied wrong number of operations';
 end if;
 if (select count(*) from public.xp_ledger where instance_id='00000000-0000-0000-0000-0000000000f3')<>1 then
  raise exception 'Parallel saves awarded XP more or less than once';
 end if;
 if (select count(*) from public.quest_events where instance_id='00000000-0000-0000-0000-0000000000f3' and event_type='completed')<>1 then
  raise exception 'Parallel saves duplicated completion event';
 end if;
 raise notice 'PASS 20 parallel saves, 8 applied, 1 XP';
end $$;
SQL

# Reproduce M1: hold the quest lock after saving, while target reconfiguration waits.
(
psql -v ON_ERROR_STOP=1 -d "$db" > "$tmp/save-race.log" 2>&1 <<'SQL'
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',false);
set role authenticated;
begin;
select * from public.log_quest_progress('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-0000000000f6',1);
select pg_sleep(2);
commit;
SQL
) &
save_pid=$!
# Wait for the progress operation to be committed only after the second session begins.
sleep 0.5
(
psql -v ON_ERROR_STOP=1 -d "$db" > "$tmp/config-race.log" 2>&1 <<'SQL'
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',false);
set role authenticated;
select public.configure_quest_progress('00000000-0000-0000-0000-0000000000f4',3,'units',1);
SQL
) &
config_pid=$!
wait "$save_pid"
if wait "$config_pid"; then
 echo "ERROR: target configuration raced past saved progress" >&2
 exit 1
fi
if ! grep -q 'Quest already has completion or progress history' "$tmp/config-race.log"; then
 cat "$tmp/config-race.log" >&2
 exit 1
fi
psql -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
do $$
begin
 if (select current_amount from public.quest_instances where id='00000000-0000-0000-0000-0000000000f5')<>1
   or (select target_amount from public.quests where id='00000000-0000-0000-0000-0000000000f4')<>8 then
  raise exception 'Concurrent configuration corrupted target or progress';
 end if;
 raise notice 'PASS target reconfiguration cannot race with in-flight save';
end $$;
SQL
