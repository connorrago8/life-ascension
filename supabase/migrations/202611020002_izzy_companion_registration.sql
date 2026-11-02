-- Consent must be explicit; the signed-in quest owner can register a companion
-- only after confirming that the named person agreed to participate.
create or replace function public.register_consented_izzy_companion(
 p_owner_id uuid
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
 if p_owner_id is null then raise exception 'Verified owner required'; end if;
 select id into v_id from public.quest_companions
 where owner_id=p_owner_id and display_name='Izzy'
   and consent_confirmed_at is not null
 order by created_at limit 1;
 if found then return v_id; end if;
 insert into public.quest_companions(owner_id,display_name,consent_confirmed_at)
 values(p_owner_id,'Izzy',pg_catalog.now()) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.register_consented_izzy_companion(uuid)
 from public,anon,authenticated;
grant execute on function public.register_consented_izzy_companion(uuid)
 to service_role;
