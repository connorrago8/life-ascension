-- Run only after the isolated browser journey: assert persisted rows, not only DOM labels.
do $$
begin
 if (select count(*) from public.xp_ledger where owner_id='00000000-0000-0000-0000-00000000ce01') <> 2
    or (select sum(amount) from public.xp_ledger where owner_id='00000000-0000-0000-0000-00000000ce01') <> 4
    or (select count(*) from public.quest_events where owner_id='00000000-0000-0000-0000-00000000ce01' and event_type='completed') <> 2
 then raise exception 'Home/companion overlap duplicated or lost persisted credit'; end if;
 if exists(select 1 from public.xp_ledger where owner_id in ('00000000-0000-0000-0000-00000000ce02','00000000-0000-0000-0000-00000000ce03'))
 then raise exception 'Home/companion journey credited the wrong actor'; end if;
end $$;
