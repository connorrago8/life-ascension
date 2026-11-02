-- Approve a verified, owner-linked Izzy proposal as a playable one-time quest.
-- Trusted server must derive p_owner_id from auth.getUser(), never request JSON.
-- No public grants; the transaction is atomic and idempotent by proposal_id.
create or replace function public.approve_owned_izzy_proposal(
  p_owner_id uuid,
  p_proposal_id bigint,
  p_companion_id uuid,
  p_due_date date
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_proposal public.izzy_submission_proposals%rowtype;
  v_companion public.quest_companions%rowtype;
  v_quest uuid;
  v_instance uuid;
  v_companion_assignment uuid;
  v_today date;
  v_deadline timestamptz;
begin
  if p_owner_id is null or p_proposal_id is null or p_companion_id is null then
    raise exception 'Invalid approval request';
  end if;
  v_today := (pg_catalog.now() at time zone public.quest_timezone(p_owner_id))::date;
  if p_due_date is null or p_due_date < v_today or p_due_date > v_today + 366 then
    raise exception 'Invalid quest deadline';
  end if;
  select * into v_companion from public.quest_companions
    where id = p_companion_id and owner_id = p_owner_id
      and consent_confirmed_at is not null for update;
  if not found then raise exception 'Companion consent required'; end if;

  select p.* into v_proposal from public.izzy_submission_proposals p
    join public.izzy_submission_owners o on o.submission_id = p.submission_id
    where p.id = p_proposal_id and o.owner_id = p_owner_id for update of p;
  if not found then raise exception 'Proposal unavailable'; end if;
  select quest_id into v_quest from public.izzy_approved_assignments
    where proposal_id = p_proposal_id and owner_id = p_owner_id;
  if found then return v_quest; end if;
  if v_proposal.state <> 'review_required'
    or v_proposal.category = 'reward'
    or pg_catalog.char_length(pg_catalog.btrim(v_proposal.original_text)) not between 1 and 120
  then raise exception 'Proposal needs review or editing before approval'; end if;

  insert into public.quests(owner_id,title,domain,cadence,scheduled_for,quest_type)
    values(p_owner_id,pg_catalog.btrim(v_proposal.original_text),'relationships','once',p_due_date,'scheduled')
    returning id into v_quest;
  insert into public.quest_instances(owner_id,quest_id,due_date)
    values(p_owner_id,v_quest,p_due_date) returning id into v_instance;
  insert into public.quest_companion_assignments(owner_id,companion_id,quest_id,requested_title,active)
    values(p_owner_id,p_companion_id,v_quest,pg_catalog.btrim(v_proposal.original_text),true)
    returning id into v_companion_assignment;
  v_deadline := (p_due_date + 1)::timestamp at time zone public.quest_timezone(p_owner_id);
  insert into public.izzy_approved_assignments
    (owner_id,quest_id,quest_instance_id,proposal_id,companion_assignment_id,
     consent_at,deadline_at)
    values(p_owner_id,v_quest,v_instance,p_proposal_id,v_companion_assignment,
           pg_catalog.now(),v_deadline);
  update public.izzy_submission_proposals set state = 'applied'
    where id = p_proposal_id;
  return v_quest;
end;
$$;
revoke all on function public.approve_owned_izzy_proposal(uuid,bigint,uuid,date)
  from public, anon, authenticated;
grant execute on function public.approve_owned_izzy_proposal(uuid,bigint,uuid,date)
  to service_role;
