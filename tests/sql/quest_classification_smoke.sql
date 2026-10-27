begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000081'),('00000000-0000-0000-0000-000000000082');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000081',true);
do $$
declare q uuid; v_class text;
begin
 q := public.create_classified_quest('Milestone Main','home','daily',(now() at time zone 'America/Chicago')::date,'scheduled','main');
 select quest_class into v_class from public.quests where id=q;
 if v_class <> 'main' then raise exception 'Classification not saved'; end if;
 if not exists(select 1 from public.quest_instances where quest_id=q) then raise exception 'Occurrence missing'; end if;
 perform public.set_quest_class(q,'side');
 select quest_class into v_class from public.quests where id=q;
 if v_class <> 'side' then raise exception 'Classification not updated'; end if;
 begin
  perform public.set_quest_class(q,'invalid');
  raise exception 'invalid accepted';
 exception when others then if sqlerrm <> 'Invalid quest classification' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000082',true);
 begin
  perform public.set_quest_class(q,'main');
  raise exception 'cross-owner accepted';
 exception when others then if sqlerrm <> 'Active quest not found' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.set_quest_class(q,'main');
  raise exception 'unauthenticated accepted';
 exception when others then if sqlerrm <> 'Authentication required' then raise; end if; end;
end $$;
rollback;
