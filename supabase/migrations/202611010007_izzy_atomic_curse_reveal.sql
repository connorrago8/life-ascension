-- IZ-8: Authoritative, atomic Secret Curse reveal for verified Izzy assignments.
-- This service-role-only RPC never returns sealed consequence text.
-- A missed occurrence is a non-completed quest_instances row whose deadline
-- has passed. A completed row is never revealed, including late completions:
-- conservative fail-closed behavior until timestamped completion evidence exists.
create or replace function public.reveal_due_izzy_secret_curse(
  p_curse_id uuid,
  p_owner_id uuid
) returns table (
  curse_id uuid,
  curse_state text,
  consequence_text text,
  revealed_at timestamptz,
  seen_at timestamptz,
  changed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curse public.izzy_secret_curses%rowtype;
  v_assignment public.izzy_approved_assignments%rowtype;
  v_instance public.quest_instances%rowtype;
  v_changed boolean := false;
begin
  if p_curse_id is null or p_owner_id is null then
    return;
  end if;

  select * into v_curse from public.izzy_secret_curses
   where id = p_curse_id and assignment_id is not null
   for update;
  if not found then return; end if;

  select * into v_assignment from public.izzy_approved_assignments
   where id = v_curse.assignment_id
     and owner_id = p_owner_id
     and origin = 'izzy'
     and consent_at is not null
     and consent_revoked_at is null
     and quest_id = v_curse.quest_id
   for update;
  if not found then return; end if;

  select * into v_instance from public.quest_instances
   where id = v_assignment.quest_instance_id
     and owner_id = v_assignment.owner_id
     and quest_id = v_assignment.quest_id
   for update;
  if not found then return; end if;

  if v_curse.state = 'sealed'
     and v_curse.deadline_at = v_assignment.deadline_at
     and pg_catalog.now() > v_assignment.deadline_at
     and v_instance.status = 'available'
  then
    update public.izzy_secret_curses
       set state = 'revealed', revealed_at = pg_catalog.now(),
           updated_at = pg_catalog.now()
     where id = p_curse_id and state = 'sealed';
    v_changed := found;
  end if;

  -- Never expose text for sealed, cancelled or otherwise resolved curses.
  select * into v_curse from public.izzy_secret_curses
   where id = p_curse_id;
  if v_curse.state <> 'revealed' then return; end if;

  return query select v_curse.id, v_curse.state, v_curse.consequence_text,
                      v_curse.revealed_at, v_curse.seen_at, v_changed;
end;
$$;

revoke all on function public.reveal_due_izzy_secret_curse(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.reveal_due_izzy_secret_curse(uuid,uuid)
  to service_role;

comment on function public.reveal_due_izzy_secret_curse(uuid,uuid) is
  'Trusted service-role-only atomic reveal. Requires authenticated owner verified by caller, approved Izzy assignment, active consent, matching occurrence, overdue deadline, and available status. No XP side effects.';
