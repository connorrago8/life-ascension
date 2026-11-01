-- IZ-12: Reveal must obey the same real companion identity and consent
-- gates as the +2 XP award. Never reveal for an inactive companion link.
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
  if p_curse_id is null or p_owner_id is null then return; end if;

  select * into v_curse from public.izzy_secret_curses
   where id = p_curse_id and assignment_id is not null
   for update;
  if not found then return; end if;

  select * into v_assignment from public.izzy_approved_assignments a
   where a.id = v_curse.assignment_id
     and a.owner_id = p_owner_id
     and a.origin = 'izzy'
     and a.consent_at is not null
     and a.consent_revoked_at is null
     and a.quest_id = v_curse.quest_id
     and exists (
       select 1 from public.quest_companion_assignments ca
       join public.quest_companions c
         on c.id = ca.companion_id and c.owner_id = ca.owner_id
       where ca.id = a.companion_assignment_id
         and ca.owner_id = a.owner_id
         and ca.quest_id = a.quest_id
         and ca.active = true
         and c.consent_confirmed_at is not null
     )
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

  select * into v_curse from public.izzy_secret_curses where id = p_curse_id;
  if v_curse.state <> 'revealed' then return; end if;

  return query select v_curse.id, v_curse.state, v_curse.consequence_text,
                      v_curse.revealed_at, v_curse.seen_at, v_changed;
end;
$$;

revoke all on function public.reveal_due_izzy_secret_curse(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.reveal_due_izzy_secret_curse(uuid,uuid)
  to service_role;
