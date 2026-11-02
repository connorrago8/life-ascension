-- Atomic six-quest approval; all proposals must belong to the same verified owner.
-- Uses existing single-proposal approval with its consent and provenance checks.
create or replace function public.approve_izzy_weekly_batch(
 p_owner_id uuid, p_companion_id uuid, p_due_date date
) returns table(quest_id uuid, proposal_id bigint)
language plpgsql security definer set search_path = ''
as $$
declare v_ids bigint[]; v_id bigint; v_quest uuid;
begin
 select array_agg(p.id order by p.proposal_index) into v_ids
 from public.izzy_submission_proposals p
 join public.izzy_submission_owners o on o.submission_id=p.submission_id
 where p.submission_id='4aV4xDo' and o.owner_id=p_owner_id
   and p.proposal_index between 0 and 5
   and p.category='weekly' and p.state in ('review_required','applied');
 if coalesce(array_length(v_ids,1),0)<>6 then
   raise exception 'Six owned proposals required';
 end if;
 foreach v_id in array v_ids loop
   v_quest:=public.approve_owned_izzy_proposal(p_owner_id,v_id,p_companion_id,p_due_date);
   quest_id:=v_quest;
   proposal_id:=v_id;
   return next;
 end loop;
end;
$$;
revoke all on function public.approve_izzy_weekly_batch(uuid,uuid,date)
 from public,anon,authenticated;
grant execute on function public.approve_izzy_weekly_batch(uuid,uuid,date)
 to service_role;
