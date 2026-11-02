-- Service-role-only linking after the founder's account identity has been verified.
-- No authenticated user may self-claim a submission by guessing its ID.
create or replace function public.link_verified_izzy_weekly_submission(p_owner_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  if p_owner_id is null or not exists (select 1 from auth.users where id = p_owner_id)
    then raise exception 'Verified account required'; end if;
  if not exists (
    select 1 from public.izzy_submission_inbox
    where submission_id = '4aV4xDo' and source = 'tally'
  ) then raise exception 'Submission not staged'; end if;
  insert into public.izzy_submission_owners(submission_id,owner_id)
    values ('4aV4xDo',p_owner_id)
    on conflict (submission_id) do nothing;
  if not exists (
    select 1 from public.izzy_submission_owners
    where submission_id = '4aV4xDo' and owner_id = p_owner_id
  ) then raise exception 'Submission belongs to another account'; end if;
  select count(*) into v_count from public.izzy_submission_proposals
    where submission_id = '4aV4xDo' and state = 'review_required';
  return v_count;
end;
$$;
revoke all on function public.link_verified_izzy_weekly_submission(uuid) from public, anon, authenticated;
grant execute on function public.link_verified_izzy_weekly_submission(uuid) to service_role;
