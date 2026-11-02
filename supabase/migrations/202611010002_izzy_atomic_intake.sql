-- IZ-3: atomic, idempotent staging transaction.
-- Only a trusted server holding service-role credentials may invoke this RPC.
-- No quest creation or XP awards occur here.
create or replace function public.stage_izzy_submission(
  p_submission_id text,
  p_headers jsonb,
  p_cells jsonb,
  p_proposals jsonb
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal jsonb;
  v_index integer := 0;
begin
  if p_submission_id is null
    or p_submission_id !~ '^[A-Za-z0-9_-]{1,128}$'
    or jsonb_typeof(p_headers) is distinct from 'array'
    or jsonb_typeof(p_cells) is distinct from 'array'
    or jsonb_typeof(p_proposals) is distinct from 'array'
    or jsonb_array_length(p_proposals) > 32
    or pg_catalog.length(p_headers::text) > 20000
    or pg_catalog.length(p_cells::text) > 200000
  then
    raise exception 'Invalid Izzy intake payload';
  end if;

  insert into public.izzy_submission_inbox
    (submission_id, raw_payload, state)
  values
    (p_submission_id, jsonb_build_object('headers', p_headers, 'cells', p_cells), 'review_required')
  on conflict (submission_id) do nothing;

  if not found then
    return false;
  end if;

  for v_proposal in select value from jsonb_array_elements(p_proposals)
  loop
    if v_proposal->>'sourceSubmissionId' is distinct from p_submission_id
      or v_proposal->>'status' is distinct from 'review_required'
      or v_proposal->>'category' not in
        ('daily','weekly','monthly','project','long_term','relationship','bonus','reward')
      or v_proposal->>'visibility' not in ('secret','visible','unspecified')
      or coalesce(pg_catalog.length(v_proposal->>'text'), 0) not between 1 and 20000
    then
      raise exception 'Invalid Izzy proposal';
    end if;

    insert into public.izzy_submission_proposals
      (submission_id, proposal_index, category, original_text, visibility, state)
    values
      (p_submission_id, v_index, v_proposal->>'category',
       v_proposal->>'text', v_proposal->>'visibility', 'review_required');
    v_index := v_index + 1;
  end loop;
  return true;
end;
$$;

revoke all on function public.stage_izzy_submission(text,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.stage_izzy_submission(text,jsonb,jsonb,jsonb) to service_role;
comment on function public.stage_izzy_submission(text,jsonb,jsonb,jsonb) is
  'Service-role-only atomic Izzy submission staging; no quest/XP side effects.';
